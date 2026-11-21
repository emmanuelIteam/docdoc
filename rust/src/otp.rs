//! Codes à usage unique envoyés par email.
//!
//! Un code est lié à l'adresse qui l'a demandé, expire, ne sert qu'une fois et
//! n'est jamais stocké en clair : seul le sel et le digest de `salt:code` sont
//! conservés, comme dans `otp.js`. Le stockage est en mémoire, à la durée du
//! processus.

use std::collections::HashMap;

use rand::Rng;
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use tokio::sync::Mutex;

#[derive(Clone, Debug)]
pub struct Limits {
    pub ttl_ms: i64,
    pub resend_cooldown_ms: i64,
    pub max_attempts: i64,
    pub max_requests: usize,
    pub request_window_ms: i64,
}

pub fn limits() -> Limits {
    Limits {
        ttl_ms: env_int("OTP_TTL_SECONDS", 600) * 1000,
        resend_cooldown_ms: env_int("OTP_RESEND_COOLDOWN_SECONDS", 60) * 1000,
        max_attempts: env_int("OTP_MAX_ATTEMPTS", 5),
        max_requests: env_int("OTP_MAX_REQUESTS", 5) as usize,
        request_window_ms: env_int("OTP_REQUEST_WINDOW_SECONDS", 900) * 1000,
    }
}

fn env_int(name: &str, fallback: i64) -> i64 {
    std::env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<i64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(fallback)
}

#[derive(Clone, Debug)]
pub enum RequestOutcome {
    Issued { code: String, expires_at: i64 },
    Cooldown { retry_after_seconds: i64 },
    RateLimited { retry_after_seconds: i64 },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VerifyOutcome {
    Ok,
    Mismatch,
    Expired,
    Used,
    Attempts,
    None,
}

struct CodeRecord {
    salt: String,
    hash: String,
    issued_at: i64,
    expires_at: i64,
    attempts: i64,
    used: bool,
}

#[derive(Default)]
pub struct OtpStore {
    codes: Mutex<HashMap<String, CodeRecord>>,
    requests: Mutex<HashMap<String, Vec<i64>>>,
}

impl OtpStore {
    pub fn new() -> OtpStore {
        OtpStore::default()
    }

    pub async fn request_code(&self, email: &str, client_key: Option<&str>) -> RequestOutcome {
        let now = crate::session::now_ms();
        let limits = limits();
        let address = normalize_email(email);

        let mut codes = self.codes.lock().await;
        if let Some(previous) = codes.get(&address) {
            if !previous.used && now - previous.issued_at < limits.resend_cooldown_ms {
                return RequestOutcome::Cooldown {
                    retry_after_seconds: ((limits.resend_cooldown_ms - (now - previous.issued_at))
                        .max(1)
                        + 999)
                        / 1000,
                };
            }
        }

        let mut requests = self.requests.lock().await;
        let address_key = format!("e:{address}");
        let address_stamps = prune_requests(&mut requests, &address_key, now, &limits);
        if address_stamps.len() >= limits.max_requests {
            return RequestOutcome::RateLimited {
                retry_after_seconds: retry_after(&address_stamps, now, &limits),
            };
        }

        let client_stamps = client_key.map(|key| {
            let client_key = format!("c:{key}");
            let stamps = prune_requests(&mut requests, &client_key, now, &limits);
            (client_key, stamps)
        });
        if let Some((_, stamps)) = &client_stamps {
            if stamps.len() >= limits.max_requests {
                return RequestOutcome::RateLimited {
                    retry_after_seconds: retry_after(stamps, now, &limits),
                };
            }
        }

        let code = format!("{:06}", rand::thread_rng().gen_range(0..1_000_000u32));
        let salt = {
            let mut bytes = [0u8; 16];
            rand::thread_rng().fill(&mut bytes);
            hex::encode(bytes)
        };
        let hash = hash_code(&salt, &code);
        let expires_at = now + limits.ttl_ms;
        codes.insert(
            address,
            CodeRecord {
                salt,
                hash,
                issued_at: now,
                expires_at,
                attempts: 0,
                used: false,
            },
        );
        requests.entry(address_key).or_default().push(now);
        if let Some((client_key, _)) = client_stamps {
            requests.entry(client_key).or_default().push(now);
        }

        RequestOutcome::Issued { code, expires_at }
    }

