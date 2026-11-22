//! Modèle de données : domaines, arbre des tâches, ordre d'affichage.
//!
//! La hiérarchie est portée par `projects` (l'arbre), l'ordre vertical par
//! `display_order` (une suite plate d'ids). Les deux doivent rester cohérents :
//! `ensure_display_order` répare l'ordre contre l'arbre avant chaque lecture ou
//! écriture, exactement comme `server.js`.

use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use unicode_normalization::UnicodeNormalization;
use uuid::Uuid;

// The four persisted line statuses. `todo` is "En projet" on a domain page,
// `in_progress` is "En cours" there and "À faire" on the home board, `waiting`
// is the "En attente" sub-state, and `done` is "Terminé".
pub const VALID_STATUSES: [&str; 4] = ["todo", "in_progress", "waiting", "done"];

pub fn status_icon(status: &str) -> &'static str {
    match status {
        "in_progress" => "◐",
        "waiting" => "◷",
        "done" => "●",
        _ => "○",
    }
}

/// Label of the three actions offered in a line's context menu.
pub fn status_label(status: &str) -> &'static str {
    match status {
        "in_progress" => "En cours",
        "done" => "Terminé",
        _ => "En projet",
    }
}

/// Label of the two home-board rubriques, the sub-states of "En cours".
pub fn rubrique_label(status: &str) -> &'static str {
    match status {
        "waiting" => "En attente",
        _ => "À faire",
    }
}

