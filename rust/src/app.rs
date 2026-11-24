//! Routeur HTTP, état applicatif et handlers.
//!
//! Le découpage suit `server.js` : un routeur public (accueil, enrôlement,
//! cérémonies WebAuthn), puis un routeur protégé par le middleware de session
//! qui porte l'application (pages, outline, administration).

use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use axum::extract::{DefaultBodyLimit, Extension, Path, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode, Uri};
use axum::middleware;
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};
use bytes::Bytes;
use serde_json::{json, Value};
use tokio::sync::Mutex;
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;
use tracing::{error, warn};
use uuid::Uuid;

use crate::accounts::{self, Account, Passkey};
use crate::config::Config;
use crate::html::{self, ArchiveSummary};
use crate::mailer::Mailer;
use crate::migration;
use crate::model::{
    self, create_node, create_node_after, create_project_at_head, delete_node, make_domain,
    move_domain, move_node, next_order, next_theme_color, normalize_domain, reindent_node,
    set_domain_label, set_status, slugify, toggle_collapse, Domain, Theme, VALID_STATUSES,
};
use crate::otp::{self, OtpStore, RequestOutcome, VerifyOutcome};
use crate::passkey::{self, RegistrationCredential};
use crate::session::{self, now_iso, require_auth, AuthUser, SessionData, SessionStore};
use crate::space::{self, HomeOrder, SharedSpace, Space};
use crate::storage::{self, Storage};

const BACKUP_FORMAT: &str = "docdoc-backup";
const BACKUP_VERSION: i64 = 1;
const BACKUP_MAX_BYTES: usize = 10 * 1024 * 1024;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub storage: Arc<Storage>,
    pub sessions: Arc<SessionStore>,
    pub otp: Arc<OtpStore>,
    pub mailer: Arc<Mailer>,
    pub spaces: Arc<Mutex<HashMap<String, SharedSpace>>>,
}

impl AppState {
    pub fn new(config: Config) -> AppState {
        let storage = Storage::from_config(&config);
        let sessions = SessionStore::new(config.session_secret.clone());
        let mailer = Mailer::new(config.mail.clone());
        AppState {
            config: Arc::new(config),
            storage: Arc::new(storage),
            sessions: Arc::new(sessions),
            otp: Arc::new(OtpStore::new()),
            mailer: Arc::new(mailer),
            spaces: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn space_for(&self, user_id: &str, email: &str) -> SharedSpace {
        if let Some(existing) = self.spaces.lock().await.get(user_id).cloned() {
            return existing;
        }
        let loaded = Space::load(&self.storage, user_id, email).await;
        let handle = Arc::new(Mutex::new(loaded));
        self.spaces
            .lock()
            .await
            .insert(user_id.to_string(), handle.clone());
        handle
    }

    pub async fn invalidate_space(&self, user_id: &str) {
        self.spaces.lock().await.remove(user_id);
    }
}

/* ------------------------------------------------------------------ */
/* Réponses utilitaires                                                */
/* ------------------------------------------------------------------ */

fn html_response(status: StatusCode, body: String) -> Response {
    (
        status,
        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
        body,
    )
        .into_response()
}

fn text_response(status: StatusCode, body: &str) -> Response {
    (status, body.to_string()).into_response()
}

fn json_response(status: StatusCode, value: Value) -> Response {
    (status, Json(value)).into_response()
}

fn with_cookie(mut response: Response, cookie: String) -> Response {
    if let Ok(value) = HeaderValue::from_str(&cookie) {
        response.headers_mut().append(header::SET_COOKIE, value);
    }
    response
}

fn header_value<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|value| value.to_str().ok())
}

fn is_htmx(headers: &HeaderMap) -> bool {
    header_value(headers, "HX-Request") == Some("true")
}

fn query_params(uri: &Uri) -> HashMap<String, String> {
    uri.query()
        .and_then(|query| serde_urlencoded::from_str(query).ok())
        .unwrap_or_default()
}

fn boundary_params(headers: &HeaderMap, body: &Bytes) -> HashMap<String, String> {
    let content_type = header_value(headers, header::CONTENT_TYPE.as_str()).unwrap_or("");
    if content_type.contains("application/json") {
        let Ok(Value::Object(object)) = serde_json::from_slice::<Value>(body) else {
            return HashMap::new();
        };
        return object
            .into_iter()
            .map(|(key, value)| {
                let value = match value {
                    Value::String(text) => text,
                    Value::Null => String::new(),
                    other => other.to_string(),
                };
                (key, value)
            })
            .collect();
    }
    serde_urlencoded::from_bytes(body).unwrap_or_default()
}

fn json_body(body: &Bytes) -> Value {
    serde_json::from_slice(body).unwrap_or(Value::Null)
}

fn back_to(headers: &HeaderMap) -> String {
    header_value(headers, header::REFERER.as_str())
        .unwrap_or("/")
        .to_string()
}

fn redirect_after(params: &HashMap<String, String>, default: &str) -> Response {
    let target = params
        .get("returnTo")
        .filter(|value| value.as_str() == "/administration")
        .map(|_| "/administration")
        .unwrap_or(default);
    session::redirect(target)
}

// A return target is trusted only as a same-origin absolute path: one leading
// slash, no protocol-relative `//`, no backslash and no control character. The
// sidebar's move forms render the current page path, but the POST body is
// user-controlled, so the value is still validated before a redirect.
fn local_path(value: &str) -> Option<&str> {
    if !value.starts_with('/') || value.starts_with("//") {
        return None;
    }
    if value.contains('\\') || value.chars().any(char::is_control) {
        return None;
    }
    Some(value)
}

