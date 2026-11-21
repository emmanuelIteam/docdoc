//! Configuration de l'application.
//!
//! Même contrat que `env.js` + `server.js` côté Node :
//!
//! - un fichier `.env` optionnel remplit les variables **absentes** de
//!   l'environnement ; une variable exportée gagne toujours ;
//! - `DOCDOC_ENV_FILE` choisit un autre fichier (un chemin inexistant désactive
//!   la lecture) ;
//! - `SESSION_SECRET` est obligatoire en production, éphémère en développement.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use rand::RngCore;

/// Valeurs par défaut de la palette des thèmes (identiques à `server.js`).
pub const DEFAULT_THEME_COLORS: [&str; 6] = [
    "#2563eb", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981",
];

const DEFAULT_AUTHORIZED_EMAIL: &str = "emmanuel.grandiere@laposte.net";

#[derive(Clone, Debug)]
pub struct S3Config {
    pub endpoint: String,
    pub region: String,
    pub bucket: String,
    pub access_key_id: String,
    pub secret_access_key: String,
}

impl S3Config {
    pub fn is_configured(&self) -> bool {
        !self.endpoint.is_empty()
            && !self.bucket.is_empty()
            && !self.access_key_id.is_empty()
            && !self.secret_access_key.is_empty()
    }
}

#[derive(Clone, Debug)]
pub struct MailConfig {
    pub provider: String,
    pub from: String,
    pub from_name: String,
    pub region: String,
    pub secret_key: String,
    pub project_id: String,
    pub brevo_api_key: String,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_secure: bool,
    pub smtp_require_tls: bool,
    pub smtp_allow_self_signed: bool,
    pub smtp_user: String,
    pub smtp_password: String,
    pub smtp_timeout_ms: u64,
}

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub bind_host: String,
    pub is_production: bool,
    pub session_secret: Vec<u8>,
    pub app_version: String,
    pub authorized_emails: Vec<String>,
    pub mail: MailConfig,
    pub s3: Option<S3Config>,
    pub storage_dir: Option<PathBuf>,
    pub public_dir: PathBuf,
    pub data_dir: PathBuf,
    pub rp_id: Option<String>,
    pub rp_origin: Option<String>,
}

impl Config {
    pub fn load() -> Result<Config, String> {
        load_dotenv();

        let is_production = env_str("NODE_ENV") == "production";

        let session_secret = match env_str("SESSION_SECRET") {
            value if !value.is_empty() => value.into_bytes(),
            _ if is_production => {
                return Err("SESSION_SECRET est obligatoire en production.".to_string())
            }
            _ => {
                eprintln!("⚠ SESSION_SECRET absent : un secret éphémère est utilisé pour cette exécution.");
                let mut secret = vec![0u8; 32];
                rand::thread_rng().fill_bytes(&mut secret);
                secret
            }
        };

        let authorized_emails = env_str("AUTHORIZED_EMAILS");
        let authorized_emails = if authorized_emails.is_empty() {
            DEFAULT_AUTHORIZED_EMAIL.to_string()
        } else {
            authorized_emails
        }
        .split(',')
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty())
        .collect();

        let s3 = S3Config {
            endpoint: env_str("S3_ENDPOINT"),
            region: {
                let region = env_str("S3_REGION");
                if region.is_empty() {
                    "fr-par".to_string()
                } else {
                    region
                }
            },
            bucket: env_str("S3_BUCKET"),
            access_key_id: env_str("AWS_ACCESS_KEY_ID"),
            secret_access_key: env_str("AWS_SECRET_ACCESS_KEY"),
        };

        let mail = MailConfig {
            provider: {
                let provider = env_str("EMAIL_PROVIDER").to_lowercase();
                if provider.is_empty() {
                    "dev".to_string()
                } else {
                    provider
                }
            },
            from: env_str("EMAIL_FROM"),
            from_name: {
                let name = env_str("EMAIL_FROM_NAME");
                if name.is_empty() {
                    "docdoc".to_string()
                } else {
                    name
                }
            },
            region: {
                let region = env_str("EMAIL_REGION");
                if region.is_empty() {
                    "fr-par".to_string()
                } else {
                    region
                }
            },
            secret_key: {
                let value = env_str("SCW_SECRET_KEY");
                if value.is_empty() {
                    env_str("EMAIL_API_KEY")
                } else {
                    value
                }
            },
            project_id: env_str("SCW_DEFAULT_PROJECT_ID"),
            brevo_api_key: env_str("BREVO_API_KEY"),
            smtp_host: env_str("SMTP_HOST"),
            smtp_port: env_u16("SMTP_PORT", 1026),
            smtp_secure: env_bool("SMTP_SECURE"),
            smtp_require_tls: env_bool("SMTP_REQUIRE_TLS"),
            smtp_allow_self_signed: env_bool("SMTP_ALLOW_SELF_SIGNED"),
            smtp_user: env_str("SMTP_USER"),
            smtp_password: env_str("SMTP_PASSWORD"),
            smtp_timeout_ms: env_u64("SMTP_TIMEOUT_MS", 10_000),
        };

        let storage_dir = match env_str("DOCDOC_STORAGE_DIR") {
            value if !value.is_empty() => Some(PathBuf::from(value)),
            _ => None,
        };

        let public_dir = match env_str("DOCDOC_PUBLIC_DIR") {
            value if !value.is_empty() => PathBuf::from(value),
            _ => default_dir("public", "../public"),
        };

        let data_dir = match env_str("DOCDOC_DATA_DIR") {
            value if !value.is_empty() => PathBuf::from(value),
            _ => default_dir("data", "../data"),
        };