/// Keep only the four valid statuses; `someday` and any unknown value read from
/// disk fall back to `todo` ("En projet"). Applied when a domain is loaded, so
/// the normalized value is persisted on the domain's next write.
pub fn normalize_status(status: &str) -> String {
    if VALID_STATUSES.contains(&status) {
        status.to_string()
    } else {
        "todo".to_string()
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Theme {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub color: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Node {
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default)]
    pub collapsed: bool,
    #[serde(default)]
    pub children: Vec<Node>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

fn default_status() -> String {
    "todo".to_string()
}

impl Node {
    pub fn new(title: String) -> Node {
        Node {
            id: Uuid::new_v4().to_string(),
            title,
            status: default_status(),
            collapsed: false,
            children: Vec::new(),
            extra: Map::new(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Domain {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub order: f64,
    pub labels: Vec<String>,
    pub projects: Vec<Node>,
    pub display_order: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct DomainSummary {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub order: f64,
    pub labels: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct IndexEntry {
    pub parent: Option<String>,
    pub depth: usize,
    pub title: String,
    pub status: String,
    pub collapsed: bool,
    pub has_children: bool,
}

pub type OutlineIndex = HashMap<String, IndexEntry>;

/* ------------------------------------------------------------------ */
/* Normalisation (lecture tolérante de JSON)                           */
/* ------------------------------------------------------------------ */

pub fn normalize_theme(raw: &Value) -> Option<Theme> {
    let obj = raw.as_object()?;
    let id = obj.get("id")?.as_str()?.to_string();
    let name = obj
        .get("name")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .unwrap_or("Thème")
        .to_string();
    let color = obj
        .get("color")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .unwrap_or(crate::config::DEFAULT_THEME_COLORS[0])
        .to_string();
    Some(Theme { id, name, color })
}

pub fn node_from_value(value: &Value) -> Option<Node> {
    let obj = value.as_object()?;
    let id = obj.get("id")?.as_str()?.to_string();
    let title = obj
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let status = obj
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("todo")
        .to_string();
    let collapsed = obj
        .get("collapsed")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let children = obj
        .get("children")
        .and_then(Value::as_array)
        .map(|items| items.iter().filter_map(node_from_value).collect())
        .unwrap_or_default();
    let mut extra = Map::new();
    for (key, item) in obj {
        if !matches!(
            key.as_str(),
            "id" | "title" | "status" | "collapsed" | "children"
        ) {
            extra.insert(key.clone(), item.clone());
        }
    }
    Some(Node {
        id,
        title,
        status: normalize_status(&status),
        collapsed,
        children,
        extra,
    })
}

/// Construit un domaine depuis le JSON stocké, en appliquant les mêmes
/// réparations que `normalizeDomain`.
pub fn normalize_domain(themes: &[Theme], raw: &Value) -> Option<Domain> {
    let obj = raw.as_object()?;
    let id = obj.get("id")?.as_str()?.to_string();
    let name = obj
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Sans titre")
        .to_string();
    let slug = obj
        .get("slug")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let order = obj.get("order").and_then(Value::as_f64).unwrap_or(0.0);
    let labels: Vec<String> = obj
        .get("labels")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .filter(|label| themes.iter().any(|theme| &theme.id == label))
                .collect()
        })
        .unwrap_or_default();
    let projects: Vec<Node> = obj
        .get("projects")
        .and_then(Value::as_array)
        .map(|items| items.iter().filter_map(node_from_value).collect())
        .unwrap_or_default();
    let raw_order: Vec<String> = obj
        .get("displayOrder")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    let display_order = ensure_display_order(&projects, &raw_order);
    Some(Domain {
        id,
        name,
        slug,
        order,
        labels,
        projects,
        display_order,
    })
}

/* ------------------------------------------------------------------ */
/* Index et ordre d'affichage                                          */
/* ------------------------------------------------------------------ */

pub fn canonical_order(projects: &[Node]) -> Vec<String> {
    fn walk(nodes: &[Node], out: &mut Vec<String>) {
        for node in nodes {
            out.push(node.id.clone());
            walk(&node.children, out);
        }
    }
    let mut out = Vec::new();
    walk(projects, &mut out);
    out
}

pub fn index_outline(projects: &[Node]) -> OutlineIndex {
    fn walk(nodes: &[Node], parent: Option<&str>, depth: usize, out: &mut OutlineIndex) {
        for node in nodes {
            out.insert(
                node.id.clone(),
                IndexEntry {
                    parent: parent.map(str::to_string),
                    depth,
                    title: node.title.clone(),
                    status: node.status.clone(),
                    collapsed: node.collapsed,
                    has_children: !node.children.is_empty(),
                },
            );
            walk(&node.children, Some(&node.id), depth + 1, out);
        }
    }
    let mut out = HashMap::new();
    walk(projects, None, 0, &mut out);
    out
}

pub fn is_tree_ancestor(index: &OutlineIndex, ancestor_id: &str, id: &str) -> bool {
    let mut current = index.get(id);
    while let Some(entry) = current {
        match &entry.parent {
            Some(parent) if parent == ancestor_id => return true,
            Some(parent) => current = index.get(parent),
            None => return false,
        }
    }
    false
}

/// Fin exclusive du bloc affiché de `id`, ou `None` quand `id` n'est pas dans
/// l'ordre. Reproduit `blockEnd` : les descendants sont reconnus par leur
/// chaîne de parents, pas par leur profondeur seule.
pub fn block_end(order: &[String], index: &OutlineIndex, id: &str) -> Option<usize> {
    let start = order.iter().position(|row| row == id)?;
    let Some(entry) = index.get(id) else {
        return Some(start + 1);
    };
    let mut end = start + 1;
    for i in (start + 1)..order.len() {
        let row = &order[i];
        let Some(next) = index.get(row) else {
            continue;
        };
        if next.depth < entry.depth {
            break;
        }
        if is_tree_ancestor(index, id, row) {
            end = i + 1;
        }
    }
    Some(end)
}

pub fn insert_block(order: &mut Vec<String>, pos: usize, block: &[String]) {
    let at = pos.min(order.len());
    order.splice(at..at, block.iter().cloned());
}

pub fn extract_block(
    order: &mut Vec<String>,
    index: &OutlineIndex,
    id: &str,
) -> Option<Vec<String>> {
    let start = order.iter().position(|row| row == id)?;
    let mut block = Vec::new();
    let mut kept = Vec::new();
    for (i, row) in order.iter().enumerate() {
        if row == id || (i > start && is_tree_ancestor(index, id, row)) {
            block.push(row.clone());
        } else {
            kept.push(row.clone());
        }
    }
    if block.is_empty() {
        return None;
    }
    *order = kept;
    Some(block)
}

/// Répare l'ordre contre l'arbre : ids inconnus écartés, doublons ignorés, et
/// tout nœud absent inséré après le bloc de son parent (ou à la fin pour un
/// projet racine). Un nœud ne peut donc jamais disparaître de l'outline.
pub fn ensure_display_order(projects: &[Node], display_order: &[String]) -> Vec<String> {
    let index = index_outline(projects);
    let mut kept: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for raw_id in display_order {
        if !index.contains_key(raw_id) || seen.contains(raw_id) {
            continue;
        }
        seen.insert(raw_id.clone());
        kept.push(raw_id.clone());
    }

    let mut missing: Vec<String> = index
        .keys()
        .filter(|id| !seen.contains(*id))
        .cloned()
        .collect();
    // `index.keys()` suit l'ordre préfixe de l'insertion ; le tri stable par
    // profondeur donne le même ordre « du plus haut au plus bas » que JS.
    missing.sort_by_key(|id| index.get(id).map(|entry| entry.depth).unwrap_or(0));
    for id in missing {
        let Some(entry) = index.get(&id) else {
            continue;
        };
        match &entry.parent {
            None => kept.push(id),
            Some(parent) => {
                let end = block_end(&kept, &index, parent).unwrap_or(kept.len());
                insert_block(&mut kept, end, std::slice::from_ref(&id));
            }
        }
    }
    kept
}

pub fn display_insert_after(order: &mut Vec<String>, anchor_id: &str, id: &str) {
    match order.iter().position(|row| row == anchor_id) {
        Some(at) => order.insert(at + 1, id.to_string()),
        None => order.push(id.to_string()),
    }
}

pub fn display_append_to_block(
    order: &mut Vec<String>,
    index: &OutlineIndex,
    parent_id: &str,
    id: &str,
) {
    let end = block_end(order, index, parent_id).unwrap_or(order.len());
    insert_block(order, end, &[id.to_string()]);
}

pub fn display_remove_block(order: &mut Vec<String>, index: &OutlineIndex, id: &str) {
    let Some(start) = order.iter().position(|row| row == id) else {
        return;
    };
    let kept: Vec<String> = order
        .iter()
        .enumerate()
        .filter(|(i, row)| row.as_str() != id && !(*i > start && is_tree_ancestor(index, id, row)))
        .map(|(_, row)| row.clone())
        .collect();
    *order = kept;
}

pub fn display_move_after(
    order: &mut Vec<String>,
    index: &OutlineIndex,
    id: &str,
    reference_id: &str,
) {
    let Some(block) = extract_block(order, index, id) else {
        return;
    };
    match order.iter().position(|row| row == reference_id) {
        Some(at) => insert_block(order, at + 1, &block),
        None => insert_block(order, order.len(), &block),
    }
}

pub fn display_move_before(
    order: &mut Vec<String>,
    index: &OutlineIndex,
    id: &str,
    reference_id: &str,
) {
    let Some(block) = extract_block(order, index, id) else {
        return;
    };
    match order.iter().position(|row| row == reference_id) {
        Some(at) => insert_block(order, at, &block),
        None => insert_block(order, order.len(), &block),
    }
}

pub fn display_move_to_block_end(
    order: &mut Vec<String>,
    index: &OutlineIndex,
    id: &str,
    parent_id: &str,
) {
    let Some(block) = extract_block(order, index, id) else {
        return;
    };
    let end = block_end(order, index, parent_id).unwrap_or(order.len());
    insert_block(order, end, &block);
}

pub fn display_move_to_end(order: &mut Vec<String>, index: &OutlineIndex, id: &str) {
    let Some(block) = extract_block(order, index, id) else {
        return;
    };
    insert_block(order, order.len(), &block);
}

/* ------------------------------------------------------------------ */
/* Accès à l'arbre par chemin                                           */
/* ------------------------------------------------------------------ */

pub fn find_path(nodes: &[Node], id: &str) -> Option<Vec<usize>> {
    for (index, node) in nodes.iter().enumerate() {
        if node.id == id {
            return Some(vec![index]);
        }
        if let Some(mut rest) = find_path(&node.children, id) {
            let mut path = vec![index];
            path.append(&mut rest);
            return Some(path);
        }
    }
    None
}

pub fn node_at<'a>(nodes: &'a [Node], path: &[usize]) -> Option<&'a Node> {
    let mut current: &Node = nodes.get(*path.first()?)?;
    for index in &path[1..] {
        current = current.children.get(*index)?;
    }
    Some(current)
}

pub fn node_at_mut<'a>(nodes: &'a mut [Node], path: &[usize]) -> Option<&'a mut Node> {
    let mut current: &mut Node = nodes.get_mut(*path.first()?)?;
    for index in &path[1..] {
        current = current.children.get_mut(*index)?;
    }
    Some(current)
}

pub fn children_at_mut<'a>(nodes: &'a mut Vec<Node>, path: &[usize]) -> Option<&'a mut Vec<Node>> {
    let mut current = nodes;
    for index in path {
        let node = current.get_mut(*index)?;
        current = &mut node.children;
    }
    Some(current)
}

