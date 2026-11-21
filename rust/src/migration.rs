//! Adoption unique des données antérieures aux comptes.
//!
//! Deux sources, dans l'ordre : les clés racine du bucket (`domains/`,
//! `archive/`, `themes.json`) puis les fichiers historiques du répertoire
//! `data/`. Les deux étapes sont idempotentes : elles déplacent (jamais ne
//! copient) ce qui reste, donc les rejouer ne duplique ni ne perd rien.

use std::path::{Path, PathBuf};

use serde_json::Value;
use tracing::warn;

use crate::storage::{
    domain_key, themes_key, user_key, Storage, LEGACY_ARCHIVE_PREFIX, LEGACY_DOMAINS_PREFIX,
    LEGACY_THEMES_KEY,
};

#[derive(Clone, Debug, Default)]
pub struct AdoptionSummary {
    pub domains: usize,
    pub archive: usize,
    pub themes: bool,
    pub imported: usize,
    pub imported_themes: bool,
}

pub async fn adopt_legacy_data(
    storage: &Storage,
    data_dir: &Path,
    user_id: &str,
) -> AdoptionSummary {
    let moved = adopt_root_keys(storage, user_id).await;

    let mut own = Vec::new();
    if storage.is_configured() {
        own = storage.list_domain_keys(user_id).await;
    }
    let imported = if own.is_empty() {
        import_local_data(storage, data_dir, user_id).await
    } else {
        AdoptionSummary::default()
    };

    AdoptionSummary {
        domains: moved.domains,
        archive: moved.archive,
        themes: moved.themes,
        imported: imported.imported,
        imported_themes: imported.themes,
    }
}

async fn move_prefix(
    storage: &Storage,
    root_prefix: &str,
    user_id: &str,
    sub_prefix: &str,
) -> usize {
    if !storage.is_configured() {
        return 0;
    }
    let keys = storage.list_keys(root_prefix).await;
    let mut moved = 0;
    for key in keys {
        let name = &key[root_prefix.len()..];
        if name.is_empty() {
            continue;
        }
        let destination = user_key(user_id, &format!("{sub_prefix}{name}"));
        if storage.move_object(&key, &destination).await.is_ok() {
            moved += 1;
        }
    }
    moved
}

async fn adopt_root_keys(storage: &Storage, user_id: &str) -> AdoptionSummary {
    let domains = move_prefix(storage, LEGACY_DOMAINS_PREFIX, user_id, "domains/").await;
    let archive = move_prefix(storage, LEGACY_ARCHIVE_PREFIX, user_id, "archive/").await;

    let mut themes = false;
    if storage.is_configured() {
        if let Some(root_themes) = storage.read_json(LEGACY_THEMES_KEY).await {
            if storage
                .write_json(&themes_key(user_id), &root_themes)
                .await
                .is_ok()
            {
                let _ = storage.delete_object(LEGACY_THEMES_KEY).await;
                themes = true;
            }
        }
    }
    AdoptionSummary {
        domains,
        archive,
        themes,
        imported: 0,
        imported_themes: false,
    }
}

async fn read_local_json(path: &Path) -> Option<Value> {
    let contents = tokio::fs::read_to_string(path).await.ok()?;
    serde_json::from_str(&contents).ok()
}

async fn import_local_data(storage: &Storage, data_dir: &Path, user_id: &str) -> AdoptionSummary {
    let mut summary = AdoptionSummary::default();
    if tokio::fs::create_dir_all(data_dir).await.is_err() {
        return summary;
    }
    let Ok(mut entries) = tokio::fs::read_dir(data_dir).await else {
        return summary;
    };

    let mut files: Vec<PathBuf> = Vec::new();
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if name.ends_with(".json")
            && name != "projects.json"
            && name != "projects.json.bak"
            && name != "themes.json"
        {
            files.push(path);
        }
    }
    files.sort();

    for path in files {
        let Some(parsed) = read_local_json(&path).await else {
            continue;
        };
        let Some(object) = parsed.as_object() else {
            continue;
        };
        let Some(id) = object.get("id").and_then(Value::as_str) else {
            continue;
        };
        if object.get("projects").and_then(Value::as_array).is_none() {
            continue;
        }
        if storage
            .write_json(&domain_key(user_id, id), &parsed)
            .await
            .is_ok()
        {
            summary.imported += 1;
        }
    }

    if let Some(local_themes) = read_local_json(&data_dir.join("themes.json")).await {
        if local_themes.is_array()
            && storage
                .write_json(&themes_key(user_id), &local_themes)
                .await
                .is_ok()
        {
            summary.themes = true;
        }
    }

    let legacy = data_dir.join("projects.json");
    if let Some(value) = read_local_json(&legacy).await {
        if value.is_array() {
            let backup = data_dir.join("projects.json.bak");
            if let Err(err) = tokio::fs::rename(&legacy, &backup).await {
                warn!("renommage de projects.json impossible : {err}");
            }
        }
    }

    summary
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn local_import_skips_reserved_files_and_is_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let data = dir.path();
        tokio::fs::write(
            data.join("abc.json"),
            r#"{"id":"abc","name":"Maison","projects":[]}"#,
        )
        .await
        .unwrap();
        tokio::fs::write(
            data.join("projects.json"),
            r#"[{"id":"old","title":"historique"}]"#,
        )
        .await
        .unwrap();
        tokio::fs::write(
            data.join("themes.json"),
            r##"[{"id":"t","name":"T","color":"#000"}]"##,
        )
        .await
        .unwrap();

        let storage = Storage::memory();
        let summary = import_local_data(&storage, data, "user-1").await;
        assert_eq!(summary.imported, 1);
        assert!(summary.themes);
        assert!(data.join("projects.json.bak").exists());
        assert!(!data.join("projects.json").exists());
    }
}
