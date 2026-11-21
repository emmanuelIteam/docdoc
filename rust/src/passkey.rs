//! Cérémonies WebAuthn, sans dépendre du SDK JavaScript.
//!
//! Le navigateur parle le format JSON standard de WebAuthn (celui produit et
//! consommé par `@simplewebauthn/browser`) : options d'enregistrement et de
//! connexion, puis attestation et assertion. La vérification côté serveur suit
//! les règles du WebAuthn Level 2 :
//!
//! - `clientDataJSON` : type, challenge et origine attendus ;
//! - `authenticatorData` : hash du RP ID, fanion de présence utilisateur ;
//! - signature ES256, EdDSA ou RS256 sur `authenticatorData || SHA-256(clientDataJSON)`.
//!
//! La clé publique est conservée exactement comme chez l'original Node : le
//! base64url du COSE public key, ce qui rend les comptes existants lisibles.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ciborium::value::Value as CborValue;
use ed25519_dalek::Verifier as _;
use rand::RngCore;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::accounts::Passkey;

pub const RP_NAME: &str = "docdoc";
const TIMEOUT_MS: u64 = 60_000;

#[derive(Clone, Debug)]
pub struct RegistrationCredential {
    pub id: String,
    pub public_key: String,
    pub counter: u32,
    pub transports: Vec<String>,
    pub device_type: String,
    pub backed_up: bool,
}

#[derive(Clone, Debug)]
pub struct AuthenticationResult {
    pub new_counter: u32,
    pub counter_anomaly: bool,
}

fn b64_encode(bytes: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(bytes)
}

fn b64_decode(value: &str) -> Result<Vec<u8>, String> {
    URL_SAFE_NO_PAD
        .decode(value.as_bytes())
        .map_err(|err| format!("base64url invalide : {err}"))
}

fn random_challenge() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    b64_encode(&bytes)
}

/* ------------------------------------------------------------------ */
/* Options envoyées au navigateur                                      */
/* ------------------------------------------------------------------ */

pub fn registration_options(
    rp_id: &str,
    user_id: &str,
    email: &str,
    existing: &[Passkey],
) -> Value {
    let challenge = random_challenge();
    let exclude: Vec<Value> = existing
        .iter()
        .map(|passkey| {
            let mut entry = json!({
                "type": "public-key",
                "id": passkey.id,
            });
            if !passkey.transports.is_empty() {
                entry["transports"] = json!(passkey.transports);
            }
            entry
        })
        .collect();

    json!({
        "rp": { "name": RP_NAME, "id": rp_id },
        "user": {
            "id": b64_encode(user_id.as_bytes()),
            "name": email,
            "displayName": email,
        },
        "challenge": challenge,
        "pubKeyCredParams": [
            { "type": "public-key", "alg": -8 },
            { "type": "public-key", "alg": -7 },
            { "type": "public-key", "alg": -257 },
        ],
        "timeout": TIMEOUT_MS,
        "excludeCredentials": exclude,
        "authenticatorSelection": {
            "residentKey": "required",
            "requireResidentKey": true,
            "userVerification": "preferred",
        },
        "attestation": "none",
    })
}

pub fn authentication_options(rp_id: &str, account: Option<&crate::accounts::Account>) -> Value {
    let challenge = random_challenge();
    let allow: Vec<Value> = account
        .map(|account| {
            account
                .passkeys
                .iter()
                .map(|passkey| {
                    let mut entry = json!({
                        "type": "public-key",
                        "id": passkey.id,
                    });
                    if !passkey.transports.is_empty() {
                        entry["transports"] = json!(passkey.transports);
                    }
                    entry
                })
                .collect()
        })
        .unwrap_or_default();

    let mut options = json!({
        "challenge": challenge,
        "rpId": rp_id,
        "timeout": TIMEOUT_MS,
        "userVerification": "preferred",
    });
    if !allow.is_empty() {
        options["allowCredentials"] = json!(allow);
    }
    options
}

/* ------------------------------------------------------------------ */
/* Vérification de l'attestation                                       */
/* ------------------------------------------------------------------ */