pub fn remove_at_path(nodes: &mut Vec<Node>, path: &[usize]) -> Option<Node> {
    let (last, parent_path) = path.split_last()?;
    let siblings = children_at_mut(nodes, parent_path)?;
    if *last < siblings.len() {
        Some(siblings.remove(*last))
    } else {
        None
    }
}

fn find_children_mut<'a>(nodes: &'a mut Vec<Node>, id: &str) -> Option<&'a mut Vec<Node>> {
    if let Some(index) = nodes.iter().position(|node| node.id == id) {
        return Some(&mut nodes[index].children);
    }
    for node in nodes.iter_mut() {
        if let Some(children) = find_children_mut(&mut node.children, id) {
            return Some(children);
        }
    }
    None
}

fn default_title(parent_id: Option<&str>) -> String {
    if parent_id.is_some() {
        "Nouvelle tâche".to_string()
    } else {
        "Nouveau projet".to_string()
    }
}

pub fn create_node(domain: &mut Domain, parent_id: Option<&str>) -> Option<Node> {
    let node = Node::new(default_title(parent_id));
    match parent_id {
        Some(parent_id) => {
            let children = find_children_mut(&mut domain.projects, parent_id)?;
            children.push(node.clone());
            let index = index_outline(&domain.projects);
            let order = std::mem::take(&mut domain.display_order);
            let mut order = order;
            display_append_to_block(&mut order, &index, parent_id, &node.id);
            domain.display_order = order;
        }
        None => {
            domain.projects.push(node.clone());
            domain.display_order.push(node.id.clone());
        }
    }
    Some(node)
}