fn client_ip(headers: &HeaderMap) -> Option<String> {
    if let Some(forwarded) = header_value(headers, "x-forwarded-for") {
        if let Some(first) = forwarded.split(',').next() {
            let first = first.trim();
            if !first.is_empty() {
                return Some(first.to_string());
            }
        }
    }
    header_value(headers, "x-real-ip").map(str::to_string)
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

pub fn build_router(state: AppState) -> Router {
    let public = Router::new()
        .route("/", get(public_home))
        .route("/manifest.webmanifest", get(manifest))
        .route("/sw.js", get(service_worker))
        .route("/auth/signup", get(signup_page))
        .route("/auth/email", post(request_code))
        .route("/auth/email/resend", post(resend_code))
        .route("/auth/email/verify", post(verify_code))
        .route("/auth/cancel", post(cancel_enrollment))
        .route(
            "/auth/passkey/register/options",
            post(registration_options_route),
        )
        .route(
            "/auth/passkey/register/verify",
            post(registration_verify_route),
        )
        .route(
            "/auth/passkey/login/options",
            post(authentication_options_route),
        )
        .route(
            "/auth/passkey/login/verify",
            post(authentication_verify_route),
        )
        .route("/api/me", get(me))
        .route("/logout", post(logout));

    // The restore route gets its own 10 MiB body limit; the other routes keep
    // axum's default. It is merged into the protected router so the session
    // guard still applies to it.
    let restore_route = Router::new()
        .route("/api/restore", post(restore_backup_route))
        .layer(DefaultBodyLimit::max(BACKUP_MAX_BYTES));

    let protected = Router::new()
        .route("/administration", get(admin_page))
        .route("/aide", get(guide_page))
        .route("/auth/passkeys", get(passkeys_page))
        .route("/auth/passkeys/rename", post(rename_passkey_route))
        .route("/auth/passkeys/revoke", post(revoke_passkey_route))
        .route("/api/backup", get(export_backup_route))
        .route("/api/home/order", post(home_order_route))
        .route("/domaine/{slug}", get(domain_page))
        .route("/domaine/{slug}/outline-fragment", get(outline_fragment))
        .route("/domaine/{slug}/api/outline", get(outline_json))
        .route("/domaine/{slug}/api/nodes", post(create_node_route))
        .route("/domaine/{slug}/api/nodes/{id}", get(get_node_route))
        .route("/domaine/{slug}/api/nodes/{id}", put(rename_node_route))
        .route("/domaine/{slug}/api/nodes/{id}", delete(delete_node_route))
        .route("/domaine/{slug}/api/nodes/{id}/next", post(next_node_route))
        .route("/domaine/{slug}/api/nodes/{id}/status", post(status_route))
        .route("/domaine/{slug}/api/nodes/{id}/toggle", post(toggle_route))
        .route("/domaine/{slug}/api/nodes/{id}/indent", post(indent_route))
        .route(
            "/domaine/{slug}/api/nodes/{id}/outdent",
            post(outdent_route),
        )
        .route("/domaine/{slug}/api/nodes/{id}/move", post(move_route))
        .route("/domaine/{slug}/api/labels", post(domain_labels_route))
        .route("/api/domains", post(create_domain_route))
        .route("/api/domains/{id}/rename", post(rename_domain_route))
        .route("/api/domains/{id}/archive", post(archive_domain_route))
        .route("/api/domains/{id}/move", post(move_domain_route))
        .route("/api/themes", post(create_theme_route))
        .route("/api/themes/{id}/rename", post(rename_theme_route))
        .route("/api/themes/{id}/delete", post(delete_theme_route))
        .route("/api/themes/{id}/move", post(move_theme_route))
        .route("/api/themes/{id}/labels", post(theme_labels_route))
        .route("/api/archives/{id}/restore", post(restore_archive_route))
        .route("/api/archives/{id}/purge", post(purge_archive_route))
        .merge(restore_route)
        .route_layer(middleware::from_fn_with_state(state.clone(), require_auth));

    let static_dir = state.config.public_dir.clone();
    Router::new()
        .merge(public)
        .merge(protected)
        .fallback_service(ServeDir::new(static_dir))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/* ------------------------------------------------------------------ */
/* Fichiers d'installabilité et accueil public                         */
/* ------------------------------------------------------------------ */

async fn manifest(State(state): State<AppState>) -> Response {
    static_file(&state, "manifest.webmanifest", "application/manifest+json").await
}

async fn service_worker(State(state): State<AppState>) -> Response {
    static_file(&state, "sw.js", "text/javascript").await
}

async fn static_file(state: &AppState, name: &str, content_type: &str) -> Response {
    match tokio::fs::read(state.config.public_dir.join(name)).await {
        Ok(body) => (
            StatusCode::OK,
            [
                (header::CONTENT_TYPE, content_type.to_string()),
                (header::CACHE_CONTROL, "no-cache".to_string()),
            ],
            body,
        )
            .into_response(),
        Err(err) => {
            error!("lecture de {name}: {err}");
            text_response(StatusCode::NOT_FOUND, "Introuvable")
        }
    }
}

async fn public_home(State(state): State<AppState>, headers: HeaderMap, uri: Uri) -> Response {
    let query = query_params(&uri);
    if let Some((session_id, data)) = state.sessions.load(&headers).await {
        if let Some(user_id) = data.user_id {
            let email = data.email.unwrap_or_default();
            let handle = state.space_for(&user_id, &email).await;
            let body = {
                let space = handle.lock().await;
                html::render_home_page(&space)
            };
            let mut response = html_response(StatusCode::OK, body);
            if state.sessions.touch(&session_id).await.is_some() {
                response = with_cookie(
                    response,
                    state
                        .sessions
                        .cookie_header(&session_id, state.config.is_production),
                );
            }
            return response;
        }
    }
    let notice = query.get("deconnecte").map(|_| "Vous êtes déconnecté.");
    html_response(StatusCode::OK, html::render_auth_home(notice, None))
}

async fn signup_page(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Some((_, data)) = state.sessions.load(&headers).await {
        if data.is_signed_in() {
            return session::redirect("/");
        }
    }
    html_response(StatusCode::OK, html::render_email_form(None, None))
}

/* ------------------------------------------------------------------ */
/* Enrôlement par code email                                           */
/* ------------------------------------------------------------------ */

async fn load_or_create_session(
    state: &AppState,
    headers: &HeaderMap,
) -> (String, SessionData, bool) {
    if let Some((id, data)) = state.sessions.load(headers).await {
        return (id, data, false);
    }
    let (id, data) = state.sessions.create().await;
    (id, data, true)
}

async fn request_code(State(state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    let params = boundary_params(&headers, &body);
    let raw_email = params.get("email").cloned().unwrap_or_default();
    let email = accounts::normalize_email(Some(&raw_email));

    if email.is_empty() || !otp::is_valid_email(&email) {
        return html_response(
            StatusCode::BAD_REQUEST,
            html::render_email_form(Some(&raw_email), Some("Adresse email invalide.")),
        );
    }
    if !state
        .config
        .authorized_emails
        .iter()
        .any(|authorized| authorized == &email)
    {
        return html_response(
            StatusCode::FORBIDDEN,
            html::render_email_form(Some(&email), Some("Vous n'êtes pas habilité sur docdoc.")),
        );
    }

    let (session_id, mut data, new) = load_or_create_session(&state, &headers).await;
    let issued = state
        .otp
        .request_code(&email, client_ip(&headers).as_deref())
        .await;
    match issued {
        RequestOutcome::Cooldown {
            retry_after_seconds,
        } => {
            data.pending_email = Some(email.clone());
            state.sessions.save(&session_id, &data).await;
            let response = html_response(
                StatusCode::TOO_MANY_REQUESTS,
                html::render_code_form(
                    &email,
                    delivery_mode(&state),
                    None,
                    Some(&format!(
                        "Un code a déjà été envoyé. Patientez {retry_after_seconds} s avant d'en demander un autre."
                    )),
                ),
            );
            finish_cookie(&state, response, &session_id, new)
        }
        RequestOutcome::RateLimited {
            retry_after_seconds,
        } => html_response(
            StatusCode::TOO_MANY_REQUESTS,
            html::render_email_form(
                Some(&email),
                Some(&format!(
                    "Trop de demandes de code. Réessayez dans {retry_after_seconds} s."
                )),
            ),
        ),
        RequestOutcome::Issued { code, .. } => {
            data.pending_email = Some(email.clone());
            state.sessions.save(&session_id, &data).await;
            let delivery = state.mailer.send_code(&email, &code, 10).await;
            if !delivery.ok {
                let response = html_response(
                    StatusCode::BAD_GATEWAY,
                    html::render_email_form(
                        Some(&email),
                        Some("Le code n'a pas pu être envoyé. Réessayez dans un instant."),
                    ),
                );
                return finish_cookie(&state, response, &session_id, new);
            }
            let response = html_response(
                StatusCode::OK,
                html::render_code_form(&email, delivery_mode(&state), Some("Code envoyé."), None),
            );
            finish_cookie(&state, response, &session_id, new)
        }
    }
}

fn delivery_mode(state: &AppState) -> &'static str {
    if state.mailer.is_dev_mode() {
        "log"
    } else {
        "email"
    }
}

fn finish_cookie(state: &AppState, response: Response, session_id: &str, new: bool) -> Response {
    if new {
        with_cookie(
            response,
            state
                .sessions
                .cookie_header(session_id, state.config.is_production),
        )
    } else {
        response
    }
}

async fn resend_code(State(state): State<AppState>, headers: HeaderMap, _body: Bytes) -> Response {
    let Some((session_id, data)) = state.sessions.load(&headers).await else {
        return html_response(
            StatusCode::BAD_REQUEST,
            html::render_email_form(None, Some("Commencez par indiquer votre adresse email.")),
        );
    };
    let Some(email) = data.pending_email.clone() else {
        return html_response(
            StatusCode::BAD_REQUEST,
            html::render_email_form(None, Some("Commencez par indiquer votre adresse email.")),
        );
    };
    if !state
        .config
        .authorized_emails
        .iter()
        .any(|authorized| authorized == &email)
    {
        return html_response(
            StatusCode::FORBIDDEN,
            html::render_email_form(Some(&email), Some("Vous n'êtes pas habilité sur docdoc.")),
        );
    }

    match state
        .otp
        .request_code(&email, client_ip(&headers).as_deref())
        .await
    {
        RequestOutcome::Cooldown {
            retry_after_seconds,
        } => html_response(
            StatusCode::TOO_MANY_REQUESTS,
            html::render_code_form(
                &email,
                delivery_mode(&state),
                None,
                Some(&format!(
                    "Un code valide est déjà en cours. Patientez {retry_after_seconds} s."
                )),
            ),
        ),
        RequestOutcome::RateLimited {
            retry_after_seconds,
        } => html_response(
            StatusCode::TOO_MANY_REQUESTS,
            html::render_code_form(
                &email,
                delivery_mode(&state),
                None,
                Some(&format!(
                    "Trop de demandes de code. Réessayez dans {retry_after_seconds} s."
                )),
            ),
        ),
        RequestOutcome::Issued { code, .. } => {
            let delivery = state.mailer.send_code(&email, &code, 10).await;
            if !delivery.ok {
                return html_response(
                    StatusCode::BAD_GATEWAY,
                    html::render_code_form(
                        &email,
                        delivery_mode(&state),
                        None,
                        Some("Le code n'a pas pu être envoyé. Réessayez dans un instant."),
                    ),
                );
            }
            // La session n'a pas changé de contenu, mais la sauvegarde garde le
            // TTL glissant cohérent avec le reste du parcours.
            state.sessions.save(&session_id, &data).await;
            html_response(
                StatusCode::OK,
                html::render_code_form(
                    &email,
                    delivery_mode(&state),
                    Some("Un nouveau code a été envoyé ; le précédent n’est plus valable."),
                    None,
                ),
            )
        }
    }
}

async fn verify_code(State(state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    let Some((session_id, mut data)) = state.sessions.load(&headers).await else {
        return html_response(
            StatusCode::BAD_REQUEST,
            html::render_email_form(None, Some("Commencez par indiquer votre adresse email.")),
        );
    };
    let Some(email) = data.pending_email.clone() else {
        return html_response(
            StatusCode::BAD_REQUEST,
            html::render_email_form(None, Some("Commencez par indiquer votre adresse email.")),
        );
    };
    let params = boundary_params(&headers, &body);
    let code = params.get("code").cloned().unwrap_or_default();
    match state.otp.verify_code(&email, &code).await {
        VerifyOutcome::Ok => {}
        outcome => {
            let message = match outcome {
                VerifyOutcome::Mismatch => "Code incorrect.",
                VerifyOutcome::Expired => "Ce code a expiré. Demandez-en un nouveau.",
                VerifyOutcome::Used => "Ce code a déjà été utilisé. Demandez-en un nouveau.",
                VerifyOutcome::Attempts => {
                    "Trop de tentatives : ce code est invalidé. Demandez-en un nouveau."
                }
                VerifyOutcome::None => {
                    "Aucun code en cours pour cette adresse. Demandez-en un nouveau."
                }
                VerifyOutcome::Ok => unreachable!(),
            };
            let status = if outcome == VerifyOutcome::Attempts {
                StatusCode::TOO_MANY_REQUESTS
            } else {
                StatusCode::BAD_REQUEST
            };
            return html_response(
                status,
                html::render_code_form(&email, delivery_mode(&state), None, Some(message)),
            );
        }
    }

    data.pending_email = None;
    data.enrollment = Some(session::Enrollment {
        email: email.clone(),
        user_id: Uuid::new_v4().to_string(),
        verified_at: session::now_ms(),
        expires_at: session::now_ms() + session::ENROLLMENT_TTL_MS,
    });
    state.sessions.save(&session_id, &data).await;
    html_response(StatusCode::OK, html::render_passkey_enrollment(None))
}

async fn cancel_enrollment(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Some((session_id, mut data)) = state.sessions.load(&headers).await {
        data.pending_email = None;
        data.enrollment = None;
        data.ceremony = None;
        state.sessions.save(&session_id, &data).await;
    }
    session::redirect("/")
}

/* ------------------------------------------------------------------ */
/* WebAuthn                                                            */
/* ------------------------------------------------------------------ */

fn relying_party(state: &AppState, headers: &HeaderMap) -> Result<(String, String), Response> {
    let host = header_value(headers, header::HOST.as_str());
    let proto = header_value(headers, "x-forwarded-proto");
    state.config.relying_party(host, proto).map_err(|message| {
        json_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            json!({ "error": message }),
        )
    })
}

async fn registration_options_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    _body: Bytes,
) -> Response {
    let Some((session_id, mut data)) = state.sessions.load(&headers).await else {
        return json_response(
            StatusCode::UNAUTHORIZED,
            json!({ "error": "Aucun enrôlement en cours. Recommencez la demande de code." }),
        );
    };
    let signed_user = data.user_id.clone();
    let enrollment = data.valid_enrollment().cloned();
    if signed_user.is_none() && enrollment.is_none() {
        return json_response(
            StatusCode::UNAUTHORIZED,
            json!({ "error": "Aucun enrôlement en cours. Recommencez la demande de code." }),
        );
    }
    let (rp_id, _origin) = match relying_party(&state, &headers) {
        Ok(value) => value,
        Err(response) => return response,
    };

    let options = if let Some(user_id) = signed_user {
        let Some(account) = accounts::get_account(&state.storage, &user_id).await else {
            return json_response(
                StatusCode::UNAUTHORIZED,
                json!({ "error": "Compte introuvable." }),
            );
        };
        passkey::registration_options(&rp_id, &account.user_id, &account.email, &account.passkeys)
    } else {
        let Some(enrollment) = enrollment else {
            return json_response(
                StatusCode::UNAUTHORIZED,
                json!({ "error": "Enrôlement expiré. Recommencez la demande de code." }),
            );
        };
        let existing = accounts::get_account_by_email(&state.storage, &enrollment.email).await;
        match existing {
            Some(account) => passkey::registration_options(
                &rp_id,
                &account.user_id,
                &enrollment.email,
                &account.passkeys,
            ),
            None => {
                passkey::registration_options(&rp_id, &enrollment.user_id, &enrollment.email, &[])
            }
        }
    };

    if let Some(challenge) = options.get("challenge").and_then(Value::as_str) {
        data.put_ceremony("registration", challenge.to_string());
    }
    state.sessions.save(&session_id, &data).await;
    json_response(StatusCode::OK, options)
}

async fn registration_verify_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let Some((session_id, mut data)) = state.sessions.load(&headers).await else {
        return json_response(
            StatusCode::UNAUTHORIZED,
            json!({ "error": "Aucun enrôlement en cours. Recommencez la demande de code." }),
        );
    };
    let signed_user = data.user_id.clone();
    let enrollment = data.valid_enrollment().cloned();
    if signed_user.is_none() && enrollment.is_none() {
        return json_response(
            StatusCode::UNAUTHORIZED,
            json!({ "error": "Aucun enrôlement en cours. Recommencez la demande de code." }),
        );
    }
    let ceremony = data.take_ceremony("registration");
    state.sessions.save(&session_id, &data).await;
    let Some(ceremony) = ceremony else {
        return json_response(
            StatusCode::BAD_REQUEST,
            json!({ "error": "Cérémonie expirée ou inconnue. Recommencez." }),
        );
    };
    let (rp_id, origin) = match relying_party(&state, &headers) {
        Ok(value) => value,
        Err(response) => return response,
    };
    let response_json = json_body(&body);
    let credential =
        match passkey::verify_registration(&rp_id, &origin, &response_json, &ceremony.challenge) {
            Ok(credential) => credential,
            Err(err) => {
                error!("vérification d'attestation: {err}");
                return json_response(
                    StatusCode::BAD_REQUEST,
                    json!({ "error": "L'enregistrement de la passkey a échoué." }),
                );
            }
        };
    let label = first_label(&response_json);
    let stored = passkey_from_credential(credential, label);

    if let Some(user_id) = signed_user {
        let Some(mut account) = accounts::get_account(&state.storage, &user_id).await else {
            return json_response(
                StatusCode::UNAUTHORIZED,
                json!({ "error": "Compte introuvable." }),
            );
        };
        if let Err(err) = accounts::add_passkey(&state.storage, &mut account, stored).await {
            error!("ajout de passkey: {err}");
            return json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                json!({ "error": "Le compte n’a pas pu être enregistré." }),
            );
        }
        return json_response(
            StatusCode::OK,
            json!({ "ok": true, "redirect": "/auth/passkeys" }),
        );
    }

    let Some(enrollment) = enrollment else {
        return json_response(
            StatusCode::UNAUTHORIZED,
            json!({ "error": "Enrôlement expiré. Recommencez la demande de code." }),
        );
    };
    let (mut account, created) = match accounts::ensure_account(
        &state.storage,
        &enrollment.email,
        Some(&enrollment.user_id),
    )
    .await
    {
        Ok(value) => value,
        Err(err) => {
            error!("création du compte: {err}");
            return json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                json!({ "error": "Le compte n’a pas pu être créé." }),
            );
        }
    };
    if let Err(err) = accounts::add_passkey(&state.storage, &mut account, stored).await {
        error!("ajout de passkey: {err}");
        return json_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            json!({ "error": "Le compte n’a pas pu être créé." }),
        );
    }
    account_ready(&state, &account, created).await;

    state.sessions.destroy(&session_id).await;
    let (new_id, mut fresh) = state.sessions.create().await;
    fresh.user_id = Some(account.user_id.clone());
    fresh.email = Some(account.email.clone());
    state.sessions.save(&new_id, &fresh).await;
    with_cookie(
        json_response(StatusCode::OK, json!({ "ok": true, "redirect": "/" })),
        state
            .sessions
            .cookie_header(&new_id, state.config.is_production),
    )
}

fn first_label(response: &Value) -> String {
    response
        .get("deviceLabel")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Passkey")
        .to_string()
}

fn passkey_from_credential(credential: RegistrationCredential, label: String) -> Passkey {
    Passkey {
        id: credential.id,
        public_key: credential.public_key,
        counter: credential.counter,
        transports: credential.transports,
        label,
        device_type: credential.device_type,
        backed_up: credential.backed_up,
        created_at: now_iso(),
        last_used_at: None,
    }
}

async fn account_ready(state: &AppState, account: &Account, created: bool) {
    if created {
        let summary =
            migration::adopt_legacy_data(&state.storage, &state.config.data_dir, &account.user_id)
                .await;
        println!(
            "[docdoc] espace créé pour {} : {} domaine(s) et {} archive(s) adoptés{}{}",
            account.email,
            summary.domains,
            summary.archive,
            if summary.themes {
                ", palette reprise"
            } else {
                ""
            },
            if summary.imported > 0 {
                format!(", {} fichier(s) local(aux) importé(s)", summary.imported)
            } else {
                String::new()
            }
        );
    }
    state.invalidate_space(&account.user_id).await;
}

async fn authentication_options_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let (rp_id, _origin) = match relying_party(&state, &headers) {
        Ok(value) => value,
        Err(response) => return response,
    };
    let (session_id, mut data, new) = load_or_create_session(&state, &headers).await;
    let params = json_body(&body);
    let email = accounts::normalize_email(params.get("email").and_then(Value::as_str));
    let account = if email.is_empty() {
        None
    } else {
        accounts::get_account_by_email(&state.storage, &email).await
    };
    let options = passkey::authentication_options(&rp_id, account.as_ref());
    if let Some(challenge) = options.get("challenge").and_then(Value::as_str) {
        data.put_ceremony("authentication", challenge.to_string());
    }
    state.sessions.save(&session_id, &data).await;
    let response = json_response(StatusCode::OK, options);
    finish_cookie(&state, response, &session_id, new)
}