pub fn verify_registration(
    rp_id: &str,
    origin: &str,
    response: &Value,
    expected_challenge: &str,
) -> Result<RegistrationCredential, String> {
    let client_data_bytes = decode_field(response, &["response", "clientDataJSON"])?;
    verify_client_data(
        &client_data_bytes,
        "webauthn.create",
        expected_challenge,
        origin,
    )?;

    let attestation_bytes = decode_field(response, &["response", "attestationObject"])?;
    let attestation: CborValue = ciborium::de::from_reader(attestation_bytes.as_slice())
        .map_err(|err| format!("attestation CBOR illisible : {err}"))?;
    let attestation_map = attestation
        .as_map()
        .ok_or_else(|| "attestation sans objet CBOR".to_string())?;
    let mut auth_data: Option<&Vec<u8>> = None;
    let mut format: Option<&str> = None;
    for (key, value) in attestation_map {
        match key.as_text() {
            Some("authData") => auth_data = value.as_bytes(),
            Some("fmt") => format = value.as_text(),
            _ => {}
        }
    }
    if format != Some("none") {
        return Err(format!(
            "format d'attestation non pris en charge : {}",
            format.unwrap_or("(absent)")
        ));
    }
    let auth_data = auth_data.ok_or_else(|| "attestation sans authData".to_string())?;
    if auth_data.len() < 55 {
        return Err("authenticatorData trop court".to_string());
    }

    let rp_hash = Sha256::digest(rp_id.as_bytes());
    if auth_data[..32] != rp_hash[..] {
        return Err("hash du RP ID incorrect".to_string());
    }
    let flags = auth_data[32];
    if flags & 0x01 == 0 {
        return Err("présence utilisateur absente".to_string());
    }
    if flags & 0x40 == 0 {
        return Err("aucune donnée de credential attestée".to_string());
    }

    let counter = u32::from_be_bytes([auth_data[33], auth_data[34], auth_data[35], auth_data[36]]);
    let credential_len = u16::from_be_bytes([auth_data[53], auth_data[54]]) as usize;
    let credential_start: usize = 55;
    let credential_end = credential_start
        .checked_add(credential_len)
        .filter(|end| *end <= auth_data.len())
        .ok_or_else(|| "identifiant de credential tronqué".to_string())?;
    let credential_id = &auth_data[credential_start..credential_end];
    if credential_id.is_empty() {
        return Err("identifiant de credential vide".to_string());
    }
    let cose_key = &auth_data[credential_end..];
    // Valide la clé tout de suite : une attestation dont la clé est illisible ne
    // doit pas créer un compte impossible à utiliser.
    parse_cose_key(cose_key)?;

    let transports = response
        .get("response")
        .and_then(|value| value.get("transports"))
        .and_then(Value::as_array)
        .or_else(|| response.get("transports").and_then(Value::as_array))
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();

    let backed_up = flags & 0x10 != 0;
    let backup_eligible = flags & 0x08 != 0;
    Ok(RegistrationCredential {
        id: b64_encode(credential_id),
        public_key: b64_encode(cose_key),
        counter,
        transports,
        device_type: if backup_eligible {
            "multiDevice".to_string()
        } else {
            "singleDevice".to_string()
        },
        backed_up,
    })
}

/* ------------------------------------------------------------------ */
/* Vérification de l'assertion                                         */
/* ------------------------------------------------------------------ */

pub fn verify_authentication(
    rp_id: &str,
    origin: &str,
    response: &Value,
    expected_challenge: &str,
    passkey: &Passkey,
) -> Result<AuthenticationResult, String> {
    let response_id = response
        .get("id")
        .and_then(Value::as_str)
        .or_else(|| response.get("rawId").and_then(Value::as_str))
        .ok_or_else(|| "assertion sans identifiant".to_string())?;
    if response_id != passkey.id {
        return Err("passkey inconnue".to_string());
    }

    let client_data_bytes = decode_field(response, &["response", "clientDataJSON"])?;
    verify_client_data(
        &client_data_bytes,
        "webauthn.get",
        expected_challenge,
        origin,
    )?;

    let auth_data = decode_field(response, &["response", "authenticatorData"])?;
    if auth_data.len() < 37 {
        return Err("authenticatorData trop court".to_string());
    }
    let rp_hash = Sha256::digest(rp_id.as_bytes());
    if auth_data[..32] != rp_hash[..] {
        return Err("hash du RP ID incorrect".to_string());
    }
    let flags = auth_data[32];
    if flags & 0x01 == 0 {
        return Err("présence utilisateur absente".to_string());
    }
    let new_counter =
        u32::from_be_bytes([auth_data[33], auth_data[34], auth_data[35], auth_data[36]]);

    let signature = decode_field(response, &["response", "signature"])?;
    let mut signed_data = auth_data.clone();
    signed_data.extend_from_slice(&Sha256::digest(&client_data_bytes));

    let cose_bytes = b64_decode(&passkey.public_key)?;
    let (algorithm, key) = parse_cose_key(&cose_bytes)?;
    verify_signature(algorithm, &key, &signed_data, &signature)?;

    let counter_anomaly = passkey.counter > 0 && new_counter > 0 && new_counter <= passkey.counter;
    Ok(AuthenticationResult {
        new_counter,
        counter_anomaly,
    })
}