// A project created from the domain page is inserted at the head of the
// outline: before every other line, including the sub-lines of the former first
// project. The display order is normalized first, so a stale or partial order
// (legacy data, restore) cannot leave the new id behind lines that
// `ensure_display_order` appends afterwards — the new line must really be first.
pub fn create_project_at_head(domain: &mut Domain) -> Node {
    let node = Node::new(default_title(None));
    let mut order = ensure_display_order(&domain.projects, &domain.display_order);
    domain.projects.insert(0, node.clone());
    order.insert(0, node.id.clone());
    domain.display_order = order;
    node
}

pub fn create_node_after(domain: &mut Domain, anchor_id: &str) -> Option<Node> {
    let path = find_path(&domain.projects, anchor_id)?;
    let parent_path = &path[..path.len() - 1];
    let anchor_index = *path.last()?;
    let parent_id = parent_path
        .last()
        .and_then(|_| node_at(&domain.projects, parent_path).map(|node| node.id.clone()));
    let node = Node::new(default_title(parent_id.as_deref()));
    let siblings = children_at_mut(&mut domain.projects, parent_path)?;
    siblings.insert(anchor_index + 1, node.clone());
    display_insert_after(&mut domain.display_order, anchor_id, &node.id);
    Some(node)
}

pub fn delete_node(domain: &mut Domain, id: &str) -> bool {
    let Some(path) = find_path(&domain.projects, id) else {
        return false;
    };
    let index = index_outline(&domain.projects);
    display_remove_block(&mut domain.display_order, &index, id);
    remove_at_path(&mut domain.projects, &path);
    true
}

pub fn reindent_node(domain: &mut Domain, id: &str, direction: &str) -> Option<Node> {
    let path = find_path(&domain.projects, id)?;
    let current = node_at(&domain.projects, &path)?.clone();
    let index = index_outline(&domain.projects);

    if direction == "indent" {
        let node_index = *path.last()?;
        if node_index == 0 {
            return Some(current);
        }
        let mut previous_path = path.clone();
        *previous_path.last_mut()? = node_index - 1;
        let previous_id = node_at(&domain.projects, &previous_path)?.id.clone();
        let node = remove_at_path(&mut domain.projects, &path)?;
        let siblings = children_at_mut(&mut domain.projects, &previous_path)?;
        siblings.push(node.clone());
        display_move_to_block_end(&mut domain.display_order, &index, id, &previous_id);
        return Some(node);
    }

    if path.len() < 2 {
        return Some(current);
    }
    let parent_path = &path[..path.len() - 1];
    let parent_index = path[path.len() - 2];
    let node = remove_at_path(&mut domain.projects, &path)?;
    let grandparent_path = &parent_path[..parent_path.len() - 1];
    let siblings = children_at_mut(&mut domain.projects, grandparent_path)?;
    let insert_at = (parent_index + 1).min(siblings.len());
    siblings.insert(insert_at, node.clone());
    Some(node)
}

pub fn is_descendant_of(projects: &[Node], ancestor_id: &str, node_id: &str) -> bool {
    fn walk(node: &Node, node_id: &str) -> bool {
        for child in &node.children {
            if child.id == node_id || walk(child, node_id) {
                return true;
            }
        }
        false
    }
    find_node(projects, ancestor_id)
        .map(|node| walk(node, node_id))
        .unwrap_or(false)
}

