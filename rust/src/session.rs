//! Sessions signées et boîte à outils des cérémonies WebAuthn.
//!
//! Le cookie `docdoc.sid` porte un identifiant aléatoire signé en HMAC-SHA256.
//! L'état vit en mémoire, comme `express-session` avec son `MemoryStore` : une
//! session survit 30 jours glissants, un redémarrage les oublie.

use std::collections::HashMap;

use axum::extract::Request;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use hmac::{Hmac, Mac};
use rand::RngCore;
use serde_json::json;
use sha2::Sha256;
use tokio::sync::Mutex;

use crate::app::AppState;

pub const COOKIE_NAME: &str = "docdoc.sid";
pub const SESSION_TTL_MS: i64 = 30 * 24 * 60 * 60 * 1000;
pub const ENROLLMENT_TTL_MS: i64 = 15 * 60 * 1000;
pub const CEREMONY_TTL_MS: i64 = 5 * 60 * 1000;

#[derive(Clone, Debug, Default)]
pub struct Enrollment {
    pub email: String,
    pub user_id: String,
    pub verified_at: i64,
    pub expires_at: i64,
}

#[derive(Clone, Debug)]
pub struct Ceremony {
    pub kind: String,
    pub challenge: String,
    pub expires_at: i64,
}

#[derive(Clone, Debug, Default)]
pub struct SessionData {
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub pending_email: Option<String>,
    pub enrollment: Option<Enrollment>,
    pub ceremony: Option<Ceremony>,
    pub expires_at: i64,
    pub last_seen: i64,
}

impl SessionData {
    pub fn is_signed_in(&self) -> bool {
        self.user_id.is_some()
    }

    pub fn valid_enrollment(&self) -> Option<&Enrollment> {
        self.enrollment
            .as_ref()
            .filter(|enrollment| !enrollment.email.is_empty() && enrollment.expires_at > now_ms())
    }

    pub fn put_ceremony(&mut self, kind: &str, challenge: String) {
        self.ceremony = Some(Ceremony {
            kind: kind.to_string(),
            challenge,
            expires_at: now_ms() + CEREMONY_TTL_MS,
        });
    }

    /// Consomme la cérémonie en attente, quel que soit son type ensuite : une
    /// réponse ne peut pas être rejouée.
    pub fn take_ceremony(&mut self, kind: &str) -> Option<Ceremony> {
        let ceremony = self.ceremony.take()?;
        if ceremony.kind != kind || ceremony.expires_at <= now_ms() {
            return None;
        }
        Some(ceremony)
    }
}

pub fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub struct SessionStore {
    secret: Vec<u8>,
    sessions: Mutex<HashMap<String, SessionData>>,
}

impl SessionStore {
    pub fn new(secret: Vec<u8>) -> SessionStore {
        SessionStore {
            secret,
            sessions: Mutex::new(HashMap::new()),
        }
    }

    fn sign(&self, id: &str) -> String {
        let mut mac =
            Hmac::<Sha256>::new_from_slice(&self.secret).expect("clé HMAC de taille arbitraire");
        mac.update(id.as_bytes());
        hex::encode(mac.finalize().into_bytes())
    }

    fn verify(&self, id: &str, signature: &str) -> bool {
        let mut mac =
            Hmac::<Sha256>::new_from_slice(&self.secret).expect("clé HMAC de taille arbitraire");
        mac.update(id.as_bytes());
        match hex::decode(signature) {
            Ok(expected) => mac.verify_slice(&expected).is_ok(),
            Err(_) => false,
        }
    }

    pub async fn create(&self) -> (String, SessionData) {
        let mut bytes = [0u8; 24];
        rand::thread_rng().fill_bytes(&mut bytes);
        let id = hex::encode(bytes);
        let now = now_ms();
        let data = SessionData {
            expires_at: now + SESSION_TTL_MS,
            last_seen: now,
            ..Default::default()
        };
        self.sessions.lock().await.insert(id.clone(), data.clone());
        (id, data)
    }

    /// Lit la session du cookie. Une session expirée est oubliée.
    pub async fn load(&self, headers: &HeaderMap) -> Option<(String, SessionData)> {
        let value = cookie_value(headers)?;
        let (id, signature) = value.split_once('.')?;
        if !self.verify(id, signature) {
            return None;
        }
        let mut sessions = self.sessions.lock().await;
        let data = sessions.get(id)?.clone();
        if data.expires_at <= now_ms() {
            sessions.remove(id);
            return None;
        }
        Some((id.to_string(), data))
    }

    pub async fn save(&self, id: &str, data: &SessionData) {
        self.sessions
            .lock()
            .await
            .insert(id.to_string(), data.clone());
    }

    /// Touche la session (TTL glissant) et retourne sa nouvelle valeur.
    pub async fn touch(&self, id: &str) -> Option<SessionData> {
        let mut sessions = self.sessions.lock().await;
        let data = sessions.get_mut(id)?;
        let now = now_ms();
        data.last_seen = now;
        data.expires_at = now + SESSION_TTL_MS;
        Some(data.clone())
    }

    pub async fn destroy(&self, id: &str) {
        self.sessions.lock().await.remove(id);
    }

