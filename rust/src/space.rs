//! Espace de travail d'un compte : domaines, liste de navigation et palette.

use std::collections::HashMap;
use std::sync::Arc;

use serde_json::Value;
use tokio::sync::Mutex;

use crate::accounts;
use crate::model::{
    ensure_display_order, normalize_domain, normalize_theme, rebuild_domain_list, Domain,
    DomainSummary, Theme,
};
use crate::storage::{self, Storage};

pub struct Space {
    pub user_id: String,
    pub email: String,
    pub domains: HashMap<String, Domain>,
    pub domain_list: Vec<DomainSummary>,
    pub themes: Vec<Theme>,
}

impl Space {
    pub async fn load(storage: &Storage, user_id: &str, email: &str) -> Space {
        let mut space = Space {
            user_id: user_id.to_string(),
            email: email.to_string(),
            domains: HashMap::new(),
            domain_list: Vec::new(),
            themes: Vec::new(),
        };
        space.reload_themes(storage).await;
        space.reload_domains(storage).await;
        space
    }

    async fn reload_themes(&mut self, storage: &Storage) {
        let Some(value) = storage.read_json(&storage::themes_key(&self.user_id)).await else {
            self.themes = Vec::new();
            return;
        };
        self.themes = value
            .as_array()
            .map(|items| items.iter().filter_map(normalize_theme).collect())
            .unwrap_or_default();
    }

    async fn reload_domains(&mut self, storage: &Storage) {
        let keys = storage.list_domain_keys(&self.user_id).await;
        let mut loaded = Vec::new();
        for key in keys {
            let Some(value) = storage.read_json(&key).await else {
                continue;
            };
            if value.is_object() {
                if let Some(domain) = normalize_domain(&self.themes, &value) {
                    loaded.push(domain);
                }
            }
        }
        self.domains = loaded
            .into_iter()
            .map(|domain| (domain.id.clone(), domain))
            .collect();
        self.rebuild_domain_list();
    }

    pub fn rebuild_domain_list(&mut self) {
        self.domain_list = rebuild_domain_list(&self.domains);
    }

    pub fn find_domain_by_slug(&self, slug: &str) -> Option<&Domain> {
        self.domains.values().find(|domain| domain.slug == slug)
    }

    pub fn find_domain_by_id(&self, id: &str) -> Option<&Domain> {
        self.domains.get(id)
    }

    pub fn find_domain_by_slug_mut(&mut self, slug: &str) -> Option<&mut Domain> {
        self.domains.values_mut().find(|domain| domain.slug == slug)
    }

    pub fn find_domain_by_id_mut(&mut self, id: &str) -> Option<&mut Domain> {
        self.domains.get_mut(id)
    }

    pub fn theme_by_id(&self, id: &str) -> Option<&Theme> {
        self.themes.iter().find(|theme| theme.id == id)
    }

    pub async fn persist_themes(&self, storage: &Storage) -> Result<(), String> {
        let value = serde_json::to_value(&self.themes).map_err(|err| err.to_string())?;
        storage
            .write_json(&storage::themes_key(&self.user_id), &value)
            .await
    }

    pub async fn persist_domain(
        &mut self,
        storage: &Storage,
        domain_id: &str,
    ) -> Result<(), String> {
        let Some(domain) = self.domains.get_mut(domain_id) else {
            return Err("Domaine introuvable".to_string());
        };
        domain.display_order = ensure_display_order(&domain.projects, &domain.display_order);
        let payload = serde_json::to_value(&*domain).map_err(|err| err.to_string())?;
        storage
            .write_json(&storage::domain_key(&self.user_id, &domain.id), &payload)
            .await
    }
}

pub type SharedSpace = Arc<Mutex<Space>>;

/// Charge (ou retourne le cache de) l'espace d'un compte.
pub async fn load_space(storage: &Storage, user_id: &str, email: &str) -> Result<Space, String> {
    Ok(Space::load(storage, user_id, email).await)
}

/// Compte associé à une session, pour retrouver l'adresse affichée quand elle
/// n'est pas dans la session.
pub async fn email_for_user(storage: &Storage, user_id: &str) -> String {
    accounts::get_account(storage, user_id)
        .await
        .map(|account| account.email)
        .unwrap_or_default()
}

/// Sérialise un domaine pour la route JSON `/api/outline` (l'arbre seul).
pub fn projects_json(projects: &[crate::model::Node]) -> Value {
    serde_json::to_value(projects).unwrap_or(Value::Array(Vec::new()))
}