fn decode_field(response: &Value, path: &[&str]) -> Result<Vec<u8>, String> {
    let mut current = response;
    for segment in path {
        current = current
            .get(*segment)
            .ok_or_else(|| format!("champ {segment} manquant dans la réponse WebAuthn"))?;
    }
    let encoded = current
        .as_str()
        .ok_or_else(|| "champ WebAuthn non textuel".to_string())?;
    b64_decode(encoded)
}

fn verify_client_data(
    client_data_bytes: &[u8],
    expected_type: &str,
    expected_challenge: &str,
    expected_origin: &str,
) -> Result<(), String> {
    let client_data: Value = serde_json::from_slice(client_data_bytes)
        .map_err(|err| format!("clientDataJSON illisible : {err}"))?;
    let kind = client_data
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if kind != expected_type {
        return Err(format!("type de clientData inattendu : {kind}"));
    }
    let challenge = client_data
        .get("challenge")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if challenge != expected_challenge {
        return Err("challenge incorrect".to_string());
    }
    let origin = client_data
        .get("origin")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if origin != expected_origin {
        return Err(format!("origine inattendue : {origin}"));
    }
    Ok(())
}

/* ------------------------------------------------------------------ */
/* COSE public key + signatures                                        */
/* ------------------------------------------------------------------ */

pub enum CoseKey {
    Ec2 { x: Vec<u8>, y: Vec<u8> },
    Okp { x: Vec<u8> },
    Rsa { n: Vec<u8>, e: Vec<u8> },
}

fn parse_cose_key(bytes: &[u8]) -> Result<(i64, CoseKey), String> {
    let value: CborValue =
        ciborium::de::from_reader(bytes).map_err(|err| format!("clé COSE illisible : {err}"))?;
    let entries = value
        .as_map()
        .ok_or_else(|| "clé COSE sans map".to_string())?;

    let mut key_type: Option<i64> = None;
    let mut algorithm: Option<i64> = None;
    let mut first: Option<Vec<u8>> = None; // x (EC2/OKP) ou n (RSA)
    let mut second: Option<Vec<u8>> = None; // y (EC2) ou e (RSA)
    let mut minus_two: Option<Vec<u8>> = None; // x (EC2/OKP) ou e (RSA)
    let mut curve: Option<i64> = None;

    for (key, value) in entries {
        let Some(label) = key
            .as_integer()
            .and_then(|integer| i128::try_from(integer.clone()).ok())
        else {
            continue;
        };
        match label {
            1 => {
                key_type = value
                    .as_integer()
                    .and_then(|integer| i128::try_from(integer.clone()).ok())
                    .map(|value| value as i64);
            }
            3 => {
                algorithm = value
                    .as_integer()
                    .and_then(|integer| i128::try_from(integer.clone()).ok())
                    .map(|value| value as i64);
            }
            -1 => {
                if let Some(integer) = value
                    .as_integer()
                    .and_then(|integer| i128::try_from(integer.clone()).ok())
                {
                    curve = Some(integer as i64);
                }
                if let Some(bytes) = value.as_bytes() {
                    first = Some(bytes.clone());
                }
            }
            -2 => {
                if let Some(bytes) = value.as_bytes() {
                    minus_two = Some(bytes.clone());
                }
            }
            -3 => {
                if let Some(bytes) = value.as_bytes() {
                    second = Some(bytes.clone());
                }
            }
            _ => {}
        }
    }

    let algorithm = algorithm.ok_or_else(|| "clé COSE sans algorithme".to_string())?;
    let key_type = key_type.unwrap_or(match algorithm {
        -7 => 2,
        -8 => 1,
        -257 => 3,
        _ => 0,
    });
    match key_type {
        2 | 1 => {
            if first.is_none() {
                first = minus_two.take();
            }
        }
        3 => {
            if second.is_none() {
                second = minus_two.take();
            }
        }
        _ => {}
    }

    match key_type {
        2 => {
            let x = first.ok_or_else(|| "clé ES256 sans x".to_string())?;
            let y = second.ok_or_else(|| "clé ES256 sans y".to_string())?;
            if curve != Some(1) {
                return Err("courbe P-256 attendue".to_string());
            }
            Ok((-7, CoseKey::Ec2 { x, y }))
        }
        1 => {
            let x = first.ok_or_else(|| "clé EdDSA sans x".to_string())?;
            if curve != Some(6) {
                return Err("courbe Ed25519 attendue".to_string());
            }
            Ok((-8, CoseKey::Okp { x }))
        }
        3 => {
            let n = first.ok_or_else(|| "clé RSA sans modulus".to_string())?;
            let e = second.ok_or_else(|| "clé RSA sans exposant".to_string())?;
            Ok((-257, CoseKey::Rsa { n, e }))
        }
        _ => Err(format!("type de clé COSE non pris en charge : {key_type}")),
    }
}