async fn authentication_verify_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let Some((session_id, mut data)) = state.sessions.load(&headers).await else {
        return json_response(
            StatusCode::BAD_REQUEST,
            json!({ "error": "Cérémonie expirée. Réessayez." }),
        );
    };
    let ceremony = data.take_ceremony("authentication");
    state.sessions.save(&session_id, &data).await;
    let Some(ceremony) = ceremony else {
        return json_response(
            StatusCode::BAD_REQUEST,
            json!({ "error": "Cérémonie expirée. Réessayez." }),
        );
    };
    let response_json = json_body(&body);
    let credential_id = response_json
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let Some(mut account) =
        accounts::get_account_by_credential(&state.storage, &credential_id).await
    else {
        return json_response(
            StatusCode::UNAUTHORIZED,
            json!({ "error": "Passkey inconnue." }),
        );
    };
    let Some(passkey) = accounts::find_passkey(&account, &credential_id).cloned() else {
        return json_response(
            StatusCode::UNAUTHORIZED,
            json!({ "error": "Passkey inconnue." }),
        );
    };
    let (rp_id, origin) = match relying_party(&state, &headers) {
        Ok(value) => value,
        Err(response) => return response,
    };
    let result = match passkey::verify_authentication(
        &rp_id,
        &origin,
        &response_json,
        &ceremony.challenge,
        &passkey,
    ) {
        Ok(result) => result,
        Err(err) => {
            warn!("vérification d'assertion: {err}");
            return json_response(
                StatusCode::UNAUTHORIZED,
                json!({ "error": "Connexion refusée." }),
            );
        }
    };
    if result.counter_anomaly {
        warn!(
            "compteur de signature non croissant pour la passkey {} du compte {}",
            credential_id, account.user_id
        );
    }
    let _ = accounts::touch_passkey(
        &state.storage,
        &mut account,
        &credential_id,
        result.new_counter,
    )
    .await;
    account_ready(&state, &account, false).await;

    state.sessions.destroy(&session_id).await;
    let (new_id, mut fresh) = state.sessions.create().await;
    fresh.user_id = Some(account.user_id.clone());
    fresh.email = Some(account.email.clone());
    state.sessions.save(&new_id, &fresh).await;
    with_cookie(
        json_response(StatusCode::OK, json!({ "ok": true, "redirect": "/" })),
        state
            .sessions
            .cookie_header(&new_id, state.config.is_production),
    )
}

/* ------------------------------------------------------------------ */
/* Passkeys du compte                                                  */
/* ------------------------------------------------------------------ */

async fn passkeys_page(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    uri: Uri,
) -> Response {
    let Some(account) = accounts::get_account(&state.storage, &auth.user_id).await else {
        return session::redirect("/logout");
    };
    let query = query_params(&uri);
    let notice = query.get("ok").map(|_| "C'est fait.");
    let error = query.get("erreur").map(String::as_str);
    html_response(
        StatusCode::OK,
        html::render_passkeys(&account, notice, error),
    )
}

async fn rename_passkey_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let Some(mut account) = accounts::get_account(&state.storage, &auth.user_id).await else {
        return session::redirect("/");
    };
    let params = boundary_params(&headers, &body);
    let credential_id = params.get("credentialId").cloned().unwrap_or_default();
    let label = params.get("label").cloned().unwrap_or_default();
    match accounts::rename_passkey(&state.storage, &mut account, &credential_id, &label).await {
        Ok(Some(_)) => session::redirect("/auth/passkeys?ok=1"),
        _ => session::redirect(&format!(
            "/auth/passkeys?erreur={}",
            urlencoding::encode("Nom invalide")
        )),
    }
}

async fn revoke_passkey_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let Some(mut account) = accounts::get_account(&state.storage, &auth.user_id).await else {
        return session::redirect("/");
    };
    if account.passkeys.len() <= 1 {
        return session::redirect(&format!(
            "/auth/passkeys?erreur={}",
            urlencoding::encode(
                "Impossible de révoquer la dernière passkey : enregistrez-en une autre d’abord."
            )
        ));
    }
    let params = boundary_params(&headers, &body);
    let credential_id = params.get("credentialId").cloned().unwrap_or_default();
    let _ = accounts::remove_passkey(&state.storage, &mut account, &credential_id).await;
    session::redirect("/auth/passkeys?ok=1")
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

async fn me(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Some((_, data)) = state.sessions.load(&headers).await {
        if data.is_signed_in() {
            return json_response(
                StatusCode::OK,
                json!({ "authenticated": true, "email": data.email }),
            );
        }
    }
    json_response(StatusCode::UNAUTHORIZED, json!({ "authenticated": false }))
}

async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let mut response = session::redirect("/?deconnecte=1");
    if let Some((session_id, _)) = state.sessions.load(&headers).await {
        state.sessions.destroy(&session_id).await;
    }
    let cookie = state
        .sessions
        .clear_cookie_header(state.config.is_production);
    response = with_cookie(response, cookie);
    response
}

/* ------------------------------------------------------------------ */
/* Pages de l'application                                              */
/* ------------------------------------------------------------------ */

async fn admin_page(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    uri: Uri,
) -> Response {
    let restored = query_params(&uri)
        .get("restaure")
        .map(|value| value == "ok")
        .unwrap_or(false);
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let space = handle.lock().await;
    let archives = list_archives(&state, &space).await;
    html_response(
        StatusCode::OK,
        html::render_admin_page(&space, &archives, restored),
    )
}

async fn list_archives(state: &AppState, space: &Space) -> Vec<ArchiveSummary> {
    let keys = state.storage.list_archive_keys(&space.user_id).await;
    let mut archives = Vec::new();
    for key in keys {
        let Some(parsed) = state.storage.read_json(&key).await else {
            continue;
        };
        if !parsed.is_object() {
            continue;
        }
        let Some(id) = parsed.get("id").and_then(Value::as_str) else {
            continue;
        };
        let Some(name) = parsed.get("name").and_then(Value::as_str) else {
            continue;
        };
        let labels = parsed
            .get("labels")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default();
        archives.push(ArchiveSummary {
            id: id.to_string(),
            name: name.to_string(),
            labels,
        });
    }
    archives.sort_by(|a, b| a.name.cmp(&b.name));
    archives
}

/* ------------------------------------------------------------------ */
/* Sauvegarde JSON de l'espace                                         */
/* ------------------------------------------------------------------ */

struct ValidatedBackup {
    themes: Vec<Theme>,
    domains: Vec<Domain>,
    archives: Vec<Domain>,
    home_order: HomeOrder,
}

async fn read_archived_domains(state: &AppState, space: &Space) -> Vec<Domain> {
    let keys = state.storage.list_archive_keys(&space.user_id).await;
    let mut archives = Vec::new();
    for key in keys {
        let Some(parsed) = state.storage.read_json(&key).await else {
            continue;
        };
        if !parsed.is_object() {
            continue;
        }
        if let Some(domain) = normalize_domain(&space.themes, &parsed) {
            archives.push(domain);
        }
    }
    archives.sort_by(|a, b| a.name.cmp(&b.name).then_with(|| a.id.cmp(&b.id)));
    archives
}

fn validate_backup_nodes(
    nodes: &Value,
    domain_name: &str,
    seen: &mut HashSet<String>,
) -> Result<(), String> {
    let items = nodes.as_array().ok_or_else(|| {
        format!("Le domaine « {domain_name} » contient une liste de tâches invalide.")
    })?;
    for raw in items {
        let object = raw
            .as_object()
            .ok_or_else(|| format!("Une tâche du domaine « {domain_name} » n'est pas un objet."))?;
        let id = object
            .get("id")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                format!("Une tâche du domaine « {domain_name} » n'a pas d'identifiant.")
            })?;
        if !seen.insert(id.to_string()) {
            return Err(format!(
                "L'identifiant de tâche « {id} » est dupliqué dans le domaine « {domain_name} »."
            ));
        }
        if let Some(title) = object.get("title") {
            if !title.is_string() {
                return Err(format!(
                    "Le titre de la tâche « {id} » du domaine « {domain_name} » n'est pas textuel."
                ));
            }
        }
        if let Some(status) = object.get("status") {
            // `someday` is a legacy value: backups exported before the
            // reduction to three project states still contain it and are
            // normalized to `todo` when the domain is loaded.
            let valid = status
                .as_str()
                .map(|value| VALID_STATUSES.contains(&value) || value == "someday")
                .unwrap_or(false);
            if !valid {
                return Err(format!(
                    "Statut inconnu pour la tâche « {id} » du domaine « {domain_name} »."
                ));
            }
        }
        if let Some(collapsed) = object.get("collapsed") {
            if !collapsed.is_boolean() {
                return Err(format!(
                    "L'état de repli de la tâche « {id} » du domaine « {domain_name} » est invalide."
                ));
            }
        }
        if let Some(children) = object.get("children") {
            if !children.is_array() {
                return Err(format!(
                    "Les sous-tâches de « {id} » du domaine « {domain_name} » ne sont pas une liste."
                ));
            }
            validate_backup_nodes(children, domain_name, seen)?;
        }
    }
    Ok(())
}

fn validate_backup_domain(
    raw: &Value,
    kind: &str,
    theme_ids: &HashSet<String>,
    ids: &mut HashSet<String>,
    active_slugs: &mut HashSet<String>,
) -> Result<(), String> {
    let object = raw
        .as_object()
        .ok_or_else(|| format!("Un {kind} de la sauvegarde n'est pas un objet."))?;
    let id = object
        .get("id")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("Un {kind} de la sauvegarde n'a pas d'identifiant."))?;
    if !ids.insert(id.to_string()) {
        return Err(format!(
            "Identifiant de {kind} dupliqué dans la sauvegarde : « {id} »."
        ));
    }
    let name = object
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("Le nom du {kind} « {id} » n'est pas textuel."))?;
    let slug = object
        .get("slug")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("Le slug du {kind} « {name} » n'est pas textuel."))?;
    if object.get("order").and_then(Value::as_f64).is_none() {
        return Err(format!("L'ordre du {kind} « {name} » n'est pas un nombre."));
    }
    let labels = object
        .get("labels")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("Les libellés du {kind} « {name} » ne sont pas une liste."))?;
    for label in labels {
        let label = label
            .as_str()
            .ok_or_else(|| format!("Un libellé du {kind} « {name} » n'est pas textuel."))?;
        if !theme_ids.contains(label) {
            return Err(format!(
                "Le libellé « {label} » du {kind} « {name} » ne correspond à aucun thème."
            ));
        }
    }
    if let Some(display_order) = object.get("displayOrder") {
        let items = display_order
            .as_array()
            .ok_or_else(|| format!("L'ordre d'affichage du {kind} « {name} » est invalide."))?;
        if items.iter().any(|item| !item.is_string()) {
            return Err(format!(
                "L'ordre d'affichage du {kind} « {name} » est invalide."
            ));
        }
    }
    let projects = object
        .get("projects")
        .filter(|value| value.is_array())
        .ok_or_else(|| format!("Le {kind} « {name} » n'a pas de liste de projets."))?;
    let mut seen = HashSet::new();
    validate_backup_nodes(projects, name, &mut seen)?;
    if kind == "domaine" && !active_slugs.insert(slug.to_string()) {
        return Err(format!(
            "Deux domaines actifs partagent le slug « {slug} »."
        ));
    }
    Ok(())
}

fn validate_backup_home_list(raw: Option<&Value>, rubrique: &str) -> Result<Vec<String>, String> {
    let Some(raw) = raw else {
        return Ok(Vec::new());
    };
    let items = raw
        .as_array()
        .ok_or_else(|| format!("L'ordre de la rubrique « {rubrique} » n'est pas une liste."))?;
    let mut seen = HashSet::new();
    let mut list = Vec::new();
    for item in items {
        let id = item
            .as_str()
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                format!(
                    "Un identifiant de l'ordre de la rubrique « {rubrique} » n'est pas textuel."
                )
            })?;
        if seen.insert(id.to_string()) {
            list.push(id.to_string());
        }
    }
    Ok(list)
}

// A document written before `homeOrder` existed has no such field: it restores
// an empty order, which is the intended "replace everything" behavior.
fn validate_backup_home_order(raw: Option<&Value>) -> Result<HomeOrder, String> {
    let Some(raw) = raw else {
        return Ok(HomeOrder::default());
    };
    let object = raw
        .as_object()
        .ok_or("L'ordre manuel de la page d'accueil n'est pas un objet.")?;
    let mut order = HomeOrder::default();
    order.in_progress = validate_backup_home_list(object.get("in_progress"), "in_progress")?;
    order.waiting = validate_backup_home_list(object.get("waiting"), "waiting")?;
    Ok(order)
}

fn validate_backup(doc: &Value) -> Result<ValidatedBackup, String> {
    let object = doc
        .as_object()
        .ok_or("Le document n'est pas un objet JSON.")?;
    if object.get("format").and_then(Value::as_str) != Some(BACKUP_FORMAT) {
        return Err("Ce fichier n'est pas une sauvegarde docdoc.".to_string());
    }
    match object.get("version").and_then(Value::as_i64) {
        Some(version) if version == BACKUP_VERSION => {}
        Some(version) => {
            return Err(format!(
                "Version de sauvegarde non prise en charge : {version}."
            ));
        }
        None => return Err("Version de sauvegarde absente.".to_string()),
    }
    if !object
        .get("exportedAt")
        .map(Value::is_string)
        .unwrap_or(false)
    {
        return Err("La date d'export de la sauvegarde est absente.".to_string());
    }
    let themes_raw = object
        .get("themes")
        .and_then(Value::as_array)
        .ok_or("La sauvegarde doit contenir la liste themes.")?;
    let domains_raw = object
        .get("domains")
        .and_then(Value::as_array)
        .ok_or("La sauvegarde doit contenir la liste domains.")?;
    let archives_raw = object
        .get("archives")
        .and_then(Value::as_array)
        .ok_or("La sauvegarde doit contenir la liste archives.")?;

    let mut themes = Vec::new();
    let mut theme_ids = HashSet::new();
    for raw in themes_raw {
        let theme = raw
            .as_object()
            .ok_or("Un thème de la sauvegarde n'est pas un objet.")?;
        let id = theme
            .get("id")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
            .ok_or("Un thème de la sauvegarde n'a pas d'identifiant.")?;
        if !theme_ids.insert(id.to_string()) {
            return Err(format!(
                "Identifiant de thème dupliqué dans la sauvegarde : « {id} »."
            ));
        }
        let name = theme
            .get("name")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| format!("Le thème « {id} » n'a pas de nom."))?;
        let color = theme
            .get("color")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| format!("Le thème « {name} » n'a pas de couleur."))?;
        themes.push(Theme {
            id: id.to_string(),
            name: name.to_string(),
            color: color.to_string(),
        });
    }

    let mut ids = HashSet::new();
    let mut active_slugs = HashSet::new();
    for raw in domains_raw {
        validate_backup_domain(raw, "domaine", &theme_ids, &mut ids, &mut active_slugs)?;
    }
    for raw in archives_raw {
        validate_backup_domain(raw, "archive", &theme_ids, &mut ids, &mut active_slugs)?;
    }

    let mut domains = Vec::new();
    for raw in domains_raw {
        let domain =
            normalize_domain(&themes, raw).ok_or("Un domaine de la sauvegarde est invalide.")?;
        domains.push(domain);
    }
    let mut archives = Vec::new();
    for raw in archives_raw {
        let archive =
            normalize_domain(&themes, raw).ok_or("Une archive de la sauvegarde est invalide.")?;
        archives.push(archive);
    }
    Ok(ValidatedBackup {
        themes,
        domains,
        archives,
        home_order: validate_backup_home_order(object.get("homeOrder"))?,
    })
}

