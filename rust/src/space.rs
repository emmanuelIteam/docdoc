//! Espace de travail d'un compte : domaines, liste de navigation et palette.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::Mutex;

use crate::accounts;
use crate::model::{
    ensure_display_order, normalize_domain, normalize_theme, rebuild_domain_list, Domain,
    DomainSummary, Theme,
};
use crate::storage::{self, Storage};

/// Ordre manuel des deux rubriques de l'accueil. Une liste vide (document
/// absent ou mal formé) laisse le tableau dans son ordre naturel : domaines
/// puis outline.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct HomeOrder {
    #[serde(default)]
    pub in_progress: Vec<String>,
    #[serde(default)]
    pub waiting: Vec<String>,
}

impl HomeOrder {
    fn from_value(value: Option<Value>) -> HomeOrder {
        let mut order = HomeOrder::default();
        let Some(Value::Object(object)) = value else {
            return order;
        };
        order.in_progress = normalize_list(object.get("in_progress"));
        order.waiting = normalize_list(object.get("waiting"));
        order
    }

    pub fn for_rubrique(&self, rubrique: &str) -> &[String] {
        if rubrique == "waiting" {
            &self.waiting
        } else {
            &self.in_progress
        }
    }

    pub fn set(&mut self, rubrique: &str, ids: Vec<String>) {
        if rubrique == "waiting" {
            self.waiting = ids;
        } else {
            self.in_progress = ids;
        }
    }
}

fn normalize_list(value: Option<&Value>) -> Vec<String> {
    let Some(Value::Array(items)) = value else {
        return Vec::new();
    };
    let mut seen = HashSet::new();
    let mut list = Vec::new();
    for item in items {
        let Some(id) = item.as_str() else { continue };
        if id.is_empty() || !seen.insert(id.to_string()) {
            continue;
        }
        list.push(id.to_string());
    }
    list
}

/// Fusionne l'ordre enregistré et l'ordre naturel : les identifiants enregistrés
/// encore listés gardent leur position, puis les autres suivent dans l'ordre
/// naturel. Un enregistrement vide redonne donc exactement l'ordre naturel et une
/// carte nouvellement listée est ajoutée à la fin.
pub fn ordered_ids(recorded: &[String], natural: &[String]) -> Vec<String> {
    let mut remaining: HashSet<&str> = natural.iter().map(String::as_str).collect();
    let mut ordered = Vec::with_capacity(natural.len());
    for id in recorded {
        if remaining.remove(id.as_str()) {
            ordered.push(id.clone());
        }
    }
    for id in natural {
        if remaining.remove(id.as_str()) {
            ordered.push(id.clone());
        }
    }
    ordered
}

pub struct Space {
    pub user_id: String,
    pub email: String,
    pub domains: HashMap<String, Domain>,
    pub domain_list: Vec<DomainSummary>,
    pub themes: Vec<Theme>,
    pub home_order: HomeOrder,
}

impl Space {
    pub async fn load(storage: &Storage, user_id: &str, email: &str) -> Space {
        let mut space = Space {
            user_id: user_id.to_string(),
            email: email.to_string(),
            domains: HashMap::new(),
            domain_list: Vec::new(),
            themes: Vec::new(),
            home_order: HomeOrder::default(),
        };
        space.reload_themes(storage).await;
        space.reload_domains(storage).await;
        space.reload_home_order(storage).await;
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

    async fn reload_home_order(&mut self, storage: &Storage) {
        let value = storage
            .read_json(&storage::home_order_key(&self.user_id))
            .await;
        self.home_order = HomeOrder::from_value(value);
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

    pub async fn persist_home_order(&self, storage: &Storage) -> Result<(), String> {
        let value = serde_json::to_value(&self.home_order).map_err(|err| err.to_string())?;
        storage
            .write_json(&storage::home_order_key(&self.user_id), &value)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordered_ids_keeps_recorded_positions_then_appends_natural() {
        let natural: Vec<String> = ["a", "b", "c", "d"]
            .iter()
            .map(|id| id.to_string())
            .collect();
        let recorded: Vec<String> = ["c", "inconnu", "a"]
            .iter()
            .map(|id| id.to_string())
            .collect();
        assert_eq!(
            ordered_ids(&recorded, &natural),
            ["c", "a", "b", "d"]
                .iter()
                .map(|id| id.to_string())
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn home_order_normalization_drops_unknown_and_duplicates() {
        let value = serde_json::json!({
            "in_progress": ["a", "a", 3, ""],
            "waiting": ["b"],
            "autre": ["c"],
        });
        let order = HomeOrder::from_value(Some(value));
        assert_eq!(order.in_progress, vec!["a".to_string()]);
        assert_eq!(order.waiting, vec!["b".to_string()]);
        assert_eq!(
            HomeOrder::from_value(None).in_progress,
            Vec::<String>::new()
        );
    }
}
