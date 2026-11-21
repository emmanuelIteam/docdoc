//! Envoi du code à usage unique.
//!
//! Quatre fournisseurs derrière une seule interface : `dev` (journal),
//! `smtp` (relais local ou industriel), `scaleway` (API Transactional Email) et
//! `brevo`. `send_code` ne panique ni ne propage d'erreur : un échec est rendu
//! à l'appelant pour que le visiteur puisse être prévenu.

use std::time::Duration;

use lettre::message::{Mailbox, MultiPart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use serde_json::json;
use tracing::{error, warn};

use crate::config::MailConfig;

pub const DEFAULT_TTL_MINUTES: i64 = 10;

pub struct Delivery {
    pub ok: bool,
    pub provider: String,
    pub error: Option<String>,
}

pub struct Mailer {
    pub config: MailConfig,
    http: reqwest::Client,
    smtp: Option<AsyncSmtpTransport<Tokio1Executor>>,
}

impl Mailer {
    pub fn new(config: MailConfig) -> Mailer {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        let smtp = if config.provider == "smtp" {
            build_smtp_transport(&config)
        } else {
            None
        };
        Mailer { config, http, smtp }
    }

    pub fn is_dev_mode(&self) -> bool {
        self.config.provider == "dev"
    }

    pub fn describe(&self) -> String {
        let config = &self.config;
        match config.provider.as_str() {
            "dev" => "mode développement — aucun email n'est envoyé, le code s'affiche dans ces journaux (ligne « [docdoc][dev] code pour … »)".to_string(),
            "scaleway" => format!(
                "Scaleway Transactional Email ({}), expéditeur {}",
                config.region,
                display_or_missing(&config.from, "EMAIL_FROM")
            ),
            "brevo" => format!(
                "Brevo, expéditeur {}",
                display_or_missing(&config.from, "EMAIL_FROM")
            ),
            "smtp" => format!(
                "SMTP {}:{} ({}), expéditeur {}",
                display_or_missing(&config.smtp_host, "SMTP_HOST"),
                config.smtp_port,
                if config.smtp_secure {
                    "TLS"
                } else if config.smtp_user.is_empty() {
                    "sans authentification"
                } else {
                    "authentifié"
                },
                display_or_missing(&config.from, "EMAIL_FROM")
            ),
            other => format!("fournisseur inconnu « {other} » — l'envoi échouera"),
        }
    }

    pub fn warn_if_misconfigured(&self, is_production: bool) {
        let config = &self.config;
        if is_production && config.provider == "dev" {
            warn!(
                "⚠ EMAIL_PROVIDER vaut \"dev\" en production : les codes sont écrits dans les journaux \
                 et aucun email n'est envoyé. Renseignez EMAIL_PROVIDER, EMAIL_FROM et les identifiants."
            );
            return;
        }
        if config.provider == "scaleway" && config.secret_key.is_empty() {
            warn!(
                "⚠ SCW_SECRET_KEY est absente : aucun code ne pourra être envoyé par Scaleway TEM."
            );
        }
        if config.provider == "brevo" && config.brevo_api_key.is_empty() {
            warn!("⚠ BREVO_API_KEY est absente : aucun code ne pourra être envoyé par Brevo.");
        }
        if config.provider == "smtp" && config.smtp_host.is_empty() {
            warn!("⚠ SMTP_HOST est absente : aucun code ne pourra être envoyé par SMTP.");
        }
        if config.provider != "dev" && config.from.is_empty() {
            warn!("⚠ EMAIL_FROM est absente : le fournisseur refusera l'envoi.");
        }
    }

    pub async fn send_code(&self, to: &str, code: &str, ttl_minutes: i64) -> Delivery {
        let provider = self.config.provider.clone();
        if provider == "dev" {
            println!("[docdoc][dev] code pour {to} : {code} (valable {ttl_minutes} min)");
            if let Ok(path) = std::env::var("DOCDOC_DEV_CODE_FILE") {
                if !path.is_empty() {
                    use std::io::Write;
                    if let Ok(mut file) = std::fs::OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(path)
                    {
                        let _ = writeln!(file, "{to} {code}");
                    }
                }
            }
            use std::io::Write;
            let _ = std::io::stdout().flush();
            return Delivery {
                ok: true,
                provider,
                error: None,
            };
        }

        let result = match provider.as_str() {
            "scaleway" => self.send_with_scaleway(to, code, ttl_minutes).await,
            "brevo" => self.send_with_brevo(to, code, ttl_minutes).await,
            "smtp" => self.send_with_smtp(to, code, ttl_minutes).await,
            other => Err(format!("Fournisseur d'email inconnu : {other}")),
        };
        match result {
            Ok(()) => Delivery {
                ok: true,
                provider,
                error: None,
            },
            Err(err) => {
                error!("échec d'envoi du code à {to} via {provider} : {err}");
                Delivery {
                    ok: false,
                    provider,
                    error: Some(err),
                }
            }
        }
    }

    async fn send_with_scaleway(
        &self,
        to: &str,
        code: &str,
        ttl_minutes: i64,
    ) -> Result<(), String> {
        let config = &self.config;
        if config.secret_key.is_empty() {
            return Err("SCW_SECRET_KEY manquante".to_string());
        }
        if config.from.is_empty() {
            return Err("EMAIL_FROM manquante".to_string());
        }
        let message = message_body(code, ttl_minutes);
        let mut payload = json!({
            "from": { "email": config.from, "name": config.from_name },
            "to": [{ "email": to }],
            "subject": message.subject,
            "text": message.text,
            "html": message.html,
        });
        if !config.project_id.is_empty() {
            payload["project_id"] = json!(config.project_id);
        }
        let response = self
            .http
            .post(format!(
                "https://api.scaleway.com/transactional-email/v1alpha1/regions/{}/emails",
                config.region
            ))
            .header("X-Auth-Token", &config.secret_key)
            .json(&payload)
            .send()
            .await
            .map_err(|err| err.to_string())?;
        self.check_response(response).await
    }

    async fn send_with_brevo(&self, to: &str, code: &str, ttl_minutes: i64) -> Result<(), String> {
        let config = &self.config;
        if config.brevo_api_key.is_empty() {
            return Err("BREVO_API_KEY manquante".to_string());
        }
        if config.from.is_empty() {
            return Err("EMAIL_FROM manquante".to_string());
        }
        let message = message_body(code, ttl_minutes);
        let payload = json!({
            "sender": { "email": config.from, "name": config.from_name },
            "to": [{ "email": to }],
            "subject": message.subject,
            "textContent": message.text,
            "htmlContent": message.html,
        });
        let response = self
            .http
            .post("https://api.brevo.com/v3/smtp/email")
            .header("api-key", &config.brevo_api_key)
            .json(&payload)
            .send()
            .await
            .map_err(|err| err.to_string())?;
        self.check_response(response).await
    }

    async fn check_response(&self, response: reqwest::Response) -> Result<(), String> {
        if response.status().is_success() {
            return Ok(());
        }
        let status = response.status();
        let detail = response.text().await.unwrap_or_default();
        Err(format!(
            "{status} {}",
            detail.chars().take(200).collect::<String>()
        ))
    }

    async fn send_with_smtp(&self, to: &str, code: &str, ttl_minutes: i64) -> Result<(), String> {
        let Some(transport) = &self.smtp else {
            return Err("transport SMTP indisponible (SMTP_HOST manquante ?)".to_string());
        };
        let config = &self.config;
        if config.from.is_empty() {
            return Err("EMAIL_FROM manquante".to_string());
        }
        let message = message_body(code, ttl_minutes);
        let from_address = config
            .from
            .parse()
            .map_err(|_| format!("adresse EMAIL_FROM invalide : {}", config.from))?;
        let to_address = to
            .parse()
            .map_err(|_| format!("adresse destinataire invalide : {to}"))?;
        let email = Message::builder()
            .from(Mailbox::new(Some(config.from_name.clone()), from_address))
            .to(Mailbox::new(None, to_address))
            .subject(message.subject)
            .multipart(MultiPart::alternative_plain_html(
                message.text,
                message.html,
            ))
            .map_err(|err| err.to_string())?;
        transport
            .send(email)
            .await
            .map(|_| ())
            .map_err(|err| err.to_string())
    }
}

fn build_smtp_transport(config: &MailConfig) -> Option<AsyncSmtpTransport<Tokio1Executor>> {
    if config.smtp_host.is_empty() {
        return None;
    }
    let mut builder = AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.smtp_host)
        .port(config.smtp_port)
        .timeout(Some(Duration::from_millis(config.smtp_timeout_ms)));

    if config.smtp_secure || config.smtp_require_tls {
        let params = match TlsParameters::new(config.smtp_host.clone()) {
            Ok(params) => params,
            Err(err) => {
                warn!("configuration TLS SMTP impossible : {err}");
                return None;
            }
        };
        builder = if config.smtp_secure {
            builder.tls(Tls::Wrapper(params))
        } else {
            builder.tls(Tls::Required(params))
        };
    } else {
        builder = builder.tls(Tls::None);
    }

    if !config.smtp_user.is_empty() {
        builder = builder.credentials(Credentials::new(
            config.smtp_user.clone(),
            config.smtp_password.clone(),
        ));
    }
    if config.smtp_allow_self_signed {
        warn!("⚠ SMTP_ALLOW_SELF_SIGNED est ignoré par le client Rust (vérification TLS stricte).");
    }
    Some(builder.build())
}

struct MailBody {
    subject: String,
    text: String,
    html: String,
}

fn message_body(code: &str, ttl_minutes: i64) -> MailBody {
    MailBody {
        subject: "Votre code d’accès docdoc".to_string(),
        text: format!(
            "Votre code d'accès docdoc : {code}\n\n\
             Il expire dans {ttl_minutes} minutes et ne peut être utilisé qu'une fois.\n\
             Si vous n'êtes pas à l'origine de cette demande, ignorez ce message."
        ),
        html: format!(
            "<p>Votre code d’accès docdoc :</p>\
             <p style=\"font-size:28px;letter-spacing:6px;font-family:monospace\"><strong>{code}</strong></p>\
             <p>Il expire dans {ttl_minutes} minutes et ne peut être utilisé qu’une fois.<br>\
             Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p>"
        ),
    }
}

fn display_or_missing(value: &str, name: &str) -> String {
    if value.is_empty() {
        format!("({name} manquant)")
    } else {
        value.to_string()
    }
}