fn backup_document(space: &Space, archives: Vec<Domain>) -> Value {
    let mut domains: Vec<Domain> = space.domains.values().cloned().collect();
    for domain in &mut domains {
        domain.display_order = model::ensure_display_order(&domain.projects, &domain.display_order);
    }
    domains.sort_by(|a, b| {
        a.order
            .partial_cmp(&b.order)
            .unwrap_or(Ordering::Equal)
            .then_with(|| a.name.cmp(&b.name))
            .then_with(|| a.id.cmp(&b.id))
    });
    json!({
        "format": BACKUP_FORMAT,
        "version": BACKUP_VERSION,
        "exportedAt": chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        "themes": &space.themes,
        "domains": &domains,
        "archives": archives,
        "homeOrder": &space.home_order,
    })
}

async fn export_backup_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Response {
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let space = handle.lock().await;
    let archives = read_archived_domains(&state, &space).await;
    let body = serde_json::to_string_pretty(&backup_document(&space, archives))
        .unwrap_or_else(|_| "{}".to_string());
    let date = chrono::Utc::now().format("%Y-%m-%d");
    let disposition = format!("attachment; filename=\"docdoc-sauvegarde-{date}.json\"");
    let mut response = (StatusCode::OK, body).into_response();
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json; charset=utf-8"),
    );
    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition)
            .unwrap_or_else(|_| HeaderValue::from_static("attachment")),
    );
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

async fn restore_backup(
    state: &AppState,
    user_id: &str,
    backup: &ValidatedBackup,
) -> Result<(), String> {
    let current_domains = state.storage.list_domain_keys(user_id).await;
    let current_archives = state.storage.list_archive_keys(user_id).await;
    let target_domains: HashSet<String> = backup
        .domains
        .iter()
        .map(|domain| storage::domain_key(user_id, &domain.id))
        .collect();
    let target_archives: HashSet<String> = backup
        .archives
        .iter()
        .map(|archive| storage::archive_key(user_id, &archive.id))
        .collect();

    let themes = serde_json::to_value(&backup.themes).map_err(|err| err.to_string())?;
    state
        .storage
        .write_json(&storage::themes_key(user_id), &themes)
        .await?;
    let home_order = serde_json::to_value(&backup.home_order).map_err(|err| err.to_string())?;
    state
        .storage
        .write_json(&storage::home_order_key(user_id), &home_order)
        .await?;
    for domain in &backup.domains {
        let value = serde_json::to_value(domain).map_err(|err| err.to_string())?;
        state
            .storage
            .write_json(&storage::domain_key(user_id, &domain.id), &value)
            .await?;
    }
    for archive in &backup.archives {
        let value = serde_json::to_value(archive).map_err(|err| err.to_string())?;
        state
            .storage
            .write_json(&storage::archive_key(user_id, &archive.id), &value)
            .await?;
    }
    for key in current_domains {
        if !target_domains.contains(&key) {
            state.storage.delete_object(&key).await?;
        }
    }
    for key in current_archives {
        if !target_archives.contains(&key) {
            state.storage.delete_object(&key).await?;
        }
    }
    Ok(())
}

async fn restore_backup_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = query_params(&uri);
    if params.get("confirm").map(String::as_str) != Some("replace") {
        return text_response(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Confirmation de restauration requise.",
        );
    }
    let content_type = header_value(&headers, header::CONTENT_TYPE.as_str()).unwrap_or("");
    let is_json = content_type
        .split(';')
        .next()
        .map(str::trim)
        .map(|value| value.eq_ignore_ascii_case("application/json"))
        .unwrap_or(false);
    if !is_json {
        return text_response(
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "La restauration exige un corps application/json.",
        );
    }
    if body.is_empty() {
        return text_response(
            StatusCode::BAD_REQUEST,
            "Le fichier de sauvegarde est vide ou illisible.",
        );
    }
    if body.len() > BACKUP_MAX_BYTES {
        return text_response(
            StatusCode::PAYLOAD_TOO_LARGE,
            "Sauvegarde trop volumineuse (10 Mo maximum).",
        );
    }
    let text = String::from_utf8_lossy(&body);
    let text = text.strip_prefix('\u{feff}').unwrap_or(&text);
    let doc: Value = match serde_json::from_str(text) {
        Ok(doc) => doc,
        Err(_) => {
            return text_response(
                StatusCode::BAD_REQUEST,
                "Le fichier de sauvegarde n'est pas du JSON valide.",
            );
        }
    };
    let backup = match validate_backup(&doc) {
        Ok(backup) => backup,
        Err(message) => return text_response(StatusCode::UNPROCESSABLE_ENTITY, &message),
    };

    if let Err(message) = restore_backup(&state, &auth.user_id, &backup).await {
        error!("restauration de sauvegarde : {message}");
        state.invalidate_space(&auth.user_id).await;
        return text_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "La restauration a échoué. Réessayez avec le même fichier.",
        );
    }
    state.invalidate_space(&auth.user_id).await;
    (
        StatusCode::SEE_OTHER,
        [(header::LOCATION, "/administration?restaure=ok#admin-backup")],
    )
        .into_response()
}

async fn guide_page(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Response {
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let space = handle.lock().await;
    html_response(
        StatusCode::OK,
        html::render_guide_page(&space, &state.config.app_version),
    )
}

fn expand_ids(uri: &Uri, projects: &[crate::model::Node]) -> Option<HashSet<String>> {
    let query = query_params(uri);
    let reveal = query.get("reveal").filter(|value| !value.is_empty())?;
    Some(model::ancestor_ids(projects, reveal))
}

/// Révélation d'une ligne pour un POST htmx : le client ajoute `reveal` aux
/// paramètres de la requête (`htmx:configRequest`), donc il peut arriver dans le
/// corps ou dans la requête selon la méthode.
fn expand_ids_with_params(
    uri: &Uri,
    params: &HashMap<String, String>,
    projects: &[crate::model::Node],
) -> Option<HashSet<String>> {
    let query = query_params(uri);
    let reveal = query
        .get("reveal")
        .or_else(|| params.get("reveal"))
        .filter(|value| !value.is_empty())?;
    Some(model::ancestor_ids(projects, reveal))
}

async fn domain_page(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(slug): Path<String>,
    uri: Uri,
) -> Response {
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    if space.find_domain_by_slug(&slug).is_none() {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    }
    let domain_id = space
        .find_domain_by_slug(&slug)
        .map(|domain| domain.id.clone())
        .unwrap();
    let _ = ensure_default_project(&state, &mut space, &domain_id).await;
    let Some(domain) = space.find_domain_by_id(&domain_id) else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let expand = expand_ids(&uri, &domain.projects);
    let page = html::render_page(&space, domain, expand.as_ref());
    html_response(StatusCode::OK, page)
}

async fn ensure_default_project(state: &AppState, space: &mut Space, domain_id: &str) -> bool {
    let created = {
        let Some(domain) = space.domains.get_mut(domain_id) else {
            return false;
        };
        if !domain.projects.is_empty() {
            return false;
        }
        create_node(domain, None).is_some()
    };
    if created {
        let _ = space.persist_domain(&state.storage, domain_id).await;
    }
    created
}

async fn outline_fragment(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(slug): Path<String>,
    uri: Uri,
) -> Response {
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    let Some(domain_id) = space
        .find_domain_by_slug(&slug)
        .map(|domain| domain.id.clone())
    else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let _ = ensure_default_project(&state, &mut space, &domain_id).await;
    let Some(domain) = space.find_domain_by_id(&domain_id) else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let expand = expand_ids(&uri, &domain.projects);
    html_response(
        StatusCode::OK,
        html::render_outline(domain, expand.as_ref()),
    )
}

async fn outline_json(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(slug): Path<String>,
) -> Response {
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let space = handle.lock().await;
    let Some(domain) = space.find_domain_by_slug(&slug) else {
        return json_response(
            StatusCode::NOT_FOUND,
            json!({ "error": "Domaine introuvable" }),
        );
    };
    json_response(StatusCode::OK, space::projects_json(&domain.projects))
}

/* ------------------------------------------------------------------ */
/* Nœuds de l'outline                                                  */
/* ------------------------------------------------------------------ */

async fn get_node_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((slug, id)): Path<(String, String)>,
) -> Response {
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let space = handle.lock().await;
    let Some(domain) = space.find_domain_by_slug(&slug) else {
        return json_response(
            StatusCode::NOT_FOUND,
            json!({ "error": "Domaine introuvable" }),
        );
    };
    let Some(path) = model::find_path(&domain.projects, &id) else {
        return json_response(
            StatusCode::NOT_FOUND,
            json!({ "error": "Noeud introuvable" }),
        );
    };
    let Some(node) = model::node_at(&domain.projects, &path) else {
        return json_response(
            StatusCode::NOT_FOUND,
            json!({ "error": "Noeud introuvable" }),
        );
    };
    json_response(
        StatusCode::OK,
        json!({ "id": node.id, "title": node.title }),
    )
}

async fn create_node_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(slug): Path<String>,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let parent_id = params
        .get("parentId")
        .filter(|value| !value.is_empty())
        .cloned();
    // `parentId` wins: a child is always appended under its parent. Without a
    // parent, `position: "head"` inserts the project at the head of the outline;
    // any other request keeps appending it to the end of the list.
    let at_head = parent_id.is_none() && params.get("position").map(String::as_str) == Some("head");
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    let Some(domain_id) = space
        .find_domain_by_slug(&slug)
        .map(|domain| domain.id.clone())
    else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let Some(domain) = space.domains.get_mut(&domain_id) else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let node = if at_head {
        Some(create_project_at_head(domain))
    } else {
        create_node(domain, parent_id.as_deref())
    };
    let Some(node) = node else {
        return text_response(StatusCode::NOT_FOUND, "Parent introuvable");
    };
    if let Some(parent_id) = &parent_id {
        if let Some(domain) = space.domains.get_mut(&domain_id) {
            if let Some(path) = model::find_path(&domain.projects, parent_id) {
                if let Some(parent) = model::node_at_mut(&mut domain.projects, &path) {
                    parent.collapsed = false;
                }
            }
        }
    }
    let _ = space.persist_domain(&state.storage, &domain_id).await;
    let Some(domain) = space.find_domain_by_id(&domain_id) else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let expand = expand_ids(&uri, &domain.projects);
    let mut response = html_response(
        StatusCode::OK,
        html::render_outline(domain, expand.as_ref()),
    );
    if let Ok(value) = HeaderValue::from_str(&node.id) {
        response.headers_mut().insert("X-New-Node-Id", value);
    }
    response
}

async fn next_node_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((slug, id)): Path<(String, String)>,
    uri: Uri,
) -> Response {
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    let Some(domain_id) = space
        .find_domain_by_slug(&slug)
        .map(|domain| domain.id.clone())
    else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let Some(node) = space
        .domains
        .get_mut(&domain_id)
        .and_then(|domain| create_node_after(domain, &id))
    else {
        return text_response(StatusCode::NOT_FOUND, "Noeud introuvable");
    };
    let _ = space.persist_domain(&state.storage, &domain_id).await;
    let Some(domain) = space.find_domain_by_id(&domain_id) else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let expand = expand_ids(&uri, &domain.projects);
    let mut response = html_response(
        StatusCode::OK,
        html::render_outline(domain, expand.as_ref()),
    );
    if let Ok(value) = HeaderValue::from_str(&node.id) {
        response.headers_mut().insert("X-New-Node-Id", value);
    }
    response
}

async fn rename_node_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((slug, id)): Path<(String, String)>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let title = params.get("title").cloned().unwrap_or_default();
    let title = title.trim().to_string();
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    let Some(domain_id) = space
        .find_domain_by_slug(&slug)
        .map(|domain| domain.id.clone())
    else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let Some(domain) = space.domains.get_mut(&domain_id) else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let Some(path) = model::find_path(&domain.projects, &id) else {
        return text_response(StatusCode::NOT_FOUND, "Noeud introuvable");
    };
    if !title.is_empty() {
        if let Some(node) = model::node_at_mut(&mut domain.projects, &path) {
            node.title = title;
        }
    }
    let _ = space.persist_domain(&state.storage, &domain_id).await;
    json_response(StatusCode::OK, json!({ "ok": true }))
}

async fn delete_node_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((slug, id)): Path<(String, String)>,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    let Some(domain_id) = space
        .find_domain_by_slug(&slug)
        .map(|domain| domain.id.clone())
    else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let deleted = space
        .domains
        .get_mut(&domain_id)
        .map(|domain| delete_node(domain, &id))
        .unwrap_or(false);
    if !deleted {
        return text_response(StatusCode::NOT_FOUND, "Noeud introuvable");
    }
    if !ensure_default_project(&state, &mut space, &domain_id).await {
        let _ = space.persist_domain(&state.storage, &domain_id).await;
    }
    let Some(domain) = space.find_domain_by_id(&domain_id) else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let expand = expand_ids_with_params(&uri, &params, &domain.projects);
    html_response(
        StatusCode::OK,
        html::render_outline(domain, expand.as_ref()),
    )
}

