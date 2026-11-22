//! Stockage objet compatible S3.
//!
//! Même disposition de clés que `storage.js` : tout ce qu'un compte possède vit
//! sous `users/{userId}/`, les clés racine (`domains/`, `archive/`,
//! `themes.json`) ne servent qu'à l'adoption unique des données antérieures.
//!
//! Le client S3 est implémenté directement au-dessus de `reqwest` et de SigV4
//! plutôt que via le SDK AWS : l'application n'utilise que six opérations, et
//! cela évite une dépendance de compilation très lourde. Un backend mémoire
//! (sans configuration) et un backend fichier (`DOCDOC_STORAGE_DIR`) permettent
//! de lancer l'application et les tests sans MinIO.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::Utc;
use hmac::{Hmac, Mac};
use quick_xml::events::Event;
use quick_xml::Reader;
use reqwest::Method;
use serde_json::Value;
use sha2::{Digest, Sha256};
use tokio::sync::Mutex;
use tracing::{error, warn};

use crate::config::{Config, S3Config};

pub const USERS_PREFIX: &str = "users/";
pub const LEGACY_DOMAINS_PREFIX: &str = "domains/";
pub const LEGACY_ARCHIVE_PREFIX: &str = "archive/";
pub const LEGACY_THEMES_KEY: &str = "themes.json";

pub fn user_prefix(user_id: &str) -> String {
    format!("{USERS_PREFIX}{user_id}/")
}

pub fn user_key(user_id: &str, suffix: &str) -> String {
    format!("{}{suffix}", user_prefix(user_id))
}

pub fn domain_key(user_id: &str, id: &str) -> String {
    user_key(user_id, &format!("domains/{id}.json"))
}

pub fn archive_key(user_id: &str, id: &str) -> String {
    user_key(user_id, &format!("archive/{id}.json"))
}

pub fn themes_key(user_id: &str) -> String {
    user_key(user_id, "themes.json")
}

/// Ordre manuel des tâches de l'accueil : un tableau d'identifiants par rubrique.
pub fn home_order_key(user_id: &str) -> String {
    user_key(user_id, "home-order.json")
}

pub fn account_key(user_id: &str) -> String {
    user_key(user_id, "account.json")
}

pub struct Storage {
    backend: Backend,
    describe: String,
}

enum Backend {
    Memory(Mutex<HashMap<String, Vec<u8>>>),
    Fs(PathBuf),
    S3(S3Client),
}

impl Storage {
    /// Backend mémoire, utile aux tests et aux exécutions sans configuration.
    pub fn memory() -> Storage {
        Storage {
            backend: Backend::Memory(Mutex::new(HashMap::new())),
            describe: "mémoire du processus (aucune persistance)".to_string(),
        }
    }

    pub fn from_config(config: &Config) -> Storage {
        if let Some(s3) = config.s3.clone().filter(|s3| s3.is_configured()) {
            let describe = format!(
                "bucket S3 « {} » ({}), une arborescence par compte sous users/{{userId}}/",
                s3.bucket, s3.endpoint
            );
            return Storage {
                backend: Backend::S3(S3Client::new(s3)),
                describe,
            };
        }
        if let Some(dir) = &config.storage_dir {
            return Storage {
                backend: Backend::Fs(dir.clone()),
                describe: format!("répertoire local « {} »", dir.display()),
            };
        }
        Storage {
            backend: Backend::Memory(Mutex::new(HashMap::new())),
            describe: "mémoire du processus (aucune persistance)".to_string(),
        }
    }

    pub fn is_configured(&self) -> bool {
        !matches!(self.backend, Backend::Memory(_))
    }

    pub fn describe(&self) -> &str {
        &self.describe
    }

    pub async fn ensure_ready(&self) -> Result<(), String> {
        match &self.backend {
            Backend::S3(client) => client.ensure_bucket().await,
            Backend::Fs(dir) => tokio::fs::create_dir_all(dir)
                .await
                .map_err(|err| err.to_string()),
            Backend::Memory(_) => Ok(()),
        }
    }