    pub async fn verify_code(&self, email: &str, submitted: &str) -> VerifyOutcome {
        let address = normalize_email(email);
        let now = crate::session::now_ms();
        let limits = limits();
        let mut codes = self.codes.lock().await;
        let Some(record) = codes.get_mut(&address) else {
            return VerifyOutcome::None;
        };

        if record.used {
            return VerifyOutcome::Used;
        }
        if now > record.expires_at {
            codes.remove(&address);
            return VerifyOutcome::Expired;
        }
        if record.attempts >= limits.max_attempts {
            codes.remove(&address);
            return VerifyOutcome::Attempts;
        }

        let candidate = submitted.trim();
        let valid_format =
            candidate.len() == 6 && candidate.bytes().all(|byte| byte.is_ascii_digit());
        let candidate_hash = hash_code(&record.salt, candidate);
        let matches = valid_format
            && candidate_hash
                .as_bytes()
                .ct_eq(record.hash.as_bytes())
                .into();
        if !matches {
            record.attempts += 1;
            if record.attempts >= limits.max_attempts {
                codes.remove(&address);
                return VerifyOutcome::Attempts;
            }
            return VerifyOutcome::Mismatch;
        }

        record.used = true;
        codes.remove(&address);
        VerifyOutcome::Ok
    }

    pub async fn reset(&self) {
        self.codes.lock().await.clear();
        self.requests.lock().await.clear();
    }
}

fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

fn hash_code(salt: &str, code: &str) -> String {
    hex::encode(Sha256::digest(format!("{salt}:{code}").as_bytes()))
}

fn prune_requests(
    requests: &mut HashMap<String, Vec<i64>>,
    key: &str,
    now: i64,
    limits: &Limits,
) -> Vec<i64> {
    let stamps: Vec<i64> = requests
        .get(key)
        .map(|stamps| {
            stamps
                .iter()
                .copied()
                .filter(|stamp| now - stamp < limits.request_window_ms)
                .collect()
        })
        .unwrap_or_default();
    requests.insert(key.to_string(), stamps.clone());
    stamps
}

fn retry_after(stamps: &[i64], now: i64, limits: &Limits) -> i64 {
    if stamps.is_empty() {
        return 0;
    }
    let remaining = limits.request_window_ms - (now - stamps[0]);
    ((remaining.max(1) + 999) / 1000).max(1)
}

/// Validation volontairement simple, identique au motif de `authroutes.js`.
pub fn is_valid_email(email: &str) -> bool {
    let Some((local, domain)) = email.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && !email.chars().any(char::is_whitespace)
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
        && email.matches('@').count() == 1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn code_can_be_verified_once() {
        let store = OtpStore::new();
        let RequestOutcome::Issued { code, .. } = store.request_code("A@B.FR", None).await else {
            panic!("code non émis");
        };
        assert_eq!(
            store.verify_code("a@b.fr", "000000").await,
            VerifyOutcome::Mismatch
        );
        assert_eq!(store.verify_code("a@b.fr", &code).await, VerifyOutcome::Ok);
        assert_eq!(
            store.verify_code("a@b.fr", &code).await,
            VerifyOutcome::None
        );
    }

    #[tokio::test]
    async fn cooldown_then_resend() {
        let store = OtpStore::new();
        assert!(matches!(
            store.request_code("a@b.fr", None).await,
            RequestOutcome::Issued { .. }
        ));
        assert!(matches!(
            store.request_code("a@b.fr", None).await,
            RequestOutcome::Cooldown { .. }
        ));
    }

    #[test]
    fn email_validation() {
        assert!(is_valid_email("a@b.fr"));
        assert!(!is_valid_email("a@b"));
        assert!(!is_valid_email("a b@c.fr"));
        assert!(!is_valid_email("@b.fr"));
        assert!(!is_valid_email("a@b.fr@c.fr"));
    }
}