async fn status_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((slug, id)): Path<(String, String)>,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let status = params.get("status").cloned().unwrap_or_default();
    let scope = if params.get("scope").map(String::as_str) == Some("head") {
        "head"
    } else {
        "subtree"
    };
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    let Some(domain_id) = space
        .find_domain_by_slug(&slug)
        .map(|domain| domain.id.clone())
    else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let ok = space
        .domains
        .get_mut(&domain_id)
        .map(|domain| set_status(&mut domain.projects, &id, &status, scope))
        .unwrap_or(false);
    if !ok {
        return text_response(StatusCode::BAD_REQUEST, "Statut invalide");
    }
    let _ = space.persist_domain(&state.storage, &domain_id).await;
    if params.get("vue").map(String::as_str) == Some("accueil") {
        return html_response(StatusCode::OK, html::render_home_board(&space));
    }
    let Some(domain) = space.find_domain_by_id(&domain_id) else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let expand = expand_ids_with_params(&uri, &params, &domain.projects);
    html_response(
        StatusCode::OK,
        html::render_outline(domain, expand.as_ref()),
    )
}

async fn home_order_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let rubrique = params.get("rubrique").cloned().unwrap_or_default();
    if rubrique != "in_progress" && rubrique != "waiting" {
        return text_response(StatusCode::BAD_REQUEST, "Rubrique invalide.");
    }
    let index = match params.get("index").map(String::as_str) {
        None | Some("") => None,
        Some(value) => match value.parse::<i64>() {
            Ok(value) => Some(value),
            Err(_) => return text_response(StatusCode::BAD_REQUEST, "Position invalide."),
        },
    };
    let domain_slug = params.get("domain").cloned().unwrap_or_default();
    let node_id = params.get("node").cloned().unwrap_or_default();
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    let Some(domain_id) = space
        .find_domain_by_slug(&domain_slug)
        .map(|domain| domain.id.clone())
    else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let Some(domain) = space.domains.get(&domain_id) else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let Some(node) = model::find_node(&domain.projects, &node_id) else {
        return text_response(StatusCode::NOT_FOUND, "Noeud introuvable");
    };
    let Some(current) = html::home_rubrique(node) else {
        return text_response(StatusCode::BAD_REQUEST, "Tâche non listée sur le tableau.");
    };
    let status_changed = current != rubrique.as_str();
    if status_changed {
        let Some(domain) = space.domains.get_mut(&domain_id) else {
            return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
        };
        if !set_status(&mut domain.projects, &node_id, &rubrique, "head") {
            return text_response(StatusCode::BAD_REQUEST, "Statut invalide");
        }
    }
    // The displayed list after the mutation, minus the task itself, is what the
    // requested index refers to: the client counts the other cards only.
    let mut ids: Vec<String> = html::home_order_ids(&space, &rubrique)
        .into_iter()
        .filter(|id| id != &node_id)
        .collect();
    let position = match index {
        None => ids.len(),
        Some(value) => value.clamp(0, ids.len() as i64) as usize,
    };
    ids.insert(position, node_id);
    space.home_order.set(&rubrique, ids);
    if status_changed {
        let _ = space.persist_domain(&state.storage, &domain_id).await;
    }
    let _ = space.persist_home_order(&state.storage).await;
    html_response(StatusCode::OK, html::render_home_board(&space))
}

async fn toggle_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((slug, id)): Path<(String, String)>,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    let Some(domain_id) = space
        .find_domain_by_slug(&slug)
        .map(|domain| domain.id.clone())
    else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let ok = space
        .domains
        .get_mut(&domain_id)
        .map(|domain| toggle_collapse(&mut domain.projects, &id))
        .unwrap_or(false);
    if !ok {
        return text_response(StatusCode::NOT_FOUND, "Noeud introuvable");
    }
    let _ = space.persist_domain(&state.storage, &domain_id).await;
    let Some(domain) = space.find_domain_by_id(&domain_id) else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let expand = expand_ids_with_params(&uri, &params, &domain.projects);
    html_response(
        StatusCode::OK,
        html::render_outline(domain, expand.as_ref()),
    )
}

async fn indent_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((slug, id)): Path<(String, String)>,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    reindent_route(state, auth, slug, id, "indent", uri, headers, body).await
}

async fn outdent_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((slug, id)): Path<(String, String)>,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    reindent_route(state, auth, slug, id, "outdent", uri, headers, body).await
}

async fn reindent_route(
    state: AppState,
    auth: AuthUser,
    slug: String,
    id: String,
    direction: &str,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    let Some(domain_id) = space
        .find_domain_by_slug(&slug)
        .map(|domain| domain.id.clone())
    else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    if let Some(domain) = space.domains.get_mut(&domain_id) {
        reindent_node(domain, &id, direction);
    }
    let _ = space.persist_domain(&state.storage, &domain_id).await;
    let Some(domain) = space.find_domain_by_id(&domain_id) else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let expand = expand_ids_with_params(&uri, &params, &domain.projects);
    html_response(
        StatusCode::OK,
        html::render_outline(domain, expand.as_ref()),
    )
}

async fn move_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((slug, id)): Path<(String, String)>,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let target_id = params
        .get("targetId")
        .filter(|value| !value.is_empty())
        .cloned();
    let position = params
        .get("position")
        .cloned()
        .unwrap_or_else(|| "inside".to_string());
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    let Some(domain_id) = space
        .find_domain_by_slug(&slug)
        .map(|domain| domain.id.clone())
    else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let result = space
        .domains
        .get_mut(&domain_id)
        .map(|domain| move_node(domain, &id, target_id.as_deref(), &position));
    match result {
        Some(Ok(())) => {}
        Some(Err(error)) => {
            let status = if error == "not-found" || error == "target-not-found" {
                StatusCode::NOT_FOUND
            } else {
                StatusCode::BAD_REQUEST
            };
            return text_response(status, error);
        }
        None => return text_response(StatusCode::NOT_FOUND, "Domaine introuvable"),
    }
    let _ = space.persist_domain(&state.storage, &domain_id).await;
    let Some(domain) = space.find_domain_by_id(&domain_id) else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let expand = expand_ids_with_params(&uri, &params, &domain.projects);
    html_response(
        StatusCode::OK,
        html::render_outline(domain, expand.as_ref()),
    )
}

async fn domain_labels_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(slug): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let action = params.get("action").cloned().unwrap_or_default();
    let theme_id = params.get("themeId").cloned().unwrap_or_default();
    if !matches!(action.as_str(), "attach" | "detach") || theme_id.is_empty() {
        return text_response(StatusCode::BAD_REQUEST, "Action et thème requis");
    }
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    let Some(domain_id) = space
        .find_domain_by_slug(&slug)
        .map(|domain| domain.id.clone())
    else {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    };
    let ok = {
        let themes = space.themes.clone();
        let Some(domain) = space.domains.get_mut(&domain_id) else {
            return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
        };
        set_domain_label(&themes, domain, &theme_id, &action)
    };
    if !ok {
        return text_response(StatusCode::NOT_FOUND, "Thème introuvable");
    }
    space.rebuild_domain_list();
    let _ = space.persist_domain(&state.storage, &domain_id).await;
    if is_htmx(&headers) {
        let Some(domain) = space.find_domain_by_id(&domain_id) else {
            return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
        };
        return html_response(StatusCode::OK, html::render_labels_bar(&space, domain));
    }
    let slug = space
        .find_domain_by_id(&domain_id)
        .map(|domain| domain.slug.clone())
        .unwrap_or_default();
    redirect_after(&params, &format!("/domaine/{slug}"))
}

/* ------------------------------------------------------------------ */
/* Domaines (administration)                                           */
/* ------------------------------------------------------------------ */

async fn create_domain_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let name = params
        .get("name")
        .cloned()
        .unwrap_or_default()
        .trim()
        .to_string();
    if name.is_empty() {
        return text_response(StatusCode::BAD_REQUEST, "Nom requis");
    }
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    let domain = make_domain(&space.domains, &space.domain_list, &name);
    let id = domain.id.clone();
    space.domains.insert(id.clone(), domain);
    space.rebuild_domain_list();
    if !ensure_default_project(&state, &mut space, &id).await {
        let _ = space.persist_domain(&state.storage, &id).await;
    }
    redirect_after(&params, "/administration")
}

async fn rename_domain_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let name = params
        .get("name")
        .cloned()
        .unwrap_or_default()
        .trim()
        .to_string();
    if name.is_empty() {
        return text_response(StatusCode::BAD_REQUEST, "Nom requis");
    }
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    if space.find_domain_by_id(&id).is_none() {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    }
    let slug = slugify(&space.domains, &name, Some(&id));
    if let Some(domain) = space.domains.get_mut(&id) {
        domain.name = name;
        domain.slug = slug.clone();
    }
    space.rebuild_domain_list();
    let _ = space.persist_domain(&state.storage, &id).await;
    redirect_after(&params, &format!("/domaine/{slug}"))
}

async fn archive_domain_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    if space.domains.remove(&id).is_none() {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    }
    space.rebuild_domain_list();
    let src = storage::domain_key(&space.user_id, &id);
    let dest = storage::archive_key(&space.user_id, &id);
    if let Err(err) = state.storage.move_object(&src, &dest).await {
        error!("archivage du domaine {id}: {err}");
        return text_response(StatusCode::INTERNAL_SERVER_ERROR, "Archivage impossible");
    }
    redirect_after(&params, "/")
}

async fn move_domain_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let direction = match params.get("dir").map(String::as_str) {
        Some("up") => "up",
        Some("down") => "down",
        _ => return text_response(StatusCode::BAD_REQUEST, "Direction requise"),
    };
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    if space.find_domain_by_id(&id).is_none() {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    }
    let changed = move_domain(&mut space.domains, &id, direction);
    space.rebuild_domain_list();
    if let Some(ids) = changed {
        for changed_id in ids {
            let _ = space.persist_domain(&state.storage, &changed_id).await;
        }
    }
    // The sidebar's forms carry the page they were submitted from, so a move
    // leaves the user there; the administration's forms keep `/administration`.
    // Anything but a local path falls back to the administration page.
    let fallback = params
        .get("returnTo")
        .and_then(|value| local_path(value))
        .unwrap_or("/administration");
    redirect_after(&params, fallback)
}

/* ------------------------------------------------------------------ */
/* Thèmes                                                              */
/* ------------------------------------------------------------------ */

async fn create_theme_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let name = params
        .get("name")
        .cloned()
        .unwrap_or_default()
        .trim()
        .to_string();
    if name.is_empty() {
        return text_response(StatusCode::BAD_REQUEST, "Nom requis");
    }
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    if space.themes.iter().any(|theme| theme.name == name) {
        return text_response(StatusCode::BAD_REQUEST, "Thème déjà existant");
    }
    let color = params
        .get("color")
        .filter(|value| !value.is_empty())
        .cloned()
        .unwrap_or_else(|| next_theme_color(space.themes.len()).to_string());
    space.themes.push(Theme {
        id: Uuid::new_v4().to_string(),
        name,
        color,
    });
    let _ = space.persist_themes(&state.storage).await;
    redirect_after(&params, &back_to(&headers))
}

async fn rename_theme_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let name = params
        .get("name")
        .cloned()
        .unwrap_or_default()
        .trim()
        .to_string();
    if name.is_empty() {
        return text_response(StatusCode::BAD_REQUEST, "Nom requis");
    }
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    if !space.themes.iter().any(|theme| theme.id == id) {
        return text_response(StatusCode::NOT_FOUND, "Thème introuvable");
    }
    if space
        .themes
        .iter()
        .any(|theme| theme.id != id && theme.name == name)
    {
        return text_response(StatusCode::BAD_REQUEST, "Thème déjà existant");
    }
    if let Some(theme) = space.themes.iter_mut().find(|theme| theme.id == id) {
        theme.name = name;
        if let Some(color) = params.get("color").filter(|value| !value.is_empty()) {
            theme.color = color.clone();
        }
    }
    let _ = space.persist_themes(&state.storage).await;
    redirect_after(&params, &back_to(&headers))
}

async fn delete_theme_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    if !space.themes.iter().any(|theme| theme.id == id) {
        return text_response(StatusCode::NOT_FOUND, "Thème introuvable");
    }
    space.themes.retain(|theme| theme.id != id);
    let domain_ids: Vec<String> = space
        .domains
        .iter()
        .filter(|(_, domain)| domain.labels.iter().any(|label| label == &id))
        .map(|(domain_id, _)| domain_id.clone())
        .collect();
    if !domain_ids.is_empty() {
        for domain_id in &domain_ids {
            if let Some(domain) = space.domains.get_mut(domain_id) {
                domain.labels.retain(|label| label != &id);
            }
        }
        space.rebuild_domain_list();
        for domain_id in &domain_ids {
            let _ = space.persist_domain(&state.storage, domain_id).await;
        }
    }
    let _ = space.persist_themes(&state.storage).await;
    redirect_after(&params, &back_to(&headers))
}

async fn move_theme_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let direction = match params.get("dir").map(String::as_str) {
        Some("up") => "up",
        Some("down") => "down",
        _ => return text_response(StatusCode::BAD_REQUEST, "Direction requise"),
    };
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    let Some(index) = space.themes.iter().position(|theme| theme.id == id) else {
        return text_response(StatusCode::NOT_FOUND, "Thème introuvable");
    };
    model::move_theme(&mut space.themes, index, direction);
    let _ = space.persist_themes(&state.storage).await;
    redirect_after(&params, "/administration")
}