    pub async fn read_json(&self, key: &str) -> Option<Value> {
        let raw = match &self.backend {
            Backend::Memory(store) => store.lock().await.get(key).cloned(),
            Backend::Fs(dir) => match tokio::fs::read(path_for(dir, key)).await {
                Ok(body) => Some(body),
                Err(err) if err.kind() == std::io::ErrorKind::NotFound => None,
                Err(err) => {
                    error!("lecture {key}: {err}");
                    None
                }
            },
            Backend::S3(client) => match client.get(key).await {
                Ok(Some(body)) => Some(body),
                Ok(None) => None,
                Err(err) => {
                    error!("lecture S3 {key}: {err}");
                    None
                }
            },
        }?;
        serde_json::from_slice(&raw).ok()
    }

    pub async fn write_json(&self, key: &str, data: &Value) -> Result<(), String> {
        let body = serde_json::to_vec_pretty(data).map_err(|err| err.to_string())?;
        match &self.backend {
            Backend::Memory(store) => {
                store.lock().await.insert(key.to_string(), body);
                Ok(())
            }
            Backend::Fs(dir) => {
                let path = path_for(dir, key);
                if let Some(parent) = path.parent() {
                    tokio::fs::create_dir_all(parent)
                        .await
                        .map_err(|err| err.to_string())?;
                }
                tokio::fs::write(path, body)
                    .await
                    .map_err(|err| err.to_string())
            }
            Backend::S3(client) => client.put(key, body).await,
        }
    }

    pub async fn list_keys(&self, prefix: &str) -> Vec<String> {
        match &self.backend {
            Backend::Memory(store) => {
                let mut keys: Vec<String> = store
                    .lock()
                    .await
                    .keys()
                    .filter(|key| key.starts_with(prefix))
                    .cloned()
                    .collect();
                keys.sort();
                keys
            }
            Backend::Fs(dir) => list_fs_keys(dir, prefix).await,
            Backend::S3(client) => match client.list(prefix).await {
                Ok(keys) => keys,
                Err(err) => {
                    error!("liste S3 {prefix}: {err}");
                    Vec::new()
                }
            },
        }
    }

    pub async fn move_object(&self, src: &str, dest: &str) -> Result<(), String> {
        match &self.backend {
            Backend::Memory(store) => {
                let mut store = store.lock().await;
                if let Some(body) = store.remove(src) {
                    store.insert(dest.to_string(), body);
                }
                Ok(())
            }
            Backend::Fs(dir) => {
                let src_path = path_for(dir, src);
                let dest_path = path_for(dir, dest);
                if let Some(parent) = dest_path.parent() {
                    tokio::fs::create_dir_all(parent)
                        .await
                        .map_err(|err| err.to_string())?;
                }
                match tokio::fs::rename(&src_path, &dest_path).await {
                    Ok(()) => Ok(()),
                    Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
                    Err(err) => Err(err.to_string()),
                }
            }
            Backend::S3(client) => client.copy(src, dest).await,
        }
    }

    pub async fn delete_object(&self, key: &str) -> Result<(), String> {
        match &self.backend {
            Backend::Memory(store) => {
                store.lock().await.remove(key);
                Ok(())
            }
            Backend::Fs(dir) => match tokio::fs::remove_file(path_for(dir, key)).await {
                Ok(()) => Ok(()),
                Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
                Err(err) => Err(err.to_string()),
            },
            Backend::S3(client) => client.delete(key).await,
        }
    }

    pub async fn list_domain_keys(&self, user_id: &str) -> Vec<String> {
        self.list_keys(&user_key(user_id, "domains/")).await
    }

    pub async fn list_archive_keys(&self, user_id: &str) -> Vec<String> {
        self.list_keys(&user_key(user_id, "archive/")).await
    }
}

fn path_for(root: &Path, key: &str) -> PathBuf {
    let mut path = root.to_path_buf();
    for segment in key.split('/') {
        if segment.is_empty() || segment == "." || segment == ".." {
            continue;
        }
        path.push(segment);
    }
    path
}

async fn list_fs_keys(root: &Path, prefix: &str) -> Vec<String> {
    async fn walk(dir: &Path, root: &Path, out: &mut Vec<String>) {
        let Ok(mut entries) = tokio::fs::read_dir(dir).await else {
            return;
        };
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            let Ok(file_type) = entry.file_type().await else {
                continue;
            };
            if file_type.is_dir() {
                Box::pin(walk(&path, root, out)).await;
            } else if file_type.is_file() {
                if let Ok(relative) = path.strip_prefix(root) {
                    let key = relative
                        .components()
                        .map(|part| part.as_os_str().to_string_lossy())
                        .collect::<Vec<_>>()
                        .join("/");
                    out.push(key);
                }
            }
        }
    }
    let mut keys = Vec::new();
    walk(root, root, &mut keys).await;
    keys.retain(|key| key.starts_with(prefix));
    keys.sort();
    keys
}