    /// Change l'identifiant de session en conservant ses données : utilisé
    /// après l'élévation de privilège (enrôlement ou connexion).
    pub async fn regenerate(&self, data: &SessionData) -> (String, SessionData) {
        let (id, _) = self.create().await;
        let mut fresh = data.clone();
        fresh.ceremony = None;
        fresh.pending_email = None;
        fresh.enrollment = None;
        self.save(&id, &fresh).await;
        (id, fresh)
    }

    /// En-tête `Set-Cookie` de la session.
    pub fn cookie_header(&self, id: &str, secure: bool) -> String {
        self.cookie_value(id, secure, SESSION_TTL_MS / 1000)
    }

    pub fn clear_cookie_header(&self, secure: bool) -> String {
        self.cookie_value("", secure, 0)
    }

    fn cookie_value(&self, id: &str, secure: bool, max_age_seconds: i64) -> String {
        let value = if id.is_empty() {
            String::new()
        } else {
            format!("{id}.{}", self.sign(id))
        };
        let mut cookie = format!(
            "{COOKIE_NAME}={value}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age_seconds}"
        );
        if secure {
            cookie.push_str("; Secure");
        }
        cookie
    }
}

pub fn cookie_value(headers: &HeaderMap) -> Option<String> {
    let raw = headers.get(header::COOKIE)?.to_str().ok()?;
    for part in raw.split(';') {
        let Some((name, value)) = part.trim().split_once('=') else {
            continue;
        };
        if name == COOKIE_NAME {
            let Some((id, signature)) = value.split_once('.') else {
                continue;
            };
            if id.len() == 48 && signature.len() == 64 {
                return Some(format!("{id}.{signature}"));
            }
        }
    }
    None
}

/// Vérifie le cookie et retourne l'identifiant de session.
pub async fn verified_session_id(
    state: &AppState,
    headers: &HeaderMap,
) -> Option<(String, SessionData)> {
    state.sessions.load(headers).await
}

/// Utilisateur authentifié attaché à la requête par le middleware.
#[derive(Clone, Debug)]
pub struct AuthUser {
    pub session_id: String,
    pub user_id: String,
    pub email: String,
}

pub async fn require_auth(
    axum::extract::State(state): axum::extract::State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    let headers = request.headers().clone();
    let Some((id, data)) = verified_session_id(&state, &headers).await else {
        return guard_response(&headers, request.uri().path());
    };
    let Some(user_id) = data.user_id.clone() else {
        return guard_response(&headers, request.uri().path());
    };
    let email = data.email.clone().unwrap_or_default();
    if state.sessions.touch(&id).await.is_none() {
        return guard_response(&headers, request.uri().path());
    }
    request.extensions_mut().insert(AuthUser {
        session_id: id.clone(),
        user_id,
        email,
    });
    let mut response = next.run(request).await;
    let cookie = state
        .sessions
        .cookie_header(&id, state.config.is_production);
    if let Ok(value) = HeaderValue::from_str(&cookie) {
        response.headers_mut().append(header::SET_COOKIE, value);
    }
    response
}

/// Réponse du garde, selon le type de requête, comme `authroutes.guard`.
pub fn guard_response(headers: &HeaderMap, path: &str) -> Response {
    let is_htmx = headers
        .get("HX-Request")
        .and_then(|value| value.to_str().ok())
        .map(|value| value == "true")
        .unwrap_or(false);
    if is_htmx {
        let mut response = StatusCode::UNAUTHORIZED.into_response();
        response
            .headers_mut()
            .insert("HX-Redirect", HeaderValue::from_static("/"));
        return response;
    }
    if path.starts_with("/api/") || path.contains("/api/") {
        return (
            StatusCode::UNAUTHORIZED,
            axum::Json(json!({ "authenticated": false })),
        )
            .into_response();
    }
    redirect("/")
}

pub fn redirect(location: &str) -> Response {
    (
        StatusCode::FOUND,
        [(header::LOCATION, location.to_string())],
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn cookie_round_trip_and_expiry() {
        let store = SessionStore::new(b"secret".to_vec());
        let (id, mut data) = store.create().await;
        data.user_id = Some("u1".to_string());
        store.save(&id, &data).await;

        let cookie = store.cookie_header(&id, false);
        let value = cookie
            .strip_prefix("docdoc.sid=")
            .unwrap()
            .split(';')
            .next()
            .unwrap()
            .to_string();
        let mut headers = HeaderMap::new();
        headers.insert(
            header::COOKIE,
            HeaderValue::from_str(&format!("docdoc.sid={value}")).unwrap(),
        );
        let (found, loaded) = store.load(&headers).await.unwrap();
        assert_eq!(found, id);
        assert_eq!(loaded.user_id.as_deref(), Some("u1"));

        let (id_part, signature) = value.split_once('.').unwrap();
        assert!(store.verify(id_part, signature));
        assert!(!store.verify(id_part, "00"));
    }

    #[tokio::test]
    async fn ceremony_is_single_use() {
        let mut data = SessionData::default();
        data.put_ceremony("registration", "abc".to_string());
        assert!(data.take_ceremony("authentication").is_none());
        assert!(data.take_ceremony("registration").is_none());
    }
}