pub fn find_node<'a>(projects: &'a [Node], id: &str) -> Option<&'a Node> {
    find_path(projects, id).and_then(|path| node_at(projects, &path))
}

/// Déplace un nœud (avec son sous-arbre). Retourne un message d'erreur sans
/// avoir muté l'arbre pour un nœud/cible absent ou un déplacement cyclique.
pub fn move_node(
    domain: &mut Domain,
    id: &str,
    target_id: Option<&str>,
    position: &str,
) -> Result<(), &'static str> {
    let Some(source_path) = find_path(&domain.projects, id) else {
        return Err("not-found");
    };
    let index = index_outline(&domain.projects);

    if let Some(target_id) = target_id {
        if find_path(&domain.projects, target_id).is_none() {
            return Err("target-not-found");
        }
        if target_id == id || is_tree_ancestor(&index, id, target_id) {
            return Err("cycle");
        }
    }

    let pos = if ["inside", "before", "after"].contains(&position) {
        position
    } else {
        "inside"
    };
    if pos != "inside" && target_id.is_none() {
        return Err("target-not-found");
    }

    let node = node_at(&domain.projects, &source_path)
        .cloned()
        .ok_or("not-found")?;
    remove_at_path(&mut domain.projects, &source_path);

    match pos {
        "inside" => match target_id {
            Some(target_id) => {
                let target_path =
                    find_path(&domain.projects, target_id).ok_or("target-not-found")?;
                let children = children_at_mut(&mut domain.projects, &target_path)
                    .ok_or("target-not-found")?;
                children.push(node);
                display_move_to_block_end(&mut domain.display_order, &index, id, target_id);
            }
            None => {
                domain.projects.push(node);
                display_move_to_end(&mut domain.display_order, &index, id);
            }
        },
        "before" | "after" => {
            let target_id = target_id.ok_or("target-not-found")?;
            let target_path = find_path(&domain.projects, target_id).ok_or("target-not-found")?;
            let target_index = *target_path.last().ok_or("target-not-found")?;
            let parent_path = &target_path[..target_path.len() - 1];
            let siblings =
                children_at_mut(&mut domain.projects, parent_path).ok_or("target-not-found")?;
            let insert_at = if pos == "before" {
                target_index
            } else {
                target_index + 1
            };
            siblings.insert(insert_at.min(siblings.len()), node);
            if pos == "before" {
                display_move_before(&mut domain.display_order, &index, id, target_id);
            } else {
                display_move_after(&mut domain.display_order, &index, id, target_id);
            }
        }
        _ => unreachable!(),
    }
    Ok(())
}

pub fn set_status(projects: &mut [Node], id: &str, status: &str, scope: &str) -> bool {
    if !VALID_STATUSES.contains(&status) {
        return false;
    }
    let Some(path) = find_path(projects, id) else {
        return false;
    };
    let Some(node) = node_at_mut(projects, &path) else {
        return false;
    };
    if scope == "head" {
        node.status = status.to_string();
        return true;
    }
    fn apply(node: &mut Node, status: &str) {
        node.status = status.to_string();
        for child in &mut node.children {
            apply(child, status);
        }
    }
    apply(node, status);
    true
}

pub fn toggle_collapse(projects: &mut [Node], id: &str) -> bool {
    let Some(path) = find_path(projects, id) else {
        return false;
    };
    let Some(node) = node_at_mut(projects, &path) else {
        return false;
    };
    node.collapsed = !node.collapsed;
    true
}

pub fn is_displayed_collapsed(node: &Node, expand_ids: Option<&HashSet<String>>) -> bool {
    !node.children.is_empty()
        && node.collapsed
        && !expand_ids
            .map(|ids| ids.contains(&node.id))
            .unwrap_or(false)
}

pub fn hidden_node_ids(projects: &[Node], expand_ids: Option<&HashSet<String>>) -> HashSet<String> {
    fn walk(
        nodes: &[Node],
        ancestor_collapsed: bool,
        expand_ids: Option<&HashSet<String>>,
        hidden: &mut HashSet<String>,
    ) {
        for node in nodes {
            let collapsed = is_displayed_collapsed(node, expand_ids);
            if ancestor_collapsed {
                hidden.insert(node.id.clone());
            }
            if !node.children.is_empty() {
                walk(
                    &node.children,
                    ancestor_collapsed || collapsed,
                    expand_ids,
                    hidden,
                );
            }
        }
    }
    let mut hidden = HashSet::new();
    walk(projects, false, expand_ids, &mut hidden);
    hidden
}

