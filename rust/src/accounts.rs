//! Comptes et index de recherche des passkeys.
//!
//! Disposition des objets (identique à `accounts.js`) :
//!   users/{userId}/account.json               le compte
//!   users/by-email/{sha256(email)}.json        email    -> userId
//!   users/by-credential/{credentialId}.json    passkey  -> userId

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::session::now_iso;
use crate::storage::{self, Storage};

pub const EMAIL_INDEX_PREFIX: &str = "users/by-email/";
pub const CREDENTIAL_INDEX_PREFIX: &str = "users/by-credential/";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Passkey {
    pub id: String,
    pub public_key: String,
    #[serde(default)]
    pub counter: u32,
    #[serde(default)]
    pub transports: Vec<String>,
    #[serde(default = "default_label")]
    pub label: String,
    #[serde(default = "default_device_type")]
    pub device_type: String,
    #[serde(default)]
    pub backed_up: bool,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub last_used_at: Option<String>,
}

fn default_label() -> String {
    "Passkey".to_string()
}

fn default_device_type() -> String {
    "singleDevice".to_string()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub user_id: String,
    pub email: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub passkeys: Vec<Passkey>,
}

pub fn normalize_email(email: Option<&str>) -> String {
    email.unwrap_or("").trim().to_lowercase()
}

pub fn email_index_key(email: &str) -> String {
    let digest = Sha256::digest(normalize_email(Some(email)).as_bytes());
    format!("{EMAIL_INDEX_PREFIX}{}.json", hex::encode(digest))
}

pub fn credential_index_key(credential_id: &str) -> Result<String, String> {
    if credential_id.is_empty()
        || credential_id.len() > 512
        || !credential_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err("Identifiant de passkey invalide".to_string());
    }
    Ok(format!("{CREDENTIAL_INDEX_PREFIX}{credential_id}.json"))
}

pub fn new_account(email: &str, user_id: Option<&str>) -> Account {
    Account {
        user_id: user_id
            .map(str::to_string)
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
        email: normalize_email(Some(email)),
        created_at: now_iso(),
        passkeys: Vec::new(),
    }
}

pub async fn get_account(storage: &Storage, user_id: &str) -> Option<Account> {
    if user_id.is_empty() {
        return None;
    }
    let value = storage.read_json(&storage::account_key(user_id)).await?;
    let mut account: Account = serde_json::from_value(value).ok()?;
    if account.user_id != user_id {
        return None;
    }
    if account.created_at.is_empty() {
        account.created_at = now_iso();
    }
    Some(account)
}

pub async fn get_account_by_email(storage: &Storage, email: &str) -> Option<Account> {
    let normalized = normalize_email(Some(email));
    if normalized.is_empty() {
        return None;
    }
    let index = storage.read_json(&email_index_key(&normalized)).await?;
    let user_id = index.get("userId")?.as_str()?;
    get_account(storage, user_id).await
}

pub async fn get_account_by_credential(storage: &Storage, credential_id: &str) -> Option<Account> {
    let key = credential_index_key(credential_id).ok()?;
    let index = storage.read_json(&key).await?;
    let user_id = index.get("userId")?.as_str()?;
    get_account(storage, user_id).await
}

pub async fn save_account(storage: &Storage, account: &Account) -> Result<(), String> {
    let value = serde_json::to_value(account).map_err(|err| err.to_string())?;
    storage
        .write_json(&storage::account_key(&account.user_id), &value)
        .await?;
    storage
        .write_json(
            &email_index_key(&account.email),
            &json!({ "userId": account.user_id }),
        )
        .await
}

/// Retourne le compte de l'adresse, en le créant s'il n'existe pas. Le handle
/// `user_id` est celui que l'authentificateur a déjà enregistré.
pub async fn ensure_account(
    storage: &Storage,
    email: &str,
    user_id: Option<&str>,
) -> Result<(Account, bool), String> {
    if let Some(account) = get_account_by_email(storage, email).await {
        return Ok((account, false));
    }
    let account = new_account(email, user_id);
    save_account(storage, &account).await?;
    Ok((account, true))
}

pub fn find_passkey<'a>(account: &'a Account, credential_id: &str) -> Option<&'a Passkey> {
    account
        .passkeys
        .iter()
        .find(|passkey| passkey.id == credential_id)
}

pub async fn add_passkey(
    storage: &Storage,
    account: &mut Account,
    passkey: Passkey,
) -> Result<Passkey, String> {
    let stored = Passkey {
        label: passkey.label,
        device_type: passkey.device_type,
        backed_up: passkey.backed_up,
        created_at: if passkey.created_at.is_empty() {
            now_iso()
        } else {
            passkey.created_at
        },
        last_used_at: None,
        ..passkey
    };
    account.passkeys.retain(|item| item.id != stored.id);
    account.passkeys.push(stored.clone());
    save_account(storage, account).await?;
    storage
        .write_json(
            &credential_index_key(&stored.id)?,
            &json!({ "userId": account.user_id }),
        )
        .await?;
    Ok(stored)
}

pub async fn remove_passkey(
    storage: &Storage,
    account: &mut Account,
    credential_id: &str,
) -> Result<bool, String> {
    if find_passkey(account, credential_id).is_none() {
        return Ok(false);
    }
    account
        .passkeys
        .retain(|passkey| passkey.id != credential_id);
    save_account(storage, account).await?;
    storage
        .delete_object(&credential_index_key(credential_id)?)
        .await?;
    Ok(true)
}

pub async fn rename_passkey(
    storage: &Storage,
    account: &mut Account,
    credential_id: &str,
    label: &str,
) -> Result<Option<Passkey>, String> {
    let clean = label.trim();
    if clean.is_empty() {
        return Ok(None);
    }
    let Some(passkey) = account
        .passkeys
        .iter_mut()
        .find(|passkey| passkey.id == credential_id)
    else {
        return Ok(None);
    };
    passkey.label = clean.chars().take(60).collect();
    let updated = passkey.clone();
    save_account(storage, account).await?;
    Ok(Some(updated))
}

pub async fn touch_passkey(
    storage: &Storage,
    account: &mut Account,
    credential_id: &str,
    counter: u32,
) -> Result<Option<Passkey>, String> {
    let Some(passkey) = account
        .passkeys
        .iter_mut()
        .find(|passkey| passkey.id == credential_id)
    else {
        return Ok(None);
    };
    passkey.counter = counter;
    passkey.last_used_at = Some(now_iso());
    let updated = passkey.clone();
    save_account(storage, account).await?;
    Ok(Some(updated))
}

/// Lit un compte au format JSON quelconque (migration, tests).
pub fn account_from_value(value: &Value) -> Option<Account> {
    serde_json::from_value(value.clone()).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn email_normalization_and_hashing_are_stable() {
        assert_eq!(normalize_email(Some("  A@B.FR ")), "a@b.fr");
        let expected = format!(
            "users/by-email/{}.json",
            hex::encode(Sha256::digest(b"a@b.fr"))
        );
        assert_eq!(email_index_key("A@B.FR"), expected);
    }

    #[test]
    fn credential_keys_are_restricted() {
        assert!(credential_index_key("abc_-123").is_ok());
        assert!(credential_index_key("abc/123").is_err());
        assert!(credential_index_key("").is_err());
        assert!(credential_index_key(&"a".repeat(513)).is_err());
    }
}