async fn theme_labels_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(theme_id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let action = params.get("action").cloned().unwrap_or_default();
    if !matches!(action.as_str(), "attach" | "detach") {
        return text_response(StatusCode::BAD_REQUEST, "Action requise");
    }
    let domain_id = params.get("domainId").cloned().unwrap_or_default();
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    if !space.themes.iter().any(|theme| theme.id == theme_id) {
        return text_response(StatusCode::NOT_FOUND, "Thème introuvable");
    }
    if !space.domains.contains_key(&domain_id) {
        return text_response(StatusCode::NOT_FOUND, "Domaine introuvable");
    }
    let themes = space.themes.clone();
    let ok = space
        .domains
        .get_mut(&domain_id)
        .map(|domain| set_domain_label(&themes, domain, &theme_id, &action))
        .unwrap_or(false);
    if !ok {
        return text_response(StatusCode::NOT_FOUND, "Thème introuvable");
    }
    space.rebuild_domain_list();
    let _ = space.persist_domain(&state.storage, &domain_id).await;
    redirect_after(&params, "/administration")
}

/* ------------------------------------------------------------------ */
/* Archives                                                            */
/* ------------------------------------------------------------------ */

async fn restore_archive_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let mut space = handle.lock().await;
    let key = storage::archive_key(&space.user_id, &id);
    let Some(parsed) = state.storage.read_json(&key).await else {
        return text_response(StatusCode::NOT_FOUND, "Archive introuvable");
    };
    let valid = parsed.get("id").and_then(Value::as_str) == Some(id.as_str())
        && parsed.get("projects").and_then(Value::as_array).is_some();
    if !valid {
        return text_response(StatusCode::NOT_FOUND, "Archive introuvable");
    }
    if space.domains.contains_key(&id) {
        return text_response(StatusCode::CONFLICT, "Domaine déjà actif");
    }
    let Some(mut domain) = normalize_domain(&space.themes, &parsed) else {
        return text_response(StatusCode::NOT_FOUND, "Archive introuvable");
    };
    domain.slug = slugify(&space.domains, &domain.name, Some(&domain.id));
    domain.order = next_order(&space.domain_list);
    space.domains.insert(domain.id.clone(), domain);
    space.rebuild_domain_list();
    let _ = space.persist_domain(&state.storage, &id).await;
    let _ = state.storage.delete_object(&key).await;
    redirect_after(&params, "/administration")
}

async fn purge_archive_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let params = boundary_params(&headers, &body);
    let handle = state.space_for(&auth.user_id, &auth.email).await;
    let space = handle.lock().await;
    let key = storage::archive_key(&space.user_id, &id);
    if state.storage.read_json(&key).await.is_none() {
        return text_response(StatusCode::NOT_FOUND, "Archive introuvable");
    }
    let _ = state.storage.delete_object(&key).await;
    redirect_after(&params, "/administration")
}

/* ------------------------------------------------------------------ */
/* Tests d'intégration : le routeur est construit sans réseau          */
/* ------------------------------------------------------------------ */

#[cfg(test)]
pub fn test_state() -> AppState {
    let config = Config {
        port: 0,
        bind_host: "127.0.0.1".to_string(),
        is_production: false,
        session_secret: b"test".to_vec(),
        app_version: String::new(),
        authorized_emails: vec!["test@example.fr".to_string()],
        mail: crate::config::MailConfig {
            provider: "dev".into(),
            from: String::new(),
            from_name: "docdoc".into(),
            region: "fr-par".into(),
            secret_key: String::new(),
            project_id: String::new(),
            brevo_api_key: String::new(),
            smtp_host: String::new(),
            smtp_port: 1026,
            smtp_secure: false,
            smtp_require_tls: false,
            smtp_allow_self_signed: false,
            smtp_user: String::new(),
            smtp_password: String::new(),
            smtp_timeout_ms: 1000,
        },
        s3: None,
        storage_dir: None,
        public_dir: std::path::PathBuf::from("../public"),
        data_dir: std::path::PathBuf::from("../data"),
        rp_id: None,
        rp_origin: None,
    };
    AppState::new(config)
}