pub fn ancestor_ids(projects: &[Node], id: &str) -> HashSet<String> {
    let index = index_outline(projects);
    let mut ids = HashSet::new();
    let mut current = id.to_string();
    loop {
        let Some(entry) = index.get(&current) else {
            break;
        };
        let Some(parent) = &entry.parent else {
            break;
        };
        ids.insert(parent.clone());
        current = parent.clone();
    }
    ids
}

/// Chaîne des parents, du projet de niveau 1 au parent immédiat.
pub fn ancestor_chain(index: &OutlineIndex, id: &str) -> Vec<IndexEntry> {
    let mut chain = Vec::new();
    let mut current = index.get(id);
    while let Some(entry) = current {
        let Some(parent) = &entry.parent else {
            break;
        };
        let Some(parent_entry) = index.get(parent) else {
            break;
        };
        chain.push(parent_entry.clone());
        current = Some(parent_entry);
    }
    chain.reverse();
    chain
}

/* ------------------------------------------------------------------ */
/* Domaines, slugs, thèmes                                             */
/* ------------------------------------------------------------------ */

pub fn rebuild_domain_list(domains: &HashMap<String, Domain>) -> Vec<DomainSummary> {
    let mut list: Vec<DomainSummary> = domains
        .values()
        .map(|domain| DomainSummary {
            id: domain.id.clone(),
            name: domain.name.clone(),
            slug: domain.slug.clone(),
            order: domain.order,
            labels: domain.labels.clone(),
        })
        .collect();
    list.sort_by(|a, b| {
        a.order
            .partial_cmp(&b.order)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.name.cmp(&b.name))
    });
    list
}

pub fn next_order(domain_list: &[DomainSummary]) -> f64 {
    domain_list
        .iter()
        .map(|domain| domain.order)
        .fold(-1.0, f64::max)
        + 1.0
}

pub fn normalize_slug_base(name: &str) -> String {
    let ascii: String = name
        .nfd()
        .filter(|character| !('\u{0300}'..='\u{036f}').contains(character))
        .flat_map(char::to_lowercase)
        .map(|character| {
            if character.is_ascii_lowercase() || character.is_ascii_digit() {
                character
            } else {
                '-'
            }
        })
        .collect();
    ascii
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

pub fn slugify(domains: &HashMap<String, Domain>, name: &str, except_id: Option<&str>) -> String {
    let base = {
        let normalized = normalize_slug_base(name);
        if normalized.is_empty() {
            "domaine".to_string()
        } else {
            normalized
        }
    };
    let mut slug = base.clone();
    let mut n = 2;
    while domains
        .values()
        .any(|domain| Some(domain.id.as_str()) != except_id && domain.slug == slug)
    {
        slug = format!("{base}-{n}");
        n += 1;
    }
    slug
}

pub fn make_domain(
    domains: &HashMap<String, Domain>,
    domain_list: &[DomainSummary],
    name: &str,
) -> Domain {
    Domain {
        id: Uuid::new_v4().to_string(),
        name: name.to_string(),
        slug: slugify(domains, name, None),
        order: next_order(domain_list),
        labels: Vec::new(),
        projects: Vec::new(),
        display_order: Vec::new(),
    }
}

pub fn set_domain_label(
    themes: &[Theme],
    domain: &mut Domain,
    theme_id: &str,
    action: &str,
) -> bool {
    if action == "attach" {
        if !themes.iter().any(|theme| theme.id == theme_id) {
            return false;
        }
        if !domain.labels.iter().any(|label| label == theme_id) {
            domain.labels.push(theme_id.to_string());
        }
        true
    } else {
        domain.labels.retain(|label| label != theme_id);
        true
    }
}

pub fn next_theme_color(theme_count: usize) -> &'static str {
    crate::config::DEFAULT_THEME_COLORS[theme_count % crate::config::DEFAULT_THEME_COLORS.len()]
}

pub fn move_theme(themes: &mut Vec<Theme>, index: usize, direction: &str) -> bool {
    let target = if direction == "up" {
        index.checked_sub(1)
    } else {
        Some(index + 1).filter(|target| *target < themes.len())
    };
    let Some(target) = target else {
        return false;
    };
    let theme = themes.remove(index);
    themes.insert(target, theme);
    true
}