/* ------------------------------------------------------------------ */
/* Client S3 + signature SigV4                                         */
/* ------------------------------------------------------------------ */

struct S3Client {
    http: reqwest::Client,
    endpoint: String,
    bucket: String,
    region: String,
    access_key_id: String,
    secret_access_key: String,
}

impl S3Client {
    fn new(config: S3Config) -> S3Client {
        S3Client {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
            endpoint: config.endpoint.trim_end_matches('/').to_string(),
            bucket: config.bucket,
            region: config.region,
            access_key_id: config.access_key_id,
            secret_access_key: config.secret_access_key,
        }
    }

    async fn ensure_bucket(&self) -> Result<(), String> {
        let response = self
            .send(Method::HEAD, Some(""), &[], Vec::new(), Vec::new(), None)
            .await?;
        if response.status().is_success() {
            return Ok(());
        }
        let response = self
            .send(Method::PUT, Some(""), &[], Vec::new(), Vec::new(), None)
            .await?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!(
                "création du bucket {} impossible ({})",
                self.bucket,
                response.status()
            ))
        }
    }

    async fn get(&self, key: &str) -> Result<Option<Vec<u8>>, String> {
        let response = self
            .send(Method::GET, Some(key), &[], Vec::new(), Vec::new(), None)
            .await?;
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }
        if !response.status().is_success() {
            return Err(format!("GET {key}: {}", response.status()));
        }
        response
            .bytes()
            .await
            .map(|bytes| Some(bytes.to_vec()))
            .map_err(|err| err.to_string())
    }

    async fn put(&self, key: &str, body: Vec<u8>) -> Result<(), String> {
        let response = self
            .send(
                Method::PUT,
                Some(key),
                &[],
                body,
                Vec::new(),
                Some("application/json"),
            )
            .await?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("PUT {key}: {}", response.status()))
        }
    }

    async fn delete(&self, key: &str) -> Result<(), String> {
        let response = self
            .send(Method::DELETE, Some(key), &[], Vec::new(), Vec::new(), None)
            .await?;
        if response.status().is_success() || response.status() == reqwest::StatusCode::NOT_FOUND {
            Ok(())
        } else {
            Err(format!("DELETE {key}: {}", response.status()))
        }
    }

    async fn copy(&self, src: &str, dest: &str) -> Result<(), String> {
        let source = format!("/{}/{}", self.bucket, src);
        let encoded_source = uri_encode(&source, false);
        let headers = vec![("x-amz-copy-source".to_string(), encoded_source)];
        let response = self
            .send(Method::PUT, Some(dest), &[], Vec::new(), headers, None)
            .await?;
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        if !status.is_success() || body.contains("<Error>") {
            return Err(format!("COPY {src} -> {dest}: {status} {body}"));
        }
        self.delete(src).await
    }

    async fn list(&self, prefix: &str) -> Result<Vec<String>, String> {
        let mut keys = Vec::new();
        let mut token: Option<String> = None;
        loop {
            let mut query = vec![
                ("list-type".to_string(), "2".to_string()),
                ("prefix".to_string(), prefix.to_string()),
            ];
            if let Some(token) = &token {
                query.push(("continuation-token".to_string(), token.clone()));
            }
            let response = self
                .send(Method::GET, None, &query, Vec::new(), Vec::new(), None)
                .await?;
            if !response.status().is_success() {
                return Err(format!("LIST {prefix}: {}", response.status()));
            }
            let body = response.text().await.map_err(|err| err.to_string())?;
            let (page_keys, next) = parse_list_response(&body);
            keys.extend(page_keys);
            match next {
                Some(next) => token = Some(next),
                None => break,
            }
        }
        Ok(keys)
    }

    async fn send(
        &self,
        method: Method,
        key: Option<&str>,
        query: &[(String, String)],
        body: Vec<u8>,
        extra_headers: Vec<(String, String)>,
        content_type: Option<&str>,
    ) -> Result<reqwest::Response, String> {
        let endpoint = reqwest::Url::parse(&self.endpoint)
            .map_err(|err| format!("endpoint S3 invalide: {err}"))?;
        let base_path = endpoint.path().trim_end_matches('/');
        let path = match key {
            Some("") => format!("{base_path}/{}", self.bucket),
            Some(key) => format!("{base_path}/{}/{}", self.bucket, uri_encode(key, false)),
            None => format!("{base_path}/{}", self.bucket),
        };

        let mut canonical_query_pairs: Vec<(String, String)> = query
            .iter()
            .map(|(name, value)| (uri_encode(name, true), uri_encode(value, true)))
            .collect();
        canonical_query_pairs.sort();
        let canonical_query = canonical_query_pairs
            .iter()
            .map(|(name, value)| format!("{name}={value}"))
            .collect::<Vec<_>>()
            .join("&");

        let host = match (endpoint.host_str(), endpoint.port()) {
            (Some(host), Some(port)) => format!("{host}:{port}"),
            (Some(host), None) => host.to_string(),
            (None, _) => return Err("endpoint S3 sans hôte".to_string()),
        };

        let amz_date = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
        let date = &amz_date[..8];
        let payload_hash = sha256_hex(&body);

        let mut headers: Vec<(String, String)> = vec![
            ("host".to_string(), host),
            ("x-amz-content-sha256".to_string(), payload_hash.clone()),
            ("x-amz-date".to_string(), amz_date.clone()),
        ];
        headers.extend(
            extra_headers
                .iter()
                .map(|(name, value)| (name.to_ascii_lowercase(), value.trim().to_string())),
        );
        headers.sort_by(|a, b| a.0.cmp(&b.0));
        let signed_headers = headers
            .iter()
            .map(|(name, _)| name.as_str())
            .collect::<Vec<_>>()
            .join(";");
        let canonical_headers = headers
            .iter()
            .map(|(name, value)| format!("{name}:{value}\n"))
            .collect::<String>();

        let canonical_request = format!(
            "{}\n{}\n{}\n{}\n{}\n{}",
            method.as_str(),
            path,
            canonical_query,
            canonical_headers,
            signed_headers,
            payload_hash
        );
        let scope = format!("{date}/{}/s3/aws4_request", self.region);
        let string_to_sign = format!(
            "AWS4-HMAC-SHA256\n{}\n{}\n{}",
            amz_date,
            scope,
            sha256_hex(canonical_request.as_bytes())
        );
        let signing_key = signing_key(&self.secret_access_key, date, &self.region);
        let signature = hex::encode(hmac_sha256(&signing_key, string_to_sign.as_bytes()));
        let authorization = format!(
            "AWS4-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
            self.access_key_id, scope, signed_headers, signature
        );

        let mut url = format!("{}{}", self.endpoint, path);
        if !canonical_query.is_empty() {
            url.push('?');
            url.push_str(&canonical_query);
        }

        let mut request = self
            .http
            .request(method, url)
            .header("x-amz-date", amz_date)
            .header("x-amz-content-sha256", payload_hash)
            .header("authorization", authorization);
        for (name, value) in &extra_headers {
            request = request.header(name, value);
        }
        if let Some(content_type) = content_type {
            request = request.header("content-type", content_type);
        }
        request
            .body(body)
            .send()
            .await
            .map_err(|err| err.to_string())
    }
}