fn verify_signature(
    algorithm: i64,
    key: &CoseKey,
    signed_data: &[u8],
    signature: &[u8],
) -> Result<(), String> {
    match (algorithm, key) {
        (-7, CoseKey::Ec2 { x, y }) => {
            let mut point = Vec::with_capacity(65);
            point.push(0x04);
            point.extend_from_slice(x);
            point.extend_from_slice(y);
            let verifying_key = p256::ecdsa::VerifyingKey::from_sec1_bytes(&point)
                .map_err(|err| format!("clé P-256 invalide : {err}"))?;
            let signature = p256::ecdsa::Signature::from_der(signature)
                .or_else(|_| p256::ecdsa::Signature::from_slice(signature))
                .map_err(|err| format!("signature ES256 invalide : {err}"))?;
            verifying_key
                .verify(signed_data, &signature)
                .map_err(|_| "signature ES256 refusée".to_string())
        }
        (-8, CoseKey::Okp { x }) => {
            let bytes: [u8; 32] = x
                .as_slice()
                .try_into()
                .map_err(|_| "clé Ed25519 de mauvaise taille".to_string())?;
            let verifying_key = ed25519_dalek::VerifyingKey::from_bytes(&bytes)
                .map_err(|err| format!("clé Ed25519 invalide : {err}"))?;
            let signature = ed25519_dalek::Signature::from_slice(signature)
                .map_err(|err| format!("signature EdDSA invalide : {err}"))?;
            verifying_key
                .verify_strict(signed_data, &signature)
                .map_err(|_| "signature EdDSA refusée".to_string())
        }
        (-257, CoseKey::Rsa { n, e }) => {
            use rsa::BigUint;
            let public_key =
                rsa::RsaPublicKey::new(BigUint::from_bytes_be(n), BigUint::from_bytes_be(e))
                    .map_err(|err| format!("clé RSA invalide : {err}"))?;
            let digest = Sha256::digest(signed_data);
            public_key
                .verify(rsa::Pkcs1v15Sign::new::<Sha256>(), &digest, signature)
                .map_err(|_| "signature RS256 refusée".to_string())
        }
        _ => Err("clé COSE incohérente avec l'algorithme".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn options_have_the_expected_shape() {
        let passkey = Passkey {
            id: "cred".to_string(),
            public_key: String::new(),
            counter: 0,
            transports: vec!["internal".to_string()],
            label: "p".to_string(),
            device_type: "singleDevice".to_string(),
            backed_up: false,
            created_at: String::new(),
            last_used_at: None,
        };
        let options = registration_options("localhost", "user-1", "a@b.fr", &[passkey]);
        assert_eq!(options["rp"]["id"], "localhost");
        assert_eq!(options["user"]["name"], "a@b.fr");
        assert_eq!(options["excludeCredentials"][0]["id"], "cred");
        assert_eq!(options["pubKeyCredParams"][0]["alg"], -8);
        assert_eq!(options["attestation"], "none");
    }

    #[test]
    fn client_data_checks_type_challenge_origin() {
        let client_data = serde_json::json!({
            "type": "webauthn.get",
            "challenge": "abc",
            "origin": "http://localhost:3000",
        });
        let bytes = serde_json::to_vec(&client_data).unwrap();
        assert!(verify_client_data(&bytes, "webauthn.get", "abc", "http://localhost:3000").is_ok());
        assert!(
            verify_client_data(&bytes, "webauthn.create", "abc", "http://localhost:3000").is_err()
        );
        assert!(
            verify_client_data(&bytes, "webauthn.get", "def", "http://localhost:3000").is_err()
        );
        assert!(verify_client_data(&bytes, "webauthn.get", "abc", "https://example.org").is_err());
    }

    #[test]
    fn cose_es256_key_is_parsed() {
        // Clé P-256 valide (point du générateur) encodée en COSE.
        let x = hex::decode("6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296")
            .unwrap();
        let y = hex::decode("4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")
            .unwrap();
        let cose = CborValue::Map(vec![
            (
                CborValue::Integer(1i64.into()),
                CborValue::Integer(2i64.into()),
            ),
            (
                CborValue::Integer(3i64.into()),
                CborValue::Integer((-7i64).into()),
            ),
            (
                CborValue::Integer((-1i64).into()),
                CborValue::Integer(1i64.into()),
            ),
            (CborValue::Integer((-2i64).into()), CborValue::Bytes(x)),
            (CborValue::Integer((-3i64).into()), CborValue::Bytes(y)),
        ]);
        let mut encoded = Vec::new();
        ciborium::ser::into_writer(&cose, &mut encoded).unwrap();
        let (algorithm, key) = parse_cose_key(&encoded).unwrap();
        assert_eq!(algorithm, -7);
        assert!(matches!(key, CoseKey::Ec2 { .. }));
    }
}