/// Échange l'ordre d'un domaine avec son voisin affiché. Retourne les ids des
/// domaines dont l'ordre a changé (à persister). Reproduit le repli des ordres
/// égaux de `moveDomain`.
pub fn move_domain(
    domains: &mut HashMap<String, Domain>,
    id: &str,
    direction: &str,
) -> Option<Vec<String>> {
    let mut changed: Vec<String> = Vec::new();
    let mut list = rebuild_domain_list(domains);
    let mut index = list.iter().position(|entry| entry.id == id)?;
    let mut target = if direction == "up" {
        index.checked_sub(1)?
    } else {
        index + 1
    };
    if target >= list.len() {
        return None;
    }

    let current_order = domains.get(id)?.order;
    let neighbour_id = list[target].id.clone();
    let neighbour_order = domains.get(&neighbour_id)?.order;

    let list_snapshot = list.clone();
    if current_order == neighbour_order {
        for (position, entry) in list_snapshot.iter().enumerate() {
            if let Some(domain) = domains.get_mut(&entry.id) {
                domain.order = position as f64;
                changed.push(domain.id.clone());
            }
        }
        list = rebuild_domain_list(domains);
        index = list.iter().position(|entry| entry.id == id)?;
        target = if direction == "up" {
            index.checked_sub(1)?
        } else {
            index + 1
        };
        if target >= list.len() {
            return None;
        }
    }

    let neighbour_id = list[target].id.clone();
    let neighbour_order = domains.get(&neighbour_id)?.order;
    let domain = domains.get_mut(id)?;
    let previous_order = domain.order;
    domain.order = neighbour_order;
    let neighbour = domains.get_mut(&neighbour_id)?;
    neighbour.order = previous_order;
    changed.push(id.to_string());
    changed.push(neighbour_id);
    changed.sort();
    changed.dedup();
    Some(changed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node(id: &str, children: Vec<Node>) -> Node {
        Node {
            id: id.to_string(),
            title: id.to_string(),
            status: "todo".to_string(),
            collapsed: false,
            children,
            extra: Map::new(),
        }
    }

    fn domain() -> Domain {
        Domain {
            id: "d".to_string(),
            name: "D".to_string(),
            slug: "d".to_string(),
            order: 0.0,
            labels: Vec::new(),
            projects: vec![
                node("a", vec![node("a1", vec![node("a1x", vec![])])]),
                node("b", vec![]),
            ],
            display_order: vec!["a".into(), "a1".into(), "a1x".into(), "b".into()],
        }
    }

    #[test]
    fn slug_normalization_matches_node_rules() {
        assert_eq!(normalize_slug_base("Été à la maison !"), "ete-a-la-maison");
        assert_eq!(normalize_slug_base("  ---  "), "");
        assert_eq!(normalize_slug_base("Voiture (2)"), "voiture-2");
    }

    #[test]
    fn status_vocabulary_has_three_project_states_and_waiting() {
        assert_eq!(VALID_STATUSES, ["todo", "in_progress", "waiting", "done"]);
        assert_eq!(status_label("todo"), "En projet");
        assert_eq!(status_label("in_progress"), "En cours");
        assert_eq!(status_label("done"), "Terminé");
        assert_eq!(rubrique_label("in_progress"), "À faire");
        assert_eq!(rubrique_label("waiting"), "En attente");
        assert_eq!(normalize_status("someday"), "todo");
        assert_eq!(normalize_status("inconnu"), "todo");
        assert_eq!(normalize_status("waiting"), "waiting");
    }

    #[test]
    fn node_from_value_normalizes_someday_to_todo() {
        let value = serde_json::json!({"id": "n1", "title": "T", "status": "someday"});
        let node = node_from_value(&value).unwrap();
        assert_eq!(node.status, "todo");
    }

    #[test]
    fn set_status_accepts_waiting_and_rejects_someday() {
        let mut projects = vec![node("a", vec![])];
        assert!(set_status(&mut projects, "a", "waiting", "head"));
        assert_eq!(projects[0].status, "waiting");
        assert!(!set_status(&mut projects, "a", "someday", "head"));
        assert_eq!(projects[0].status, "waiting");
    }

    #[test]
    fn ensure_order_appends_missing_children_after_parent() {
        let projects = vec![node("a", vec![node("a1", vec![])]), node("b", vec![])];
        let repaired = ensure_display_order(&projects, &["b".into(), "a".into()]);
        assert_eq!(repaired, vec!["b", "a", "a1"]);
    }

    #[test]
    fn ensure_order_drops_unknown_and_duplicate_ids() {
        let projects = vec![node("a", vec![])];
        let repaired = ensure_display_order(&projects, &["x".into(), "a".into(), "a".into()]);
        assert_eq!(repaired, vec!["a"]);
    }

    #[test]
    fn canonical_order_is_depth_first() {
        let projects = vec![node("a", vec![node("a1", vec![node("a1x", vec![])])])];
        assert_eq!(canonical_order(&projects), vec!["a", "a1", "a1x"]);
    }

    #[test]
    fn block_end_uses_ancestry_not_depth() {
        let mut data = domain();
        // Une ligne insérée sous `a` est affichée entre `a` et ses sous-lignes.
        data.display_order = vec!["a".into(), "b".into(), "a1".into(), "a1x".into()];
        let index = index_outline(&data.projects);
        assert_eq!(block_end(&data.display_order, &index, "a"), Some(4));
        assert_eq!(block_end(&data.display_order, &index, "b"), Some(2));
    }

    #[test]
    fn create_after_inserts_before_children_in_display_order() {
        let mut data = domain();
        let created = create_node_after(&mut data, "a").unwrap();
        let position = data
            .display_order
            .iter()
            .position(|id| id == &created.id)
            .unwrap();
        assert_eq!(position, 1);
        assert_eq!(data.display_order[2], "a1");
    }

    #[test]
    fn indent_moves_node_under_previous_sibling() {
        let mut data = domain();
        // b ne peut pas s'indenter (premier de sa liste) ; a1 passe sous a.
        reindent_node(&mut data, "a1", "indent");
        let a = find_node(&data.projects, "a").unwrap();
        // a1 était déjà enfant de a : l'indentation n'a rien à faire de plus.
        assert!(a.children.iter().any(|child| child.id == "a1"));

        let mut flat = domain();
        flat.projects = vec![node("x", vec![]), node("y", vec![])];
        flat.display_order = vec!["x".into(), "y".into()];
        reindent_node(&mut flat, "y", "indent");
        assert_eq!(find_node(&flat.projects, "x").unwrap().children[0].id, "y");
    }

    #[test]
    fn outdent_stays_in_place_in_display_order() {
        let mut data = domain();
        reindent_node(&mut data, "a1", "outdent");
        assert_eq!(data.display_order, vec!["a", "a1", "a1x", "b"]);
        assert!(data.projects.iter().any(|node| node.id == "a1"));
    }

    #[test]
    fn move_rejects_cycle_and_moves_subtree() {
        let mut data = domain();
        let error = move_node(&mut data, "a", Some("a1"), "inside").unwrap_err();
        assert_eq!(error, "cycle");

        move_node(&mut data, "b", Some("a1"), "before").unwrap();
        let index = index_outline(&data.projects);
        assert!(is_tree_ancestor(&index, "a", "b"));
        let order = ensure_display_order(&data.projects, &data.display_order);
        let b_pos = order.iter().position(|id| id == "b").unwrap();
        let a1_pos = order.iter().position(|id| id == "a1").unwrap();
        assert_eq!(b_pos, a1_pos - 1);
    }

    #[test]
    fn hidden_ids_follow_collapsed_ancestors() {
        let mut data = domain();
        data.projects[0].collapsed = true;
        let hidden = hidden_node_ids(&data.projects, None);
        assert!(hidden.contains("a1"));
        assert!(hidden.contains("a1x"));
        assert!(!hidden.contains("a"));
        assert!(!hidden.contains("b"));

        let mut expanded = HashSet::new();
        expanded.insert("a".to_string());
        let hidden = hidden_node_ids(&data.projects, Some(&expanded));
        assert!(hidden.is_empty());
    }

    #[test]
    fn move_domain_swaps_distinct_orders() {
        let mut domains = HashMap::new();
        for (id, order) in [("a", 0.0), ("b", 1.0)] {
            let mut domain = domain();
            domain.id = id.to_string();
            domain.name = id.to_uppercase();
            domain.order = order;
            domains.insert(id.to_string(), domain);
        }
        let changed = move_domain(&mut domains, "b", "up").unwrap();
        assert!(changed.contains(&"b".to_string()));
        let list = rebuild_domain_list(&domains);
        assert_eq!(list[0].id, "b");
        assert_eq!(list[1].id, "a");
    }

    #[test]
    fn move_domain_collapses_equal_orders() {
        let mut domains = HashMap::new();
        for (id, order) in [("a", 0.0), ("b", 0.0), ("c", 0.0)] {
            let mut domain = domain();
            domain.id = id.to_string();
            domain.name = id.to_uppercase();
            domain.order = order;
            domains.insert(id.to_string(), domain);
        }
        let changed = move_domain(&mut domains, "c", "up").unwrap();
        assert!(changed.contains(&"c".to_string()));
        let list = rebuild_domain_list(&domains);
        assert_eq!(list[1].id, "c");
    }
}