fn sha256_hex(input: impl AsRef<[u8]>) -> String {
    hex::encode(Sha256::digest(input.as_ref()))
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("clé HMAC de taille arbitraire");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

fn signing_key(secret: &str, date: &str, region: &str) -> Vec<u8> {
    let k_date = hmac_sha256(format!("AWS4{secret}").as_bytes(), date.as_bytes());
    let k_region = hmac_sha256(&k_date, region.as_bytes());
    let k_service = hmac_sha256(&k_region, b"s3");
    hmac_sha256(&k_service, b"aws4_request")
}

fn uri_encode(input: &str, encode_slash: bool) -> String {
    let mut out = String::with_capacity(input.len());
    for byte in input.bytes() {
        let unreserved = byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~');
        if unreserved || (!encode_slash && byte == b'/') {
            out.push(byte as char);
        } else {
            out.push('%');
            out.push_str(&format!("{byte:02X}"));
        }
    }
    out
}

fn parse_list_response(body: &str) -> (Vec<String>, Option<String>) {
    let mut reader = Reader::from_str(body);
    reader.config_mut().trim_text(true);
    let mut keys = Vec::new();
    let mut truncated = false;
    let mut next_token: Option<String> = None;
    loop {
        match reader.read_event() {
            Ok(Event::Start(event)) => {
                let name = event.name();
                match name.as_ref() {
                    b"Key" => {
                        if let Ok(text) = reader.read_text(name) {
                            keys.push(text.to_string());
                        }
                    }
                    b"IsTruncated" => {
                        if let Ok(text) = reader.read_text(name) {
                            truncated = text.trim().eq_ignore_ascii_case("true");
                        }
                    }
                    b"NextContinuationToken" => {
                        if let Ok(text) = reader.read_text(name) {
                            next_token = Some(text.to_string());
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(err) => {
                warn!("réponse ListObjectsV2 illisible: {err}");
                break;
            }
            _ => {}
        }
    }
    if !truncated {
        next_token = None;
    }
    (keys, next_token)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_follow_the_account_layout() {
        assert_eq!(domain_key("u1", "d1"), "users/u1/domains/d1.json");
        assert_eq!(archive_key("u1", "d1"), "users/u1/archive/d1.json");
        assert_eq!(themes_key("u1"), "users/u1/themes.json");
        assert_eq!(account_key("u1"), "users/u1/account.json");
    }

    #[test]
    fn uri_encode_matches_rfc3986() {
        assert_eq!(uri_encode("a b/c", true), "a%20b%2Fc");
        assert_eq!(uri_encode("a b/c", false), "a%20b/c");
        assert_eq!(uri_encode("a-_.~", true), "a-_.~");
    }

    #[tokio::test]
    async fn memory_backend_round_trip() {
        let config = crate::config::Config {
            port: 0,
            bind_host: "127.0.0.1".to_string(),
            is_production: false,
            session_secret: b"test".to_vec(),
            app_version: String::new(),
            authorized_emails: vec![],
            mail: crate::config::MailConfig {
                provider: "dev".into(),
                from: String::new(),
                from_name: String::new(),
                region: String::new(),
                secret_key: String::new(),
                project_id: String::new(),
                brevo_api_key: String::new(),
                smtp_host: String::new(),
                smtp_port: 1025,
                smtp_secure: false,
                smtp_require_tls: false,
                smtp_allow_self_signed: false,
                smtp_user: String::new(),
                smtp_password: String::new(),
                smtp_timeout_ms: 1000,
            },
            s3: None,
            storage_dir: None,
            public_dir: ".".into(),
            data_dir: ".".into(),
            rp_id: None,
            rp_origin: None,
        };
        let storage = Storage::from_config(&config);
        let value = serde_json::json!({"hello": "world"});
        storage
            .write_json("users/u/themes.json", &value)
            .await
            .unwrap();
        assert_eq!(
            storage.read_json("users/u/themes.json").await.unwrap(),
            value
        );
        assert_eq!(
            storage.list_keys("users/u/").await,
            vec!["users/u/themes.json"]
        );
        storage
            .move_object("users/u/themes.json", "users/u/archive.json")
            .await
            .unwrap();
        assert!(storage.read_json("users/u/themes.json").await.is_none());
        storage.delete_object("users/u/archive.json").await.unwrap();
        assert!(storage.list_keys("users/u/").await.is_empty());
    }

    #[test]
    fn parses_list_objects_v2() {
        let body = r#"<?xml version="1.0" encoding="UTF-8"?>
        <ListBucketResult>
          <Contents><Key>users/u/domains/a.json</Key></Contents>
          <Contents><Key>users/u/domains/b.json</Key></Contents>
          <IsTruncated>true</IsTruncated>
          <NextContinuationToken>tok</NextContinuationToken>
        </ListBucketResult>"#;
        let (keys, token) = parse_list_response(body);
        assert_eq!(
            keys,
            vec!["users/u/domains/a.json", "users/u/domains/b.json"]
        );
        assert_eq!(token.as_deref(), Some("tok"));
    }
}