#[cfg(test)]
mod http_tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use axum::http::Request;
    use tower::ServiceExt;

    async fn call(
        app: &Router,
        method: &str,
        uri: &str,
        cookie: Option<&str>,
        content_type: Option<&str>,
        body: &str,
    ) -> (StatusCode, HeaderMap, String) {
        let mut builder = Request::builder().method(method).uri(uri);
        if let Some(cookie) = cookie {
            builder = builder.header(header::COOKIE, cookie);
        }
        if let Some(content_type) = content_type {
            builder = builder.header(header::CONTENT_TYPE, content_type);
        }
        let request = builder.body(Body::from(body.to_string())).unwrap();
        let response = app.clone().oneshot(request).await.unwrap();
        let status = response.status();
        let headers = response.headers().clone();
        let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        (status, headers, String::from_utf8_lossy(&bytes).to_string())
    }

    fn value_of<'a>(html: &'a str, marker: &str) -> &'a str {
        let start = html.find(marker).expect(marker) + marker.len();
        let end = html[start..].find('"').unwrap() + start;
        &html[start..end]
    }

    async fn signed_in_cookie(state: &AppState) -> String {
        let (session_id, mut session) = state.sessions.create().await;
        session.user_id = Some("user-test".to_string());
        session.email = Some("test@example.fr".to_string());
        state.sessions.save(&session_id, &session).await;
        state
            .sessions
            .cookie_header(&session_id, false)
            .split(';')
            .next()
            .unwrap()
            .to_string()
    }

    #[tokio::test]
    async fn public_pages_and_guard() {
        let app = build_router(test_state());
        let (status, _, body) = call(&app, "GET", "/", None, None, "").await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("Créer un compte"));
        assert!(body.contains("/simplewebauthn.js"));

        let (status, headers, _) = call(&app, "GET", "/administration", None, None, "").await;
        assert_eq!(status, StatusCode::FOUND);
        assert_eq!(headers.get(header::LOCATION).unwrap(), "/");

        let (status, _, body) = call(
            &app,
            "GET",
            "/domaine/quelconque/api/outline",
            None,
            None,
            "",
        )
        .await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert!(body.contains("\"authenticated\":false"));

        let (status, _, body) = call(&app, "GET", "/manifest.webmanifest", None, None, "").await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("docdoc"));
    }

    #[tokio::test]
    async fn authenticated_domain_and_node_lifecycle() {
        let state = test_state();
        let (session_id, mut session) = state.sessions.create().await;
        session.user_id = Some("user-test".to_string());
        session.email = Some("test@example.fr".to_string());
        state.sessions.save(&session_id, &session).await;
        let cookie = state
            .sessions
            .cookie_header(&session_id, false)
            .split(';')
            .next()
            .unwrap()
            .to_string();
        let app = build_router(state);

        let (status, _, _) = call(
            &app,
            "POST",
            "/api/domains",
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Maison&returnTo=%2Fadministration",
        )
        .await;
        assert_eq!(status, StatusCode::FOUND);

        let (status, _, page) = call(&app, "GET", "/domaine/maison", Some(&cookie), None, "").await;
        assert_eq!(status, StatusCode::OK);
        assert!(page.contains("Nouveau projet"));
        let node_id = value_of(&page, "id=\"node-").to_string();

        let (status, _, _) = call(
            &app,
            "PUT",
            &format!("/domaine/maison/api/nodes/{node_id}"),
            Some(&cookie),
            Some("application/json"),
            "{\"title\":\"Rénover la cuisine\"}",
        )
        .await;
        assert_eq!(status, StatusCode::OK);

        let (status, _, page) = call(&app, "GET", "/domaine/maison", Some(&cookie), None, "").await;
        assert_eq!(status, StatusCode::OK);
        assert!(page.contains("Rénover la cuisine"));

        let (status, next_headers, next_html) = call(
            &app,
            "POST",
            &format!("/domaine/maison/api/nodes/{node_id}/next"),
            Some(&cookie),
            None,
            "",
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let second_id = next_headers
            .get("x-new-node-id")
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();
        assert!(next_html.contains(&format!("id=\"node-{second_id}\"")));
        assert!(next_html.contains("Nouveau projet"));

        let (status, _, _) = call(
            &app,
            "PUT",
            &format!("/domaine/maison/api/nodes/{second_id}"),
            Some(&cookie),
            Some("application/json"),
            "{\"title\":\"Choisir les couleurs\"}",
        )
        .await;
        assert_eq!(status, StatusCode::OK);

        let (status, _, page) = call(
            &app,
            "POST",
            &format!("/domaine/maison/api/nodes/{second_id}/status"),
            Some(&cookie),
            Some("application/json"),
            "{\"status\":\"in_progress\",\"scope\":\"head\"}",
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(page.contains("status-in-progress"));

        let (status, _, home) = call(&app, "GET", "/", Some(&cookie), None, "").await;
        assert_eq!(status, StatusCode::OK);
        assert!(home.contains("Choisir les couleurs"));
        assert!(home.contains("Maison"));

        let (status, _, _) = call(
            &app,
            "DELETE",
            &format!("/domaine/maison/api/nodes/{second_id}"),
            Some(&cookie),
            None,
            "",
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let (status, _, page) = call(
            &app,
            "DELETE",
            &format!("/domaine/maison/api/nodes/{node_id}"),
            Some(&cookie),
            None,
            "",
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(page.contains("Nouveau projet"));
    }

    // The add-project control of a domain page inserts a project at the head of
    // the outline, above every other line, and the position is persisted
    // (openspec change add-project-button).
    #[tokio::test]
    async fn add_project_route_inserts_a_line_at_the_head() {
        let state = test_state();
        let cookie = signed_in_cookie(&state).await;
        let app = build_router(state);

        call(
            &app,
            "POST",
            "/api/domains",
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Maison",
        )
        .await;
        let (_, _, page) = call(&app, "GET", "/domaine/maison", Some(&cookie), None, "").await;
        // The control is rendered by the page shell, on domain pages only.
        assert!(page.contains("id=\"add-project\""));
        let default_id = value_of(&page, "id=\"node-").to_string();

        // Give the default project a sub-line: the new project must land above the
        // project *and* above that sub-line.
        let (status, headers, _) = call(
            &app,
            "POST",
            "/domaine/maison/api/nodes",
            Some(&cookie),
            Some("application/json"),
            &format!("{{\"parentId\":\"{default_id}\"}}"),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let child_id = headers
            .get("x-new-node-id")
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();

        let (status, headers, fragment) = call(
            &app,
            "POST",
            "/domaine/maison/api/nodes",
            Some(&cookie),
            Some("application/json"),
            "{\"position\":\"head\"}",
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let new_id = headers
            .get("x-new-node-id")
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();
        assert!(fragment.contains("Nouveau projet"));
        let new_at = fragment.find(&format!("id=\"node-{new_id}\"")).unwrap();
        let default_at = fragment.find(&format!("id=\"node-{default_id}\"")).unwrap();
        let child_at = fragment.find(&format!("id=\"node-{child_id}\"")).unwrap();
        assert!(
            new_at < default_at,
            "the new project must precede the former first project"
        );
        assert!(
            default_at < child_at,
            "the former project keeps its sub-line below it"
        );

        // The head position is persisted, not only rendered once.
        let (_, _, page) = call(&app, "GET", "/domaine/maison", Some(&cookie), None, "").await;
        assert_eq!(value_of(&page, "id=\"node-"), new_id.as_str());

        // Other pages never offer the control.
        let (_, _, home) = call(&app, "GET", "/", Some(&cookie), None, "").await;
        assert!(!home.contains("id=\"add-project\""));
    }

    #[tokio::test]
    async fn home_board_status_route_returns_the_board_fragment() {
        let state = test_state();
        let cookie = signed_in_cookie(&state).await;
        let app = build_router(state);

        call(
            &app,
            "POST",
            "/api/domains",
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Maison",
        )
        .await;
        let (_, _, page) = call(&app, "GET", "/domaine/maison", Some(&cookie), None, "").await;
        let node_id = value_of(&page, "id=\"node-").to_string();

        let (status, _, waiting) = call(
            &app,
            "POST",
            &format!("/domaine/maison/api/nodes/{node_id}/status"),
            Some(&cookie),
            Some("application/json"),
            "{\"status\":\"waiting\",\"scope\":\"head\",\"vue\":\"accueil\"}",
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(waiting.contains("id=\"home-board\""));
        assert!(waiting.contains("data-gtd=\"waiting\""));
        assert!(waiting.contains(&format!("id=\"gtd-node-{node_id}\"")));

        let (status, _, _) = call(
            &app,
            "POST",
            &format!("/domaine/maison/api/nodes/{node_id}/status"),
            Some(&cookie),
            Some("application/json"),
            "{\"status\":\"someday\",\"scope\":\"head\",\"vue\":\"accueil\"}",
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);

        let (status, _, running) = call(
            &app,
            "POST",
            &format!("/domaine/maison/api/nodes/{node_id}/status"),
            Some(&cookie),
            Some("application/json"),
            "{\"status\":\"in_progress\",\"scope\":\"head\",\"vue\":\"accueil\"}",
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(running.contains("data-gtd=\"in_progress\""));
        assert!(running.contains(&format!("id=\"gtd-node-{node_id}\"")));

        let (status, _, _) = call(
            &app,
            "POST",
            &format!("/domaine/maison/api/nodes/{node_id}/status"),
            Some(&cookie),
            Some("application/json"),
            "{\"status\":\"nope\",\"scope\":\"head\",\"vue\":\"accueil\"}",
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);

        let (status, _, home) = call(&app, "GET", "/", Some(&cookie), None, "").await;
        assert_eq!(status, StatusCode::OK);
        assert!(home.contains("<title>GTD</title>"));
        assert!(home.contains("<h1>GTD</h1>"));
        assert!(home.contains("<p class=\"topbar-subtitle\">Getting Things Done</p>"));
        assert!(home.contains("class=\"btn topbar-shortcut active\""));
        assert!(home.contains(">GTD</a>"));
        assert!(home.contains("data-gtd=\"in_progress\""));
        assert!(home.contains("data-gtd=\"waiting\""));
        assert!(!home.contains("data-gtd=\"someday\""));
        assert!(home.contains("class=\"gtd-group-title\">En cours</h2>"));
        assert!(home.contains(&format!("id=\"gtd-node-{node_id}\"")));

        // The shortcut is on the domain page too, but the subtitle stays on `/`.
        let (status, _, domain_page) =
            call(&app, "GET", "/domaine/maison", Some(&cookie), None, "").await;
        assert_eq!(status, StatusCode::OK);
        assert!(domain_page.contains("class=\"btn topbar-shortcut\""));
        assert!(!domain_page.contains("topbar-subtitle"));
        assert!(!domain_page.contains("topbar-shortcut active"));
    }

    fn board_section<'a>(html: &'a str, rubrique: &str) -> &'a str {
        let marker = format!("data-gtd=\"{rubrique}\"");
        let start = html.find(&marker).expect("rubrique");
        let end = html[start..].find("</section>").unwrap() + start;
        &html[start..end]
    }

    #[tokio::test]
    async fn home_order_route_reorders_changes_status_and_persists() {
        let state = test_state();
        let cookie = signed_in_cookie(&state).await;
        let app = build_router(state);

        call(
            &app,
            "POST",
            "/api/domains",
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Maison",
        )
        .await;
        let (_, _, page) = call(&app, "GET", "/domaine/maison", Some(&cookie), None, "").await;
        let first = value_of(&page, "id=\"node-").to_string();
        let (_, headers, _) = call(
            &app,
            "POST",
            "/domaine/maison/api/nodes",
            Some(&cookie),
            None,
            "",
        )
        .await;
        let second = headers
            .get("x-new-node-id")
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();
        for id in [&first, &second] {
            let (status, _, _) = call(
                &app,
                "POST",
                &format!("/domaine/maison/api/nodes/{id}/status"),
                Some(&cookie),
                Some("application/json"),
                "{\"status\":\"in_progress\",\"scope\":\"head\"}",
            )
            .await;
            assert_eq!(status, StatusCode::OK);
        }

        // Move the second card to the head: it now precedes the first.
        let (status, _, board) = call(
            &app,
            "POST",
            "/api/home/order",
            Some(&cookie),
            Some("application/json"),
            &format!(
                "{{\"domain\":\"maison\",\"node\":\"{second}\",\"rubrique\":\"in_progress\",\"index\":0}}"
            ),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(board.contains("id=\"home-board\""));
        assert!(board.contains("hx-post=\"/api/home/order\""));
        assert!(board.contains("class=\"gtd-order-btn\""));
        let second_at = board.find(&format!("id=\"gtd-node-{second}\"")).unwrap();
        let first_at = board.find(&format!("id=\"gtd-node-{first}\"")).unwrap();
        assert!(second_at < first_at);

        // The order is persisted, not just rendered.
        let (_, _, home) = call(&app, "GET", "/", Some(&cookie), None, "").await;
        let second_at = home.find(&format!("id=\"gtd-node-{second}\"")).unwrap();
        let first_at = home.find(&format!("id=\"gtd-node-{first}\"")).unwrap();
        assert!(second_at < first_at);

        // A placement in the other rubrique also changes the task's status.
        let (status, _, waiting) = call(
            &app,
            "POST",
            "/api/home/order",
            Some(&cookie),
            Some("application/json"),
            &format!(
                "{{\"domain\":\"maison\",\"node\":\"{first}\",\"rubrique\":\"waiting\",\"index\":0}}"
            ),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(board_section(&waiting, "waiting").contains(&format!("id=\"gtd-node-{first}\"")));
        let (_, _, outline) = call(
            &app,
            "GET",
            "/domaine/maison/api/outline",
            Some(&cookie),
            None,
            "",
        )
        .await;
        let tree: Value = serde_json::from_str(&outline).unwrap();
        assert_eq!(tree[0]["id"], first.as_str());
        assert_eq!(tree[0]["status"], "waiting");

        // A cross-rubrique drop appends at the requested index; an out-of-range
        // index is clamped to the last position.
        call(
            &app,
            "POST",
            "/api/home/order",
            Some(&cookie),
            Some("application/json"),
            &format!(
                "{{\"domain\":\"maison\",\"node\":\"{second}\",\"rubrique\":\"waiting\",\"index\":999}}"
            ),
        )
        .await;
        let (_, _, waiting) = call(&app, "GET", "/", Some(&cookie), None, "").await;
        let section = board_section(&waiting, "waiting");
        assert!(
            section.find(&format!("id=\"gtd-node-{first}\"")).unwrap()
                < section.find(&format!("id=\"gtd-node-{second}\"")).unwrap()
        );

        // Refusals leave the order and the status untouched.
        let before = section.to_string();
        for body in [
            format!(
                "{{\"domain\":\"maison\",\"node\":\"{first}\",\"rubrique\":\"later\",\"index\":0}}"
            ),
            format!(
                "{{\"domain\":\"maison\",\"node\":\"inconnu\",\"rubrique\":\"in_progress\",\"index\":0}}"
            ),
            format!(
                "{{\"domain\":\"maison\",\"node\":\"{first}\",\"rubrique\":\"in_progress\",\"index\":2.5}}"
            ),
        ] {
            let (status, _, _) = call(
                &app,
                "POST",
                "/api/home/order",
                Some(&cookie),
                Some("application/json"),
                &body,
            )
            .await;
            assert!(
                status == StatusCode::BAD_REQUEST || status == StatusCode::NOT_FOUND,
                "statut inattendu : {status}"
            );
        }
        let (_, _, after) = call(&app, "GET", "/", Some(&cookie), None, "").await;
        assert!(before == board_section(&after, "waiting"));
        assert_eq!(
            tree[1]["status"], "in_progress",
            "le second nœud n'a pas bougé"
        );
    }

    #[tokio::test]
    async fn home_order_route_accepts_a_listed_mother_and_refuses_a_covered_one() {
        let state = test_state();
        let cookie = signed_in_cookie(&state).await;
        let app = build_router(state);

        call(
            &app,
            "POST",
            "/api/domains",
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Maison",
        )
        .await;
        let (_, _, page) = call(&app, "GET", "/domaine/maison", Some(&cookie), None, "").await;
        let mother = value_of(&page, "id=\"node-").to_string();
        let (status, headers, _) = call(
            &app,
            "POST",
            "/domaine/maison/api/nodes",
            Some(&cookie),
            Some("application/json"),
            &format!("{{\"parentId\":\"{mother}\"}}"),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let child = headers
            .get("x-new-node-id")
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();
        let (status, _, _) = call(
            &app,
            "POST",
            &format!("/domaine/maison/api/nodes/{mother}/status"),
            Some(&cookie),
            Some("application/json"),
            "{\"status\":\"in_progress\",\"scope\":\"head\"}",
        )
        .await;
        assert_eq!(status, StatusCode::OK);

        // The child is still "En projet", so the active mother is the deepest
        // active line of its branch: it is listed and can be positioned.
        let (_, _, home) = call(&app, "GET", "/", Some(&cookie), None, "").await;
        assert!(home.contains(&format!("id=\"gtd-node-{mother}\"")));
        assert!(!home.contains(&format!("id=\"gtd-node-{child}\"")));
        let (status, _, board) = call(
            &app,
            "POST",
            "/api/home/order",
            Some(&cookie),
            Some("application/json"),
            &format!("{{\"domain\":\"maison\",\"node\":\"{mother}\",\"rubrique\":\"in_progress\",\"index\":0}}"),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(board.contains(&format!("id=\"gtd-node-{mother}\"")));

        // Once the child is active, the mother is represented by it: the mother
        // is refused, the child is accepted.
        let (status, _, _) = call(
            &app,
            "POST",
            &format!("/domaine/maison/api/nodes/{child}/status"),
            Some(&cookie),
            Some("application/json"),
            "{\"status\":\"in_progress\",\"scope\":\"head\"}",
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let (status, _, _) = call(
            &app,
            "POST",
            "/api/home/order",
            Some(&cookie),
            Some("application/json"),
            &format!("{{\"domain\":\"maison\",\"node\":\"{mother}\",\"rubrique\":\"in_progress\",\"index\":0}}"),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        let (status, _, board) = call(
            &app,
            "POST",
            "/api/home/order",
            Some(&cookie),
            Some("application/json"),
            &format!("{{\"domain\":\"maison\",\"node\":\"{child}\",\"rubrique\":\"in_progress\",\"index\":0}}"),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(board.contains(&format!("id=\"gtd-node-{child}\"")));
        assert!(!board.contains(&format!("id=\"gtd-node-{mother}\"")));

        // The refused placement changed no status: the mother is still active.
        let (_, _, outline) = call(
            &app,
            "GET",
            "/domaine/maison/api/outline",
            Some(&cookie),
            None,
            "",
        )
        .await;
        let tree: Value = serde_json::from_str(&outline).unwrap();
        assert_eq!(tree[0]["status"], "in_progress");
        assert_eq!(tree[0]["children"][0]["status"], "in_progress");
    }

    #[tokio::test]
    async fn backup_carries_the_manual_order_and_accepts_its_absence() {
        let state = test_state();
        let cookie = signed_in_cookie(&state).await;
        let app = build_router(state);

        call(
            &app,
            "POST",
            "/api/domains",
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Maison",
        )
        .await;
        let (_, _, page) = call(&app, "GET", "/domaine/maison", Some(&cookie), None, "").await;
        let first = value_of(&page, "id=\"node-").to_string();
        let (_, headers, _) = call(
            &app,
            "POST",
            "/domaine/maison/api/nodes",
            Some(&cookie),
            None,
            "",
        )
        .await;
        let second = headers
            .get("x-new-node-id")
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();
        for id in [&first, &second] {
            call(
                &app,
                "POST",
                &format!("/domaine/maison/api/nodes/{id}/status"),
                Some(&cookie),
                Some("application/json"),
                "{\"status\":\"in_progress\",\"scope\":\"head\"}",
            )
            .await;
        }
        call(
            &app,
            "POST",
            "/api/home/order",
            Some(&cookie),
            Some("application/json"),
            &format!(
                "{{\"domain\":\"maison\",\"node\":\"{second}\",\"rubrique\":\"in_progress\",\"index\":0}}"
            ),
        )
        .await;

        let (status, _, body) = call(&app, "GET", "/api/backup", Some(&cookie), None, "").await;
        assert_eq!(status, StatusCode::OK);
        let mut doc: Value = serde_json::from_str(&body).unwrap();
        assert_eq!(doc["version"], 1);
        assert_eq!(
            doc["homeOrder"]["in_progress"],
            json!([second.clone(), first.clone()])
        );

        // A document without homeOrder restores the natural order.
        doc.as_object_mut().unwrap().remove("homeOrder");
        let (status, _, _) = call(
            &app,
            "POST",
            "/api/restore?confirm=replace",
            Some(&cookie),
            Some("application/json"),
            &serde_json::to_string(&doc).unwrap(),
        )
        .await;
        assert_eq!(status, StatusCode::SEE_OTHER);
        let (_, _, home) = call(&app, "GET", "/", Some(&cookie), None, "").await;
        assert!(
            home.find(&format!("id=\"gtd-node-{first}\"")).unwrap()
                < home.find(&format!("id=\"gtd-node-{second}\"")).unwrap()
        );

        // A malformed order is refused without touching the space.
        let mut malformed: Value = serde_json::from_str(&body).unwrap();
        malformed["homeOrder"] = json!("nope");
        let (status, _, _) = call(
            &app,
            "POST",
            "/api/restore?confirm=replace",
            Some(&cookie),
            Some("application/json"),
            &serde_json::to_string(&malformed).unwrap(),
        )
        .await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test]
    async fn reveal_survives_an_htmx_action() {
        let state = test_state();
        let (session_id, mut session) = state.sessions.create().await;
        session.user_id = Some("user-test".to_string());
        session.email = Some("test@example.fr".to_string());
        state.sessions.save(&session_id, &session).await;
        let cookie = state
            .sessions
            .cookie_header(&session_id, false)
            .split(';')
            .next()
            .unwrap()
            .to_string();
        let app = build_router(state);

        call(
            &app,
            "POST",
            "/api/domains",
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Maison",
        )
        .await;
        let (_, _, page) = call(&app, "GET", "/domaine/maison", Some(&cookie), None, "").await;
        let parent_id = value_of(&page, "id=\"node-").to_string();
        let (status, headers, _) = call(
            &app,
            "POST",
            "/domaine/maison/api/nodes",
            Some(&cookie),
            Some("application/json"),
            &format!("{{\"parentId\":\"{parent_id}\"}}"),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let child_id = headers
            .get("x-new-node-id")
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();

        let (status, _, collapsed) = call(
            &app,
            "POST",
            &format!("/domaine/maison/api/nodes/{parent_id}/toggle"),
            Some(&cookie),
            None,
            "",
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(!collapsed.contains(&format!("id=\"node-{child_id}\"")));
        assert!(collapsed.contains("collapsed"));

        let (status, _, revealed) = call(
            &app,
            "GET",
            &format!("/domaine/maison?reveal={child_id}"),
            Some(&cookie),
            None,
            "",
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(revealed.contains(&format!("id=\"node-{child_id}\"")));

        // htmx ajoute `reveal` aux paramètres du POST : le nouvel outline doit
        // garder l'ancêtre déplié même si le pli est persisté.
        let (status, _, after_action) = call(
            &app,
            "POST",
            &format!("/domaine/maison/api/nodes/{child_id}/status"),
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            &format!("status=in_progress&scope=head&reveal={child_id}"),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(after_action.contains(&format!("id=\"node-{child_id}\"")));
    }

    #[tokio::test]
    async fn administration_mutations() {
        let state = test_state();
        let cookie = signed_in_cookie(&state).await;
        let app = build_router(state);

        call(
            &app,
            "POST",
            "/api/domains",
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Maison",
        )
        .await;
        call(
            &app,
            "POST",
            "/api/domains",
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Jardin",
        )
        .await;
        let (_, _, admin) = call(&app, "GET", "/administration", Some(&cookie), None, "").await;
        let table = &admin[admin.find("admin-domains-table").expect("table")..];
        let maison_position = table.find("Maison").expect("Maison");
        let jardin_position = table.find("Jardin").expect("Jardin");
        assert!(maison_position < jardin_position, "ordre initial");
        let jardin_id = value_of(
            &table[table.find("Jardin").unwrap()..],
            "action=\"/api/domains/",
        )
        .split('/')
        .next()
        .unwrap()
        .to_string();

        let (status, _, _) = call(
            &app,
            "POST",
            &format!("/api/domains/{jardin_id}/move"),
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "dir=up&returnTo=%2Fadministration",
        )
        .await;
        assert_eq!(status, StatusCode::FOUND);
        let (_, _, admin) = call(&app, "GET", "/administration", Some(&cookie), None, "").await;
        let table = &admin[admin.find("admin-domains-table").expect("table")..];
        assert!(
            table.find("Jardin").unwrap() < table.find("Maison").unwrap(),
            "domaine déplacé vers le haut"
        );

        let domain_id = value_of(
            &table[table.find("Jardin").unwrap()..],
            "action=\"/api/domains/",
        )
        .split('/')
        .next()
        .unwrap()
        .to_string();
        let (status, headers, _) = call(
            &app,
            "POST",
            &format!("/api/domains/{domain_id}/rename"),
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Jardin+potager",
        )
        .await;
        assert_eq!(status, StatusCode::FOUND);
        assert_eq!(
            headers.get(header::LOCATION).unwrap(),
            "/domaine/jardin-potager"
        );

        call(
            &app,
            "POST",
            "/api/themes",
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Travaux&color=%2314b8a6",
        )
        .await;
        let (_, _, admin) = call(&app, "GET", "/administration", Some(&cookie), None, "").await;
        let theme_id = value_of(&admin, "action=\"/api/themes/")
            .split('/')
            .next()
            .unwrap()
            .to_string();

        let (status, _, _) = call(
            &app,
            "POST",
            &format!("/api/themes/{theme_id}/rename"),
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Chantier&color=%2314b8a6&returnTo=%2Fadministration",
        )
        .await;
        assert_eq!(status, StatusCode::FOUND);
        let (_, _, admin) = call(&app, "GET", "/administration", Some(&cookie), None, "").await;
        assert!(admin.contains("Chantier"));

        let (status, _, _) = call(
            &app,
            "POST",
            &format!("/api/themes/{theme_id}/delete"),
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "returnTo=%2Fadministration",
        )
        .await;
        assert_eq!(status, StatusCode::FOUND);
        let (_, _, admin) = call(&app, "GET", "/administration", Some(&cookie), None, "").await;
        assert!(!admin.contains("Chantier"));
    }

    #[tokio::test]
    async fn sidebar_is_flat_and_reorder_returns_to_the_page() {
        let state = test_state();
        let cookie = signed_in_cookie(&state).await;
        let app = build_router(state);

        for name in ["Alpha", "Beta"] {
            call(
                &app,
                "POST",
                "/api/domains",
                Some(&cookie),
                Some("application/x-www-form-urlencoded"),
                &format!("name={name}"),
            )
            .await;
        }

        let (status, _, page) = call(&app, "GET", "/domaine/alpha", Some(&cookie), None, "").await;
        assert_eq!(status, StatusCode::OK);
        assert!(!page.contains("theme-group"), "plus de groupes de thèmes");
        assert!(!page.contains("Sans thème"), "plus de section Sans thème");
        assert_eq!(page.matches("class=\"sidebar-domain\"").count(), 2);
        assert!(page.contains("class=\"sidebar-order\""));
        assert!(
            page.find(">Alpha</a>").unwrap() < page.find(">Beta</a>").unwrap(),
            "ordre initial"
        );

        let beta_at = page.find(">Beta</a>").unwrap();
        let beta_id = value_of(&page[beta_at..], "action=\"/api/domains/")
            .split('/')
            .next()
            .unwrap()
            .to_string();

        // A move keeps the user on the page it was submitted from.
        let (status, headers, _) = call(
            &app,
            "POST",
            &format!("/api/domains/{beta_id}/move"),
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "dir=up&returnTo=%2Fdomaine%2Falpha",
        )
        .await;
        assert_eq!(status, StatusCode::FOUND);
        assert_eq!(
            headers.get(header::LOCATION).unwrap(),
            "/domaine/alpha",
            "le déplacement revient sur la page courante"
        );

        let (_, _, page) = call(&app, "GET", "/domaine/alpha", Some(&cookie), None, "").await;
        assert!(
            page.find(">Beta</a>").unwrap() < page.find(">Alpha</a>").unwrap(),
            "domaine déplacé vers le haut"
        );

        // A non-local return target falls back to the administration page.
        let (status, headers, _) = call(
            &app,
            "POST",
            &format!("/api/domains/{beta_id}/move"),
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "dir=down&returnTo=https%3A%2F%2Fevil.test%2F",
        )
        .await;
        assert_eq!(status, StatusCode::FOUND);
        assert_eq!(
            headers.get(header::LOCATION).unwrap(),
            "/administration",
            "une cible non locale est refusée"
        );
    }

    fn without_exported_at(document: &Value) -> Value {
        let mut document = document.clone();
        if let Some(object) = document.as_object_mut() {
            object.remove("exportedAt");
        }
        document
    }

    #[tokio::test]
    async fn backup_export_restore_and_refusals() {
        let state = test_state();
        let cookie = signed_in_cookie(&state).await;
        let app = build_router(state.clone());

        let (status, _, _) = call(
            &app,
            "POST",
            "/api/themes",
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Maison&color=%23e11d48&returnTo=%2Fadministration",
        )
        .await;
        assert_eq!(status, StatusCode::FOUND);

        let (status, _, _) = call(
            &app,
            "POST",
            "/api/domains",
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Alpha&returnTo=%2Fadministration",
        )
        .await;
        assert_eq!(status, StatusCode::FOUND);

        let (status, _, page) = call(&app, "GET", "/domaine/alpha", Some(&cookie), None, "").await;
        assert_eq!(status, StatusCode::OK);
        let node_id = value_of(&page, "id=\"node-").to_string();
        let (status, _, _) = call(
            &app,
            "PUT",
            &format!("/domaine/alpha/api/nodes/{node_id}"),
            Some(&cookie),
            Some("application/json"),
            "{\"title\":\"Projet Alpha\"}",
        )
        .await;
        assert_eq!(status, StatusCode::OK);

        let (status, headers, body) =
            call(&app, "GET", "/api/backup", Some(&cookie), None, "").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(
            headers.get(header::CONTENT_TYPE).unwrap(),
            "application/json; charset=utf-8"
        );
        assert!(headers
            .get(header::CONTENT_DISPOSITION)
            .unwrap()
            .to_str()
            .unwrap()
            .starts_with("attachment; filename=\"docdoc-sauvegarde-"));
        assert_eq!(headers.get(header::CACHE_CONTROL).unwrap(), "no-store");
        let backup: Value = serde_json::from_str(&body).unwrap();
        assert_eq!(backup["format"], "docdoc-backup");
        assert_eq!(backup["version"], 1);
        let alpha = backup["domains"]
            .as_array()
            .unwrap()
            .iter()
            .find(|domain| domain["name"] == "Alpha")
            .cloned()
            .expect("domaine Alpha exporté");
        assert_eq!(alpha["projects"][0]["title"], "Projet Alpha");
        let alpha_id = alpha["id"].as_str().unwrap().to_string();

        // A domain created after the export must disappear at restore time.
        let (status, _, _) = call(
            &app,
            "POST",
            "/api/domains",
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "name=Delta&returnTo=%2Fadministration",
        )
        .await;
        assert_eq!(status, StatusCode::FOUND);

        let (status, headers, _) = call(
            &app,
            "POST",
            "/api/restore?confirm=replace",
            Some(&cookie),
            Some("application/json"),
            &body,
        )
        .await;
        assert_eq!(status, StatusCode::SEE_OTHER);
        assert_eq!(
            headers.get(header::LOCATION).unwrap(),
            "/administration?restaure=ok#admin-backup"
        );

        let (status, _, page) = call(
            &app,
            "GET",
            "/administration?restaure=ok",
            Some(&cookie),
            None,
            "",
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(page.contains("Sauvegarde restaurée"));
        assert!(page.contains("Alpha"));
        assert!(!page.contains("Delta"));
        assert!(page.contains("Maison"));

        // Archive Alpha, then restore the earlier document: the archive is
        // absent from it, so it must disappear and Alpha must come back active.
        let (status, _, _) = call(
            &app,
            "POST",
            &format!("/api/domains/{alpha_id}/archive"),
            Some(&cookie),
            Some("application/x-www-form-urlencoded"),
            "returnTo=%2Fadministration",
        )
        .await;
        assert_eq!(status, StatusCode::FOUND);
        let (_, _, archived_body) = call(&app, "GET", "/api/backup", Some(&cookie), None, "").await;
        let archived: Value = serde_json::from_str(&archived_body).unwrap();
        assert!(archived["archives"]
            .as_array()
            .unwrap()
            .iter()
            .any(|domain| domain["name"] == "Alpha"));

        let (status, _, _) = call(
            &app,
            "POST",
            "/api/restore?confirm=replace",
            Some(&cookie),
            Some("application/json"),
            &body,
        )
        .await;
        assert_eq!(status, StatusCode::SEE_OTHER);
        let (_, _, restored_body) = call(&app, "GET", "/api/backup", Some(&cookie), None, "").await;
        let restored: Value = serde_json::from_str(&restored_body).unwrap();
        assert!(restored["domains"]
            .as_array()
            .unwrap()
            .iter()
            .any(|domain| domain["name"] == "Alpha"));
        assert!(restored["archives"].as_array().unwrap().is_empty());

        // Refusals leave the stored document unchanged.
        let before = without_exported_at(&restored);
        for (uri, content_type, invalid_body, expected) in [
            (
                "/api/restore?confirm=replace",
                Some("application/json"),
                "{",
                StatusCode::BAD_REQUEST,
            ),
            (
                "/api/restore?confirm=replace",
                Some("application/json"),
                "{}",
                StatusCode::UNPROCESSABLE_ENTITY,
            ),
            (
                "/api/restore?confirm=replace",
                Some("text/plain"),
                "{}",
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
            ),
            (
                "/api/restore",
                Some("application/json"),
                "{}",
                StatusCode::UNPROCESSABLE_ENTITY,
            ),
        ] {
            let (status, _, _) =
                call(&app, "POST", uri, Some(&cookie), content_type, invalid_body).await;
            assert_eq!(status, expected, "uri {uri}");
        }
        let (_, _, after_body) = call(&app, "GET", "/api/backup", Some(&cookie), None, "").await;
        let after: Value = serde_json::from_str(&after_body).unwrap();
        assert_eq!(without_exported_at(&after), before);

        let huge = "x".repeat(BACKUP_MAX_BYTES + 1);
        let (status, _, _) = call(
            &app,
            "POST",
            "/api/restore?confirm=replace",
            Some(&cookie),
            Some("application/json"),
            &huge,
        )
        .await;
        assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);

        // The session still works: the restore never touched the account.
        let (status, _, body) = call(&app, "GET", "/api/me", Some(&cookie), None, "").await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("\"authenticated\":true"));

        // Both backup routes stay behind the session guard.
        let (status, _, _) = call(&app, "GET", "/api/backup", None, None, "").await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        let (status, _, _) = call(
            &app,
            "POST",
            "/api/restore?confirm=replace",
            None,
            Some("application/json"),
            "{}",
        )
        .await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);

        let (status, _, guide) = call(&app, "GET", "/aide", Some(&cookie), None, "").await;
        assert_eq!(status, StatusCode::OK);
        assert!(guide.contains("Sauvegarder et restaurer ses données"));
    }

    #[tokio::test]
    async fn backup_validation_rules() {
        let base = serde_json::json!({
            "format": "docdoc-backup",
            "version": 1,
            "exportedAt": "2026-01-01T00:00:00.000Z",
            "themes": [{"id": "t1", "name": "Maison", "color": "#fff"}],
            "domains": [{
                "id": "d1",
                "name": "Alpha",
                "slug": "alpha",
                "order": 0,
                "labels": ["t1"],
                "projects": [{
                    "id": "n1",
                    "title": "Racine",
                    "status": "todo",
                    "collapsed": false,
                    "children": []
                }],
                "displayOrder": ["n1"]
            }],
            "archives": []
        });
        assert!(validate_backup(&base).is_ok());

        let mut doc = base.clone();
        doc["format"] = serde_json::json!("autre");
        assert!(validate_backup(&doc).is_err());

        let mut doc = base.clone();
        doc["version"] = serde_json::json!(2);
        assert!(validate_backup(&doc).is_err());

        let mut doc = base.clone();
        let duplicate = doc["domains"][0].clone();
        doc["domains"].as_array_mut().unwrap().push(duplicate);
        assert!(validate_backup(&doc).is_err());

        let mut doc = base.clone();
        let mut copy = doc["domains"][0].clone();
        copy["id"] = serde_json::json!("d2");
        doc["domains"].as_array_mut().unwrap().push(copy);
        assert!(validate_backup(&doc).is_err());

        let mut doc = base.clone();
        doc["domains"][0]["labels"] = serde_json::json!(["absent"]);
        assert!(validate_backup(&doc).is_err());

        let mut doc = base.clone();
        doc["domains"][0]["projects"][0]["status"] = serde_json::json!("blocked");
        assert!(validate_backup(&doc).is_err());

        let mut doc = base.clone();
        doc["domains"][0]["projects"][0]["id"] = serde_json::json!("");
        assert!(validate_backup(&doc).is_err());

        let mut doc = base.clone();
        doc["domains"][0]["projects"][0]["children"] = serde_json::json!("nope");
        assert!(validate_backup(&doc).is_err());
    }
}