        let rp_id = match env_str("RP_ID") {
            value if !value.is_empty() => Some(value),
            _ => None,
        };
        let rp_origin = match env_str("RP_ORIGIN") {
            value if !value.is_empty() => Some(value),
            _ => None,
        };

        Ok(Config {
            port: env_u16("PORT", 3000),
            bind_host: {
                let host = env_str("HOST");
                if host.is_empty() {
                    "0.0.0.0".to_string()
                } else {
                    host
                }
            },
            is_production,
            session_secret,
            app_version: env_str("APP_VERSION"),
            authorized_emails,
            mail,
            s3: Some(s3),
            storage_dir,
            public_dir,
            data_dir,
            rp_id,
            rp_origin,
        })
    }

    /// `true` quand un couple RP_ID/RP_ORIGIN figé est disponible.
    pub fn has_fixed_relying_party(&self) -> bool {
        self.rp_id.is_some() && self.rp_origin.is_some()
    }

    /// Résout la partie relying party d'une requête, avec la même règle que
    /// `passkeys.relyingParty` : configuration figée, sinon déduction de
    /// l'adresse en développement, sinon erreur en production.
    pub fn relying_party(
        &self,
        host: Option<&str>,
        forwarded_proto: Option<&str>,
    ) -> Result<(String, String), String> {
        if let (Some(id), Some(origin)) = (&self.rp_id, &self.rp_origin) {
            return Ok((id.clone(), origin.clone()));
        }
        if self.is_production {
            return Err(
                "RP_ID et RP_ORIGIN sont obligatoires en production (nom d'hôte et origine HTTPS de l'application)."
                    .to_string(),
            );
        }
        let host = host
            .map(|value| value.to_string())
            .unwrap_or_else(|| format!("localhost:{}", self.port));
        let host_only = host.split(':').next().unwrap_or("localhost").to_string();
        let proto = forwarded_proto.unwrap_or("http");
        Ok((host_only, format!("{proto}://{host}")))
    }

    pub fn storage_is_configured(&self) -> bool {
        self.s3
            .as_ref()
            .map(|s3| s3.is_configured())
            .unwrap_or(false)
    }

    pub fn bucket(&self) -> &str {
        self.s3.as_ref().map(|s3| s3.bucket.as_str()).unwrap_or("")
    }
}

fn default_dir(local: &str, parent: &str) -> PathBuf {
    if Path::new(local).exists() {
        PathBuf::from(local)
    } else {
        PathBuf::from(parent)
    }
}

fn env_str(name: &str) -> String {
    std::env::var(name).unwrap_or_default().trim().to_string()
}

fn env_u16(name: &str, fallback: u16) -> u16 {
    std::env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<u16>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(fallback)
}

fn env_u64(name: &str, fallback: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(fallback)
}

fn env_bool(name: &str) -> bool {
    std::env::var(name)
        .map(|value| value.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

/// Chemin du fichier `.env` : `DOCDOC_ENV_FILE` s'il est défini (même vide),
/// sinon `../.env` puis `.env`.
fn env_file_path() -> Option<PathBuf> {
    if let Ok(value) = std::env::var("DOCDOC_ENV_FILE") {
        if value.is_empty() {
            return None;
        }
        return Some(PathBuf::from(value));
    }
    for candidate in ["../.env", ".env"] {
        let path = PathBuf::from(candidate);
        if path.exists() {
            return Some(path);
        }
    }
    None
}

/// Charge le fichier `.env` sans écraser une variable déjà présente.
pub fn load_dotenv() -> Vec<String> {
    let Some(path) = env_file_path() else {
        return Vec::new();
    };
    let Ok(contents) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    let values = parse_dotenv(&contents);
    let mut applied = Vec::new();
    for (key, value) in values {
        if std::env::var_os(&key).is_none() {
            std::env::set_var(&key, &value);
            applied.push(key);
        }
    }
    applied
}

/// Parse minimaliste, identique à `env.js` : commentaires `#`, guillemets
/// simples ou doubles, commentaire de fin non quoté.
pub fn parse_dotenv(contents: &str) -> HashMap<String, String> {
    let mut values = HashMap::new();
    for raw_line in contents.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some(separator) = line.find('=') else {
            continue;
        };
        if separator == 0 {
            continue;
        }
        let key = line[..separator].trim();
        if !is_valid_key(key) {
            continue;
        }
        let mut value = line[separator + 1..].trim().to_string();
        let quoted = value.len() >= 2
            && ((value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\'')));
        if quoted {
            value = value[1..value.len() - 1].to_string();
        } else if let Some(comment) = value.find(" #") {
            value = value[..comment].trim().to_string();
        }
        values.insert(key.to_string(), value);
    }
    values
}

fn is_valid_key(key: &str) -> bool {
    let mut chars = key.chars();
    match chars.next() {
        Some(first) if first.is_ascii_alphabetic() || first == '_' => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_dotenv_quotes_and_comments() {
        let parsed = parse_dotenv(
            "# un commentaire\nA=1\nB=\"deux mots\"\nC='trois'\nD=valeur # explication\nE=a#b\n",
        );
        assert_eq!(parsed.get("A").unwrap(), "1");
        assert_eq!(parsed.get("B").unwrap(), "deux mots");
        assert_eq!(parsed.get("C").unwrap(), "trois");
        assert_eq!(parsed.get("D").unwrap(), "valeur");
        assert_eq!(parsed.get("E").unwrap(), "a#b");
    }

    #[test]
    fn parse_dotenv_rejects_bad_keys() {
        let parsed = parse_dotenv("1A=x\nB-C=y\n_OK=z\n");
        assert!(!parsed.contains_key("1A"));
        assert!(!parsed.contains_key("B-C"));
        assert_eq!(parsed.get("_OK").unwrap(), "z");
    }
}
