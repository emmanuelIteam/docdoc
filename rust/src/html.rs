//! Rendu HTML côté serveur.
//!
//! Les fragments et les pages reprennent le balisage exact de `server.js` et de
//! `authpages.js` : `public/app.js` et `public/style.css` s'appuient sur les
//! mêmes ids, classes et attributs `hx-*`.

use crate::accounts::Account;
use crate::config::DEFAULT_THEME_COLORS;
use crate::model::{
    ancestor_chain, ensure_display_order, find_node, hidden_node_ids, index_outline,
    rubrique_label, status_icon, status_label, Domain, DomainSummary, IndexEntry, Theme,
};
use crate::space::{ordered_ids, Space};

/* ------------------------------------------------------------------ */
/* Échappement et liens de tâche                                       */
/* ------------------------------------------------------------------ */

pub fn escape_html(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            other => out.push(other),
        }
    }
    out
}

fn escape_option(value: Option<&str>) -> String {
    escape_html(value.unwrap_or(""))
}

struct TaskLink {
    label: String,
    slug: String,
    id: String,
    end: usize,
}

/// Reconnaît `[label](/domaine/<slug>?reveal=<id>#node-<id>)` à partir de `[`.
fn parse_task_link(text: &str, start: usize) -> Option<TaskLink> {
    let bytes = text.as_bytes();
    if bytes.get(start) != Some(&b'[') {
        return None;
    }
    let mut index = start + 1;
    while index < bytes.len() {
        match bytes[index] {
            b']' => break,
            b'[' | b'\n' => return None,
            _ => index += 1,
        }
    }
    if index >= bytes.len() || index == start + 1 {
        return None;
    }
    let label = text[start + 1..index].to_string();
    index += 1;
    if bytes.get(index) != Some(&b'(') {
        return None;
    }
    index += 1;
    let prefix = b"/domaine/";
    if !text[index..].starts_with(std::str::from_utf8(prefix).ok()?) {
        return None;
    }
    index += prefix.len();

    let slug_start = index;
    while index < bytes.len()
        && (bytes[index].is_ascii_lowercase()
            || bytes[index].is_ascii_digit()
            || bytes[index] == b'-')
    {
        index += 1;
    }
    if index == slug_start {
        return None;
    }
    let slug = text[slug_start..index].to_string();
    if !text[index..].starts_with("?reveal=") {
        return None;
    }
    index += "?reveal=".len();

    let id_start = index;
    while index < bytes.len() && (bytes[index].is_ascii_alphanumeric() || bytes[index] == b'-') {
        index += 1;
    }
    if index == id_start {
        return None;
    }
    let id = text[id_start..index].to_string();
    let suffix = format!("#node-{id})");
    if !text[index..].starts_with(&suffix) {
        return None;
    }
    index += suffix.len();

    Some(TaskLink {
        label,
        slug,
        id,
        end: index,
    })
}

/// Rend un titre : texte échappé + un lien par lien de tâche valide.
pub fn render_title_html(title: &str) -> String {
    let mut out = String::new();
    let mut last = 0;
    let mut index = 0;
    let bytes = title.as_bytes();
    while index < bytes.len() {
        if bytes[index] == b'[' {
            if let Some(link) = parse_task_link(title, index) {
                out.push_str(&escape_html(&title[last..index]));
                let href = format!("/domaine/{}?reveal={}#node-{}", link.slug, link.id, link.id);
                out.push_str(&format!(
                    "<a class=\"title-link\" href=\"{}\" draggable=\"false\">{}</a>",
                    escape_html(&href),
                    escape_html(&link.label)
                ));
                last = link.end;
                index = link.end;
                continue;
            }
        }
        index += 1;
    }
    out.push_str(&escape_html(&title[last..]));
    out
}

/// Texte visible d'un titre : chaque lien valide remplacé par son libellé.
pub fn title_label(title: &str) -> String {
    let mut out = String::new();
    let mut last = 0;
    let mut index = 0;
    let bytes = title.as_bytes();
    while index < bytes.len() {
        if bytes[index] == b'[' {
            if let Some(link) = parse_task_link(title, index) {
                out.push_str(&title[last..index]);
                out.push_str(&link.label);
                last = link.end;
                index = link.end;
                continue;
            }
        }
        index += 1;
    }
    out.push_str(&title[last..]);
    out
}

/* ------------------------------------------------------------------ */
/* Coquille commune                                                    */
/* ------------------------------------------------------------------ */

pub fn installability_head() -> String {
    [
        "<meta name=\"theme-color\" content=\"#2563eb\">",
        "<link rel=\"manifest\" href=\"/manifest.webmanifest\">",
        "<link rel=\"icon\" href=\"/icons/favicon-32.png\" sizes=\"32x32\" type=\"image/png\">",
        "<link rel=\"apple-touch-icon\" href=\"/icons/apple-touch-icon-180.png\">",
        "<meta name=\"mobile-web-app-capable\" content=\"yes\">",
        "<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">",
        "<meta name=\"apple-mobile-web-app-title\" content=\"docdoc\">",
    ]
    .join("\n  ")
}

#[derive(Default)]
pub struct ShellOptions {
    pub title: Option<String>,
    pub home: bool,
    pub admin: bool,
    pub help: bool,
    pub labels_bar: bool,
    pub ancestry: bool,
    /// Domain pages only: the header offers the "add a project" control, which
    /// inserts a new project at the head of the outline.
    pub add_project: bool,
}

pub fn render_shell(
    space: &Space,
    content: &str,
    active_slug: Option<&str>,
    options: &ShellOptions,
) -> String {
    let title = options.title.as_deref().unwrap_or("Mes projets");
    let active_slug = active_slug.unwrap_or("");
    let ancestry = if options.ancestry {
        "<nav class=\"ancestry\" id=\"ancestry\" aria-label=\"Hiérarchie des tâches mères\"></nav>"
    } else {
        ""
    };
    let topbar_class = if options.ancestry {
        "topbar topbar-sticky"
    } else {
        "topbar"
    };
    let body_class = if options.labels_bar {
        "has-labels-bar"
    } else {
        ""
    };
    // The control lives in the shell, not in the outline: an htmx swap of
    // `#outline` can never replace it, so it needs no client re-binding.
    let add_project = if options.add_project {
        "<button type=\"button\" class=\"btn-mini topbar-add\" id=\"add-project\" title=\"Ajouter un projet\" aria-label=\"Ajouter un projet\">+</button>"
    } else {
        ""
    };

    format!(
        "<!doctype html>
<html lang=\"fr\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <title>{title}</title>
  {head}
  <link rel=\"stylesheet\" href=\"/style.css\">
</head>
<body class=\"{body_class}\" data-domain-slug=\"{slug}\">
  <div class=\"shell\">
    {sidebar}
    <div class=\"content\">
      <header class=\"{topbar_class}\" id=\"topbar\">
        <button type=\"button\" class=\"btn sidebar-toggle\" id=\"sidebar-toggle\" title=\"Afficher/masquer le panneau\">☰</button>
        <h1>{title}</h1>
        {add_project}
        {ancestry}
      </header>
      <main>{content}</main>
    </div>
  </div>
  <script src=\"/htmx.min.js\"></script>
  <script src=\"/app.js\"></script>
  <script src=\"/pwa.js\"></script>
</body>
</html>",
        title = escape_html(title),
        head = installability_head(),
        body_class = body_class,
        slug = escape_html(active_slug),
        sidebar = render_sidebar(space, active_slug, options),
        topbar_class = topbar_class,
        add_project = add_project,
        ancestry = ancestry,
        content = content
    )
}

pub fn render_sidebar(space: &Space, active_slug: &str, options: &ShellOptions) -> String {
    let home_active = options.home;
    let admin_active = options.admin;
    let help_active = options.help;
    let home_class = if home_active {
        "sidebar-link sidebar-home active"
    } else {
        "sidebar-link sidebar-home"
    };
    let admin_class = if admin_active {
        "sidebar-link sidebar-admin active"
    } else {
        "sidebar-link sidebar-admin"
    };
    let help_class = if help_active {
        "sidebar-link sidebar-help active"
    } else {
        "sidebar-link sidebar-help"
    };
    let home_current = if home_active {
        " aria-current=\"page\""
    } else {
        ""
    };
    let admin_current = if admin_active {
        " aria-current=\"page\""
    } else {
        ""
    };
    let help_current = if help_active {
        " aria-current=\"page\""
    } else {
        ""
    };

    // The reorder forms return to the page they were submitted from, so a move
    // never navigates away from what the user is reading.
    let current_path: String = if home_active {
        "/".to_string()
    } else if admin_active {
        "/administration".to_string()
    } else if help_active {
        "/aide".to_string()
    } else if !active_slug.is_empty() {
        format!("/domaine/{active_slug}")
    } else {
        "/".to_string()
    };

    format!(
        "<aside class=\"sidebar\" id=\"sidebar\">
      <div class=\"sidebar-top\" id=\"sidebar-top\">
        <a class=\"{home_class}\" href=\"/\"{home_current}>Accueil</a>
      </div>
      <div class=\"sidebar-header\">Domaines</div>
      <nav class=\"sidebar-nav\" id=\"sidebar-nav\">{nav}</nav>
      <div class=\"sidebar-footer\">
        <nav class=\"sidebar-extra\">
          <a class=\"{admin_class}\" href=\"/administration\"{admin_current}>Administration</a>
          <a class=\"{help_class}\" href=\"/aide\"{help_current}>Aide</a>
        </nav>
        <div class=\"install-box\" id=\"install-box\">
          <button type=\"button\" class=\"btn-mini install-btn\" id=\"install-btn\" hidden>Installer l'application</button>
          <p class=\"install-hint\" id=\"install-hint\" hidden>Partager → « Sur l'écran d'accueil »</p>
        </div>
        <div class=\"session-box\">
          <span class=\"session-email\" title=\"{email}\">{email}</span>
          <a class=\"btn-mini\" href=\"/auth/passkeys\" title=\"Gérer mes passkeys\">🔑</a>
          <form method=\"post\" action=\"/logout\" class=\"inline-form\">
            <button type=\"submit\" class=\"btn-mini\" title=\"Déconnexion\">Déconnexion</button>
          </form>
        </div>
      </div>
    </aside>",
        home_class = home_class,
        home_current = home_current,
        nav = render_sidebar_nav(space, active_slug, &current_path),
        admin_class = admin_class,
        admin_current = admin_current,
        help_class = help_class,
        help_current = help_current,
        email = escape_html(&space.email),
    )
}

fn sidebar_move_form(
    domain: &DomainSummary,
    direction: &str,
    enabled: bool,
    return_to: &str,
) -> String {
    let label = if direction == "up" {
        "Monter"
    } else {
        "Descendre"
    };
    let named = format!("{} « {} »", label, escape_html(&domain.name));
    let disabled = if enabled { "" } else { " disabled" };
    let arrow = if direction == "up" { "↑" } else { "↓" };
    format!(
        "<form method=\"post\" action=\"/api/domains/{}/move\" class=\"sidebar-move\">\
         <input type=\"hidden\" name=\"dir\" value=\"{}\">\
         <input type=\"hidden\" name=\"returnTo\" value=\"{}\">\
         <button type=\"submit\" class=\"btn-mini sidebar-move-btn\" title=\"{}\" aria-label=\"{}\"{}>{}</button>\
         </form>",
        escape_html(&domain.id),
        direction,
        escape_html(return_to),
        named,
        named,
        disabled,
        arrow
    )
}

fn sidebar_domain_row(
    domain: &DomainSummary,
    active_slug: &str,
    return_to: &str,
    index: usize,
    total: usize,
) -> String {
    let class = if domain.slug == active_slug {
        "sidebar-link active"
    } else {
        "sidebar-link"
    };
    let link = format!(
        "<a class=\"{}\" href=\"/domaine/{}\">{}</a>",
        class,
        escape_html(&domain.slug),
        escape_html(&domain.name)
    );
    format!(
        "<div class=\"sidebar-domain\">\
         {}<span class=\"sidebar-order\">{}{}</span>\
         </div>",
        link,
        sidebar_move_form(domain, "up", index > 0, return_to),
        sidebar_move_form(domain, "down", index + 1 < total, return_to)
    )
}

pub fn render_sidebar_nav(space: &Space, active_slug: &str, return_to: &str) -> String {
    // A single-level navigation list: one entry per active domain, in the manual
    // order carried by `space.domain_list`. Themes are labels managed on the
    // domain page and in the administration; they no longer group the panel, so
    // a domain carrying several themes appears exactly once. The two move
    // controls of a row are the only mutation the panel offers.
    if space.domain_list.is_empty() {
        return "<p class=\"sidebar-empty\">Aucun domaine</p>".to_string();
    }
    let total = space.domain_list.len();
    space
        .domain_list
        .iter()
        .enumerate()
        .map(|(index, domain)| sidebar_domain_row(domain, active_slug, return_to, index, total))
        .collect()
}

/* ------------------------------------------------------------------ */
/* Étiquettes                                                          */
/* ------------------------------------------------------------------ */

fn theme_chip(domain: &Domain, theme: &Theme) -> String {
    format!(
        "<form method=\"post\" action=\"/domaine/{slug}/api/labels\" class=\"label-chip\" hx-post=\"/domaine/{slug}/api/labels\" hx-target=\"#labels-bar\" hx-swap=\"outerHTML\">\
         <input type=\"hidden\" name=\"action\" value=\"detach\">\
         <input type=\"hidden\" name=\"themeId\" value=\"{id}\">\
         <span class=\"label-chip-dot\" style=\"background:{color}\"></span>\
         <span class=\"label-chip-name\">{name}</span>\
         <button type=\"submit\" class=\"label-chip-x\" title=\"Retirer l'étiquette\">×</button>\
         </form>",
        slug = escape_html(&domain.slug),
        id = escape_html(&theme.id),
        color = escape_html(&theme.color),
        name = escape_html(&theme.name),
    )
}

pub fn render_labels_bar(space: &Space, domain: &Domain) -> String {
    let chips = domain
        .labels
        .iter()
        .filter_map(|id| space.theme_by_id(id))
        .map(|theme| theme_chip(domain, theme))
        .collect::<String>();

    let controls = if space.themes.is_empty() {
        "<p class=\"label-attach-empty\">Aucun thème — créez-en un dans <a href=\"/administration\">Administration</a>.</p>".to_string()
    } else {
        let options = space
            .themes
            .iter()
            .map(|theme| {
                format!(
                    "<option value=\"{}\">{}</option>",
                    escape_html(&theme.id),
                    escape_html(&theme.name)
                )
            })
            .collect::<String>();
        format!(
            "<button type=\"button\" class=\"btn-mini\" id=\"label-add-btn\" title=\"Coller une étiquette\" aria-expanded=\"false\">+</button>\
             <form method=\"post\" action=\"/domaine/{slug}/api/labels\" class=\"label-attach-form\" id=\"label-attach-form\" hidden hx-post=\"/domaine/{slug}/api/labels\" hx-target=\"#labels-bar\" hx-swap=\"outerHTML\">\
             <input type=\"hidden\" name=\"action\" value=\"attach\">\
             <select name=\"themeId\" aria-label=\"Thème à attacher\">{options}</select>\
             <button type=\"submit\" class=\"btn\">Attacher</button>\
             </form>",
            slug = escape_html(&domain.slug),
            options = options
        )
    };

    format!(
        "<div class=\"labels-bar\" id=\"labels-bar\">
      <span class=\"labels-bar-icon\" title=\"Étiquettes\">🏷</span>
      {chips}
      {controls}
    </div>"
    )
}

/* ------------------------------------------------------------------ */
/* Outline                                                             */
/* ------------------------------------------------------------------ */

fn status_button(slug: &str, node_id: &str, status: &str, current: &str) -> String {
    // "En cours" is active for both sub-states of the active work: a `waiting`
    // line shows the in-progress action, which brings it back to `in_progress`.
    let active = if current == status || (status == "in_progress" && current == "waiting") {
        " active"
    } else {
        ""
    };
    let scope_js = format!(
        "js:{{status:\"{status}\", scope:window.outlineSubtreeHasSelected && window.outlineSubtreeHasSelected(this) ? \"subtree\" : \"head\"}}"
    );
    format!(
        "<button type=\"button\" class=\"menu-item{active}\" hx-post=\"/domaine/{slug}/api/nodes/{node_id}/status\" hx-vals='{scope_js}' hx-target=\"#outline\" hx-swap=\"outerHTML\" title=\"{label}\">{icon}</button>",
        active = active,
        slug = escape_html(slug),
        node_id = escape_html(node_id),
        scope_js = scope_js,
        label = status_label(status),
        icon = status_icon(status),
    )
}

fn line_status_class(status: &str) -> &'static str {
    match status {
        "in_progress" => "status-in-progress",
        "waiting" => "status-waiting",
        "done" => "status-done",
        _ => "",
    }
}

fn render_line(entry: &IndexEntry, id: &str, slug: &str, collapsed: bool) -> String {
    let status_class = line_status_class(&entry.status);
    let menu = format!(
        "<div class=\"menu\">\
         {todo}{progress}{done}\
         <button type=\"button\" class=\"menu-item copy-link\" title=\"Copier le lien\">🔗</button>\
         <button type=\"button\" class=\"menu-item rename\" title=\"Renommer\">✎</button>\
         <button type=\"button\" class=\"menu-item\" hx-post=\"/domaine/{slug}/api/nodes/{id}/indent\" hx-target=\"#outline\" hx-swap=\"outerHTML\" title=\"Indenter\">→</button>\
         <button type=\"button\" class=\"menu-item\" hx-post=\"/domaine/{slug}/api/nodes/{id}/outdent\" hx-target=\"#outline\" hx-swap=\"outerHTML\" title=\"Désindenter\">←</button>\
         <button type=\"button\" class=\"menu-item add-child\" title=\"Ajouter une tâche\">+</button>\
         <button type=\"button\" class=\"menu-item danger\" hx-delete=\"/domaine/{slug}/api/nodes/{id}\" hx-target=\"#outline\" hx-swap=\"outerHTML\" title=\"Supprimer\">🗑</button>\
         </div>",
        todo = status_button(slug, id, "todo", &entry.status),
        progress = status_button(slug, id, "in_progress", &entry.status),
        done = status_button(slug, id, "done", &entry.status),
        slug = escape_html(slug),
        id = escape_html(id),
    );

    let aria_label = if collapsed {
        "Sélectionner la ligne — repliée, contient des sous-tâches masquées"
    } else {
        "Sélectionner la ligne"
    };
    let subtasks_mark = if collapsed {
        "<span class=\"bullet-subtasks\" aria-hidden=\"true\"></span>"
    } else {
        ""
    };
    let collapsed_class = if collapsed { " collapsed" } else { "" };

    format!(
        "<li class=\"line{collapsed_class}\" id=\"node-{id}\" data-id=\"{id}\" data-parent=\"{parent}\" data-depth=\"{depth}\" style=\"--depth:{depth}\">\
         <button class=\"bullet\" type=\"button\" title=\"Sélectionner — glisser pour déplacer\" aria-label=\"{aria}\" draggable=\"true\">\
         <span class=\"bullet-dot\" aria-hidden=\"true\">●</span>\
         <span class=\"bullet-grip\" aria-hidden=\"true\">⠿</span>\
         {mark}\
         </button>\
         <span class=\"title {status_class}\" data-id=\"{id}\" data-title=\"{data_title}\">{title_html}</span>\
         {menu}\
         </li>",
        collapsed_class = collapsed_class,
        id = escape_html(id),
        parent = escape_option(entry.parent.as_deref()),
        depth = entry.depth,
        aria = aria_label,
        mark = subtasks_mark,
        status_class = status_class,
        data_title = escape_html(&entry.title),
        title_html = render_title_html(&entry.title),
        menu = menu,
    )
}

pub fn render_outline(
    domain: &Domain,
    expand_ids: Option<&std::collections::HashSet<String>>,
) -> String {
    let index = index_outline(&domain.projects);
    let order = ensure_display_order(&domain.projects, &domain.display_order);
    let hidden = hidden_node_ids(&domain.projects, expand_ids);
    let mut lines = String::new();
    for id in &order {
        let Some(entry) = index.get(id) else {
            continue;
        };
        if hidden.contains(id) {
            continue;
        }
        let collapsed = entry.has_children
            && entry.collapsed
            && !expand_ids.map(|ids| ids.contains(id)).unwrap_or(false);
        lines.push_str(&render_line(entry, id, &domain.slug, collapsed));
    }
    format!("<ul id=\"outline\" class=\"outline\">{lines}</ul>")
}

pub fn render_page(
    space: &Space,
    domain: &Domain,
    expand_ids: Option<&std::collections::HashSet<String>>,
) -> String {
    let content = format!(
        "{}{}",
        render_outline(domain, expand_ids),
        render_labels_bar(space, domain)
    );
    render_shell(
        space,
        &content,
        Some(&domain.slug),
        &ShellOptions {
            title: Some(domain.name.clone()),
            labels_bar: true,
            ancestry: true,
            add_project: true,
            ..Default::default()
        },
    )
}

/* ------------------------------------------------------------------ */
/* Accueil                                                             */
/* ------------------------------------------------------------------ */

// The two rubriques of the home board: the sub-states of "En cours". Their
// labels come from `rubrique_label`, so the board and the help text cannot drift.
const GTD_RUBRIQUES: [&str; 2] = ["in_progress", "waiting"];

// The rubrique of a leaf line, or None when the line is not listed on the home
// board. Only the two sub-states of "En cours" are listed: `in_progress`
// ("À faire") and `waiting` ("En attente"). `todo` ("En projet"), `done`, legacy
// `someday` (normalized to `todo`) and lines with children never appear.
pub(crate) fn home_rubrique(node: &crate::model::Node) -> Option<&'static str> {
    if !node.children.is_empty() {
        return None;
    }
    match node.status.as_str() {
        "in_progress" => Some("in_progress"),
        "waiting" => Some("waiting"),
        _ => None,
    }
}

// Group every listed leaf into the two rubriques in the natural order — sidebar
// domain order, then the outline's display order — then apply the account's
// manual order. The natural order is what a rubrique shows until a card is
// moved; the recorded order then takes precedence, and any card without a
// recorded position is appended at the end.
fn home_tasks(space: &Space) -> [Vec<(Domain, crate::model::Node, Vec<IndexEntry>)>; 2] {
    let mut buckets: [Vec<(Domain, crate::model::Node, Vec<IndexEntry>)>; 2] =
        [Vec::new(), Vec::new()];
    for summary in &space.domain_list {
        let Some(domain) = space.domains.get(&summary.id) else {
            continue;
        };
        let index = index_outline(&domain.projects);
        let order = ensure_display_order(&domain.projects, &domain.display_order);
        for id in order {
            if !index.contains_key(&id) {
                continue;
            }
            let Some(node) = find_node(&domain.projects, &id).cloned() else {
                continue;
            };
            let Some(rubrique) = home_rubrique(&node) else {
                continue;
            };
            let bucket = match rubrique {
                "in_progress" => 0,
                _ => 1,
            };
            buckets[bucket].push((domain.clone(), node, ancestor_chain(&index, &id)));
        }
    }
    for (position, rubrique) in GTD_RUBRIQUES.iter().enumerate() {
        let recorded = space.home_order.for_rubrique(rubrique);
        buckets[position] = reorder_home_bucket(std::mem::take(&mut buckets[position]), recorded);
    }
    buckets
}

fn reorder_home_bucket(
    entries: Vec<(Domain, crate::model::Node, Vec<IndexEntry>)>,
    recorded: &[String],
) -> Vec<(Domain, crate::model::Node, Vec<IndexEntry>)> {
    let natural: Vec<String> = entries.iter().map(|(_, node, _)| node.id.clone()).collect();
    let ordered = ordered_ids(recorded, &natural);
    let mut by_id: std::collections::HashMap<String, _> = entries
        .into_iter()
        .map(|entry| (entry.1.id.clone(), entry))
        .collect();
    ordered
        .into_iter()
        .filter_map(|id| by_id.remove(&id))
        .collect()
}

/// Identifiants des cartes de la rubrique dans leur ordre affiché, après
/// application de l'ordre manuel. Utilisé par la route de positionnement pour
/// réinsérer une carte à l'index demandé.
pub fn home_order_ids(space: &Space, rubrique: &str) -> Vec<String> {
    let buckets = home_tasks(space);
    let position = if rubrique == "waiting" { 1 } else { 0 };
    buckets[position]
        .iter()
        .map(|(_, node, _)| node.id.clone())
        .collect()
}

// One card of the board. The title is the deep link; the grip, the up/down
// arrows and the rubrique menu are separate controls so a drag never follows
// the link. The arrows request a one-step position and are disabled at the
// ends; the menu appends to the target rubrique (no `index`).
fn home_task_card(
    domain: &Domain,
    node: &crate::model::Node,
    ancestors: &[IndexEntry],
    rubrique: &str,
    position: usize,
    total: usize,
) -> String {
    let href = format!(
        "/domaine/{}?reveal={}#node-{}",
        domain.slug, node.id, node.id
    );
    let title = escape_html(&title_label(&node.title));
    let chain = ancestors
        .iter()
        .map(|ancestor| {
            format!(
                "<span class=\"home-task-hop\">\
                 <span class=\"home-task-sep\" aria-hidden=\"true\">›</span>\
                 <span class=\"home-task-parent\">{}</span>\
                 </span>",
                escape_html(&title_label(&ancestor.title))
            )
        })
        .collect::<String>();
    let position_vals = |index: i64| {
        escape_html(&format!(
            "{{\"domain\":\"{}\",\"node\":\"{}\",\"rubrique\":\"{}\",\"index\":{}}}",
            domain.slug, node.id, rubrique, index
        ))
    };
    let order_button = |direction: &str, index: i64, disabled: bool, label: &str, glyph: &str| {
        format!(
                "<button type=\"button\" class=\"gtd-order-btn\" data-dir=\"{direction}\"\
                 aria-label=\"{label}\" title=\"{label}\" hx-post=\"/api/home/order\"\
                 hx-vals='{vals}' hx-target=\"#home-board\" hx-swap=\"outerHTML\"{disabled}>{glyph}</button>",
                vals = position_vals(index),
                disabled = if disabled { " disabled" } else { "" },
            )
    };
    let up_label = format!("Monter « {} »", title);
    let down_label = format!("Descendre « {} »", title);
    let order = format!(
        "<div class=\"gtd-order\">{}{}</div>",
        order_button("up", position as i64 - 1, position == 0, &up_label, "↑"),
        order_button(
            "down",
            position as i64 + 1,
            position + 1 >= total,
            &down_label,
            "↓"
        ),
    );
    let choices = GTD_RUBRIQUES
        .iter()
        .map(|id| {
            let id = *id;
            let label = rubrique_label(id);
            if id == rubrique {
                format!(
                    "<button type=\"button\" class=\"gtd-move-item current\" disabled aria-current=\"true\">{label}</button>"
                )
            } else {
                let vals = escape_html(&format!(
                    "{{\"domain\":\"{}\",\"node\":\"{}\",\"rubrique\":\"{}\"}}",
                    domain.slug, node.id, id
                ));
                format!(
                    "<button type=\"button\" class=\"gtd-move-item\" hx-post=\"/api/home/order\" hx-vals='{vals}' hx-target=\"#home-board\" hx-swap=\"outerHTML\">{label}</button>"
                )
            }
        })
        .collect::<String>();
    format!(
        "<li class=\"gtd-card\" id=\"gtd-node-{node_id}\" draggable=\"true\" data-domain=\"{slug}\" data-node=\"{node_id}\" data-rubrique=\"{rubrique}\">\
         <button class=\"gtd-grip\" type=\"button\" draggable=\"true\" title=\"Déplacer la tâche\" aria-label=\"Déplacer « {title} »\">⠿</button>\
         <div class=\"gtd-card-body\">\
         <a class=\"gtd-card-title\" href=\"{href}\" draggable=\"false\">{title}</a>\
         <span class=\"home-task-context gtd-card-context\">\
         <span class=\"home-task-domain\">{domain_name}</span>\
         {chain}\
         </span>\
         </div>\
         {order}\
         <details class=\"gtd-move\">\
         <summary class=\"gtd-move-summary\" title=\"Changer de rubrique\" aria-label=\"Changer la rubrique de « {title} »\">⋯</summary>\
         <div class=\"gtd-move-menu\">\
         <span class=\"gtd-move-label\">Changer de rubrique</span>\
         {choices}\
         </div>\
         </details>\
         </li>",
        node_id = escape_html(&node.id),
        slug = escape_html(&domain.slug),
        rubrique = escape_html(rubrique),
        title = title,
        href = escape_html(&href),
        domain_name = escape_html(&domain.name),
        chain = chain,
        order = order,
        choices = choices,
    )
}

pub fn render_home_board(space: &Space) -> String {
    let buckets = home_tasks(space);
    let mut columns = String::new();
    for (index, id) in GTD_RUBRIQUES.iter().enumerate() {
        let id = *id;
        let label = rubrique_label(id);
        let entries = &buckets[index];
        let cards = entries
            .iter()
            .enumerate()
            .map(|(position, (domain, node, ancestors))| {
                home_task_card(domain, node, ancestors, id, position, entries.len())
            })
            .collect::<String>();
        let body = if cards.is_empty() {
            "<p class=\"gtd-empty\">Aucune tâche</p>".to_string()
        } else {
            format!("<ul class=\"gtd-list\">{cards}</ul>")
        };
        columns.push_str(&format!(
            "<section class=\"gtd-column\" data-gtd=\"{id}\" aria-labelledby=\"gtd-{id}-heading\">\
             <header class=\"gtd-column-head\"><h3 id=\"gtd-{id}-heading\">{label} <span class=\"gtd-count\">{count}</span></h3></header>\
             {body}\
             </section>",
            id = id,
            label = label,
            count = entries.len(),
            body = body,
        ));
    }
    format!(
        "<div id=\"home-board\" class=\"gtd-board-wrap\" aria-label=\"Tâches en cours\">\
         <h2 class=\"gtd-group-title\">En cours</h2>\
         <div class=\"gtd-board\">{columns}</div>\
         </div>"
    )
}

pub fn render_home_page(space: &Space) -> String {
    let content = if space.domain_list.is_empty() {
        "<div class=\"empty-state\"><h2>Aucun domaine</h2><p>Créez un domaine depuis la page <a href=\"/administration\">Administration</a> pour regrouper vos projets.</p></div>".to_string()
    } else {
        format!(
            "{}<p id=\"gtd-announcer\" class=\"sr-only\" aria-live=\"polite\"></p>",
            render_home_board(space)
        )
    };
    render_shell(
        space,
        &content,
        None,
        &ShellOptions {
            title: Some("Tableau de bord".to_string()),
            home: true,
            ..Default::default()
        },
    )
}

/* ------------------------------------------------------------------ */
/* Administration                                                      */
/* ------------------------------------------------------------------ */

const ADMIN_RETURN: &str = "<input type=\"hidden\" name=\"returnTo\" value=\"/administration\">";

pub fn confirm_submit(message: &str) -> String {
    let json = serde_json::to_string(message).unwrap_or_else(|_| "\"\"".to_string());
    format!("onsubmit=\"return confirm({})\"", escape_html(&json))
}

fn admin_move_forms(action: &str, can_up: bool, can_down: bool) -> String {
    let form = |direction: &str, label: &str, enabled: bool| {
        format!(
            "<form method=\"post\" action=\"{action}/move\" class=\"inline-form\">\
               <input type=\"hidden\" name=\"dir\" value=\"{direction}\">\
               {admin_return}\
               <button type=\"submit\" class=\"btn-mini admin-move\" title=\"{label}\"{disabled}>{glyph}</button>\
             </form>",
            action = escape_html(action),
            direction = direction,
            admin_return = ADMIN_RETURN,
            label = label,
            disabled = if enabled { "" } else { " disabled" },
            glyph = if direction == "up" { "↑" } else { "↓" },
        )
    };
    format!(
        "{}{}",
        form("up", "Monter", can_up),
        form("down", "Descendre", can_down)
    )
}

fn theme_chips(space: &Space, labels: &[String]) -> String {
    let chips = labels
        .iter()
        .filter_map(|id| space.theme_by_id(id))
        .map(|theme| {
            format!(
                "<span class=\"label-chip\">\
                 <span class=\"label-chip-dot\" style=\"background:{color}\"></span>\
                 <span class=\"label-chip-name\">{name}</span>\
                 </span>",
                color = escape_html(&theme.color),
                name = escape_html(&theme.name)
            )
        })
        .collect::<String>();
    if chips.is_empty() {
        "<span class=\"admin-meta\">Aucun</span>".to_string()
    } else {
        chips
    }
}

fn render_theme_rows(space: &Space) -> String {
    let mut rows = String::new();
    for (index, theme) in space.themes.iter().enumerate() {
        let count = space
            .domain_list
            .iter()
            .filter(|domain| domain.labels.iter().any(|label| label == &theme.id))
            .count();
        rows.push_str(&format!(
            "<li class=\"admin-row\">
        <form method=\"post\" action=\"/api/themes/{id}/rename\" class=\"admin-inline-form\">
          <input name=\"name\" value=\"{name}\" class=\"theme-name-input\" aria-label=\"Nom du thème\" required autocomplete=\"off\">
          <input type=\"color\" name=\"color\" value=\"{color}\" class=\"admin-color\" aria-label=\"Couleur du thème\" title=\"Couleur du thème\">
          <button type=\"submit\" class=\"btn-mini\" title=\"Enregistrer le nom et la couleur\">✓</button>
          {admin_return}
        </form>
        <span class=\"admin-meta\">{count} domaine{plural}</span>
        <span class=\"admin-actions\">
          {moves}
          <form method=\"post\" action=\"/api/themes/{id}/delete\" class=\"inline-form\" {confirm}>
            <button type=\"submit\" class=\"btn-mini danger\" title=\"Supprimer\">🗑</button>
          </form>
        </span>
      </li>",
            id = escape_html(&theme.id),
            name = escape_html(&theme.name),
            color = escape_html(&theme.color),
            admin_return = ADMIN_RETURN,
            count = count,
            plural = if count > 1 { "s" } else { "" },
            moves = admin_move_forms(
                &format!("/api/themes/{}", theme.id),
                index > 0,
                index + 1 < space.themes.len()
            ),
            confirm = confirm_submit("Supprimer ce thème et le retirer des domaines ?"),
        ));
    }
    rows
}

fn render_domain_rows(space: &Space) -> String {
    let mut rows = String::new();
    for (index, entry) in space.domain_list.iter().enumerate() {
        let Some(domain) = space.domains.get(&entry.id) else {
            continue;
        };
        rows.push_str(&format!(
            "<tr>
        <td class=\"admin-name-cell\">
          <span class=\"admin-domain-name\">{name}</span>
          <details class=\"admin-rename\">
            <summary class=\"btn-mini\" title=\"Renommer le domaine\" aria-label=\"Renommer le domaine\">✎</summary>
            <form method=\"post\" action=\"/api/domains/{id}/rename\" class=\"admin-inline-form\">
              <input name=\"name\" value=\"{name}\" class=\"rename-input\" aria-label=\"Nouveau nom du domaine\" required autocomplete=\"off\">
              <button type=\"submit\" class=\"btn-mini\" title=\"Enregistrer le nom\">✓</button>
              {admin_return}
            </form>
            <p class=\"admin-hint\">L'URL sera régénérée à partir du nouveau nom.</p>
          </details>
        </td>
        <td><a class=\"admin-url\" href=\"/domaine/{slug}\">/domaine/{slug}</a></td>
        <td><span class=\"theme-chips\">{chips}</span></td>
        <td class=\"admin-actions-cell\">
          {moves}
          <form method=\"post\" action=\"/api/domains/{id}/archive\" class=\"inline-form\" {confirm}>
            <button type=\"submit\" class=\"btn-mini danger\" title=\"Archiver\">🗑</button>
            {admin_return}
          </form>
        </td>
      </tr>",
            name = escape_html(&domain.name),
            id = escape_html(&domain.id),
            slug = escape_html(&domain.slug),
            admin_return = ADMIN_RETURN,
            chips = theme_chips(space, &entry.labels),
            moves = admin_move_forms(
                &format!("/api/domains/{}", domain.id),
                index > 0,
                index + 1 < space.domain_list.len()
            ),
            confirm = confirm_submit("Archiver ce domaine et son contenu ?"),
        ));
    }
    rows
}

fn render_matrix(space: &Space) -> String {
    if space.themes.is_empty() || space.domain_list.is_empty() {
        return "<div class=\"matrix-scroll\"><p class=\"admin-empty\">Aucune répartition à afficher : il faut au moins un thème et un domaine.</p></div>".to_string();
    }
    let head = space
        .domain_list
        .iter()
        .map(|domain| format!("<th scope=\"col\">{}</th>", escape_html(&domain.name)))
        .collect::<String>();
    let mut rows = String::new();
    for theme in &space.themes {
        let mut cells = String::new();
        for domain in &space.domain_list {
            let attached = domain.labels.iter().any(|label| label == &theme.id);
            let title = format!(
                "{} « {} » {} « {} »",
                if attached { "Retirer" } else { "Attacher" },
                theme.name,
                if attached { "de" } else { "à" },
                domain.name
            );
            cells.push_str(&format!(
                "<td><form method=\"post\" action=\"/api/themes/{theme_id}/labels\" class=\"matrix-form\">\
                 <input type=\"hidden\" name=\"domainId\" value=\"{domain_id}\">\
                 <input type=\"hidden\" name=\"action\" value=\"{action}\">\
                 {admin_return}\
                 <button type=\"submit\" class=\"matrix-toggle{on}\" aria-pressed=\"{attached}\" title=\"{title}\">{glyph}</button>\
                 </form></td>",
                theme_id = escape_html(&theme.id),
                domain_id = escape_html(&domain.id),
                action = if attached { "detach" } else { "attach" },
                admin_return = ADMIN_RETURN,
                on = if attached { " on" } else { "" },
                attached = attached,
                title = escape_html(&title),
                glyph = if attached { "✓" } else { "○" },
            ));
        }
        rows.push_str(&format!(
            "<tr><th scope=\"row\"><span class=\"theme-dot\" style=\"background:{color}\"></span> {name}</th>{cells}</tr>",
            color = escape_html(&theme.color),
            name = escape_html(&theme.name),
        ));
    }
    format!(
        "<div class=\"matrix-scroll\"><table class=\"matrix\">
    <thead><tr><th scope=\"col\">Thème</th>{head}</tr></thead>
    <tbody>{rows}</tbody>
  </table></div>"
    )
}

#[derive(Clone, Debug)]
pub struct ArchiveSummary {
    pub id: String,
    pub name: String,
    pub labels: Vec<String>,
}

fn render_archive_rows(space: &Space, archives: &[ArchiveSummary]) -> String {
    archives
        .iter()
        .map(|archive| {
            format!(
                "<tr>
        <td>{name}</td>
        <td><span class=\"theme-chips\">{chips}</span></td>
        <td class=\"admin-actions-cell\">
          <form method=\"post\" action=\"/api/archives/{id}/restore\" class=\"inline-form\">
            <button type=\"submit\" class=\"btn\" title=\"Restaurer ce domaine\">Restaurer</button>
            {admin_return}
          </form>
          <form method=\"post\" action=\"/api/archives/{id}/purge\" class=\"inline-form\" {confirm}>
            <button type=\"submit\" class=\"btn danger\" title=\"Supprimer définitivement\">Purger</button>
            {admin_return}
          </form>
        </td>
      </tr>",
                name = escape_html(&archive.name),
                chips = theme_chips(space, &archive.labels),
                id = escape_html(&archive.id),
                admin_return = ADMIN_RETURN,
                confirm = confirm_submit(&format!(
                    "Purger définitivement « {} » ? Cette action est irréversible.",
                    archive.name
                )),
            )
        })
        .collect()
}

pub fn render_admin_page(space: &Space, archives: &[ArchiveSummary], restored: bool) -> String {
    let themes_section = format!(
        "<section class=\"admin-section\" id=\"admin-themes\">
    <h2>Thèmes</h2>
    <form method=\"post\" action=\"/api/themes\" class=\"admin-create\">
      <input name=\"name\" placeholder=\"Nom du thème\" required autocomplete=\"off\" aria-label=\"Nom du nouveau thème\">
      <label class=\"color-field\">Couleur <input type=\"color\" name=\"color\" value=\"{default_color}\"></label>
      <button type=\"submit\" class=\"btn\">Créer</button>
      {admin_return}
    </form>
    {rows}
    <h3 class=\"admin-subtitle\">Répartition thème × domaine</h3>
    {matrix}
  </section>",
        default_color = DEFAULT_THEME_COLORS[0],
        admin_return = ADMIN_RETURN,
        rows = if space.themes.is_empty() {
            "<p class=\"admin-empty\">Aucun thème — créez-en un ci-dessus.</p>".to_string()
        } else {
            format!("<ul class=\"admin-list\">{}</ul>", render_theme_rows(space))
        },
        matrix = render_matrix(space),
    );

    let domains_section = format!(
        "<section class=\"admin-section\" id=\"admin-domains\">
    <h2>Domaines</h2>
    <form method=\"post\" action=\"/api/domains\" class=\"admin-create\">
      <input name=\"name\" placeholder=\"Nom du domaine\" required autocomplete=\"off\" aria-label=\"Nom du nouveau domaine\">
      <button type=\"submit\" class=\"btn\">Créer</button>
      {admin_return}
    </form>
    {rows}
  </section>",
        admin_return = ADMIN_RETURN,
        rows = if space.domain_list.is_empty() {
            "<p class=\"admin-empty\">Aucun domaine — créez-en un ci-dessus.</p>".to_string()
        } else {
            format!(
                "<div class=\"admin-table-scroll\"><table class=\"admin-table\" id=\"admin-domains-table\">
            <thead><tr><th scope=\"col\">Nom</th><th scope=\"col\">URL</th><th scope=\"col\">Thèmes</th><th scope=\"col\">Actions</th></tr></thead>
            <tbody>{}</tbody>
          </table></div>",
                render_domain_rows(space)
            )
        },
    );

    let archives_section = format!(
        "<section class=\"admin-section\" id=\"admin-archives\">
    <h2>Archives</h2>
    <details class=\"admin-archives\">
      <summary>Domaines archivés ({count})</summary>
      {rows}
    </details>
  </section>",
        count = archives.len(),
        rows = if archives.is_empty() {
            "<p class=\"admin-empty\">Aucun domaine archivé.</p>".to_string()
        } else {
            format!(
                "<div class=\"admin-table-scroll\"><table class=\"admin-table\" id=\"admin-archives-table\">
              <thead><tr><th scope=\"col\">Domaine</th><th scope=\"col\">Thèmes</th><th scope=\"col\">Actions</th></tr></thead>
              <tbody>{}</tbody>
            </table></div>",
                render_archive_rows(space, archives)
            )
        },
    );

    let backup_section = format!(
        "<section class=\"admin-section\" id=\"admin-backup\">
    <h2>Sauvegarde</h2>
    {notice}
    <p class=\"admin-hint\">Le fichier JSON contient vos thèmes, vos domaines actifs et vos archives. Il ne contient ni votre adresse email ni vos passkeys.</p>
    <p class=\"admin-backup-export\"><a class=\"btn\" href=\"/api/backup\" download>Exporter mes données</a></p>
    <noscript><p class=\"admin-empty\">La restauration nécessite JavaScript ; l'export reste disponible sans JavaScript.</p></noscript>
    <details class=\"admin-restore\">
      <summary>Restaurer une sauvegarde</summary>
      <form id=\"restore-form\" method=\"post\" action=\"/api/restore?confirm=replace\">
        <label for=\"restore-file\">Fichier de sauvegarde (.json)</label>
        <input type=\"file\" id=\"restore-file\" name=\"backup\" accept=\".json,application/json\" required>
        <label class=\"restore-confirm\"><input type=\"checkbox\" id=\"restore-confirm\" required> Je comprends que mes thèmes, domaines et archives actuels seront remplacés par le contenu du fichier.</label>
        <button type=\"submit\" class=\"btn danger\" disabled>Remplacer mes données</button>
        <p id=\"restore-status\" role=\"status\"></p>
      </form>
    </details>
  </section>",
        notice = if restored {
            "<p class=\"admin-notice\" role=\"status\">Sauvegarde restaurée. Vos thèmes, domaines et archives ont été remplacés par le contenu du fichier.</p>"
        } else {
            ""
        }
    );

    render_shell(
        space,
        &format!(
            "<div class=\"admin\">{themes_section}{domains_section}{archives_section}{backup_section}</div>"
        ),
        None,
        &ShellOptions {
            title: Some("Administration".to_string()),
            admin: true,
            ..Default::default()
        },
    )
}

/* ------------------------------------------------------------------ */
/* Aide                                                                */
/* ------------------------------------------------------------------ */

pub fn render_guide_page(space: &Space, app_version: &str) -> String {
    let version = if app_version.is_empty() {
        "développement"
    } else {
        app_version
    };
    let content = format!(
        "<div class=\"guide\">
    <p class=\"guide-intro\">Cette page rassemble les gestes disponibles dans l'outline, du plus courant au plus spécifique.</p>

    <section class=\"guide-section\">
      <h2>Changer l'état d'une tâche</h2>
      <p>Le menu d'une ligne propose trois états : « En projet » pour une tâche non commencée, « En cours » pour une tâche engagée, et « Terminé » pour une tâche achevée. « En cours » se décline en deux sous-états — « À faire » et « En attente » — qui se choisissent depuis la page d'accueil, pas depuis le menu de la ligne. Une tâche « En attente » apparaît donc avec « En cours » actif dans le menu ; la choisir la ramène à « À faire ».</p>
    </section>

    <section class=\"guide-section\">
      <h2>Classer les tâches par rubrique GTD</h2>
      <p>La page d'accueil, à la racine, présente les deux sous-états d'« En cours » : « À faire » pour les tâches actionnables et « En attente » pour celles qui dépendent d'un tiers. Seules les tâches feuilles « À faire » ou « En attente » y figurent : une tâche « En projet » n'apparaît qu'après avoir été passée à « En cours » depuis son domaine, et les tâches terminées comme les lignes mères ne sont pas listées. Une tâche héritée « Un jour peut-être » est lue comme « En projet » et n'est donc pas listée.</p>
      <p>Glissez une carte d'une rubrique à l'autre, à la souris ou avec la poignée sur un écran tactile. Le menu « Changer de rubrique » de chaque carte fait la même chose au clavier. Cliquez sur le titre d'une carte pour ouvrir la tâche dans son domaine, avec ses tâches mères dépliées et la ligne mise en évidence.</p>
    </section>

    <section class=\"guide-section\">
      <h2>Ordonner les tâches de l'accueil</h2>
      <p>Dans chaque rubrique de la page d'accueil, glissez une carte au-dessus ou en dessous d'une autre pour la placer à cet endroit, à la souris comme avec la poignée sur un écran tactile. Les flèches ↑ et ↓ de chaque carte la déplacent d'un cran ; elles sont désactivées en première et en dernière position. Un dépôt dans l'autre rubrique place la carte à l'endroit déposé, tandis que le menu « Changer de rubrique » la place en fin de liste. L'ordre est mémorisé pour votre compte et conservé d'une visite à l'autre ; une nouvelle tâche rejoint la fin de sa rubrique.</p>
    </section>

    <section class=\"guide-section\">
      <h2>Garder le fil de la hiérarchie</h2>
      <p>En défilant, l'en-tête reste collé en haut de l'écran : il affiche le nom du domaine puis, sur les lignes suivantes, la chaîne des tâches mères de la première ligne visible. Cliquez sur une tâche de la chaîne pour y revenir.</p>
    </section>

    <section class=\"guide-section\">
      <h2>Sélectionner une ligne et ouvrir son menu</h2>
      <p>Survolez une ligne pour faire apparaître son bouton de sélection et son menu. Sur un écran étroit ou sur un appareil sans souris, le bouton de sélection reste visible sans survol.</p>
      <ul>
        <li>Un clic sélectionne la ligne et ses sous-lignes ; un second clic sur la tête ne sélectionne que celle-ci.</li>
        <li>Le menu et la sélection se ferment dès que le pointeur quitte la ligne.</li>
      </ul>
    </section>

    <section class=\"guide-section\">
      <h2>Replier ou déplier une ligne</h2>
      <p>Double-cliquez sur le bouton de sélection pour replier ou déplier la ligne et ses sous-lignes.</p>
    </section>

    <section class=\"guide-section\">
      <h2>Déplacer une ligne</h2>
      <ul>
        <li>Glissez depuis le bouton de sélection pour déplacer la ligne et ses sous-lignes.</li>
        <li>La ligne sélectionnée affiche une poignée à six points : faites-la glisser au doigt pour déplacer la ligne et ses sous-lignes.</li>
      </ul>
    </section>

    <section class=\"guide-section\">
      <h2>Renommer une ligne</h2>
      <p>Cliquez sur un titre hors lien pour ouvrir son édition, ou utilisez l'action ✎ (« Renommer ») du menu.</p>
    </section>

    <section class=\"guide-section\">
      <h2>Ajouter un projet</h2>
      <p>Le bouton + de l'en-tête d'une page de domaine ajoute un projet : la nouvelle ligne est insérée en tête de la liste, avant tous les autres projets et leurs sous-tâches, et son titre s'ouvre en édition avec « Nouveau projet » sélectionné pour le nommer directement. Le bouton reste dans l'en-tête pendant le défilement de la page.</p>
    </section>

    <section class=\"guide-section\">
      <h2>Ajouter une sous-tâche</h2>
      <p>L'action + du menu ajoute une sous-tâche sous la ligne et ouvre son titre pour la nommer.</p>
    </section>

    <section class=\"guide-section\">
      <h2>Lier des tâches</h2>
      <p>Copiez le lien d'une tâche depuis son menu (action 🔗), puis collez-le dans le titre d'une autre ligne : il devient un lien nommé. Cliquez sur ce lien pour ouvrir la ligne cible.</p>
    </section>

    <section class=\"guide-section\">
      <h2>Indenter et désindenter une ligne</h2>
      <p>Pendant l'édition d'un titre ou sur une ligne sélectionnée, <kbd>Tab</kbd> indente la ligne et <kbd>MAJ+Tab</kbd> la désindente.</p>
    </section>

    <section class=\"guide-section\">
      <h2>Rattacher un thème</h2>
      <p>Collez une étiquette sur le domaine pour le rattacher à un thème.</p>
    </section>

    <section class=\"guide-section\">
      <h2>Classer les domaines</h2>
      <p>Chaque domaine du panneau porte deux flèches ↑ et ↓ : elles le déplacent d'un cran dans la liste. Cet ordre est le même que celui de la page Administration et que celui des tâches en cours sur la page d'accueil.</p>
      <p>Les thèmes restent des étiquettes : ils ne regroupent plus les domaines du panneau.</p>
    </section>

    <section class=\"guide-section\">
      <h2>Gérer les thèmes et les domaines</h2>
      <p>Les thèmes et les domaines se gèrent depuis la page <a href=\"/administration\">Administration</a>, en pied du panneau.</p>
    </section>

    <section class=\"guide-section\">
      <h2>Sauvegarder et restaurer ses données</h2>
      <p>La section « Sauvegarde » de la page <a href=\"/administration\">Administration</a> permet de télécharger un fichier JSON contenant vos thèmes, vos domaines actifs et vos archives. Il ne contient ni votre adresse email ni vos passkeys : votre connexion n'est pas concernée.</p>
      <p>La restauration remplace l'intégralité de vos thèmes, de vos domaines et de vos archives par le contenu du fichier ; les objets absents du fichier sont supprimés. Exportez d'abord vos données actuelles si vous n'êtes pas sûr du fichier à restaurer.</p>
    </section>

    <p class=\"guide-version\">Version {version}</p>
  </div>",
        version = escape_html(version)
    );
    render_shell(
        space,
        &content,
        None,
        &ShellOptions {
            title: Some("Aide".to_string()),
            help: true,
            ..Default::default()
        },
    )
}

/* ------------------------------------------------------------------ */
/* Pages d'accès                                                       */
/* ------------------------------------------------------------------ */

fn alert(kind: &str, message: Option<&str>) -> String {
    match message.filter(|message| !message.is_empty()) {
        Some(message) => format!(
            "<p class=\"auth-alert {kind}\">{}</p>",
            escape_html(message)
        ),
        None => String::new(),
    }
}

fn auth_shell(title: &str, body: &str, scripts: &[&str]) -> String {
    let scripts = scripts
        .iter()
        .map(|src| format!("<script src=\"{src}\"></script>"))
        .collect::<String>();
    format!(
        "<!doctype html>
<html lang=\"fr\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <title>{title} — docdoc</title>
  {head}
  <link rel=\"stylesheet\" href=\"/style.css\">
</head>
<body class=\"auth-body\">
  <main class=\"auth-main\">
    <a class=\"auth-brand\" href=\"/\">docdoc</a>
    {body}
  </main>
  {scripts}
  <script src=\"/pwa.js\"></script>
</body>
</html>",
        title = escape_html(title),
        head = installability_head(),
        body = body,
        scripts = scripts,
    )
}

const CLIENT_SCRIPTS: [&str; 2] = ["/simplewebauthn.js", "/auth.js"];
const DEFAULT_SIGNUP_EMAIL: &str = "emmanuel.grandiere@laposte.net";

pub fn render_auth_home(notice: Option<&str>, error: Option<&str>) -> String {
    auth_shell(
        "Accès",
        &format!(
            "<section class=\"auth-card\">
      <h2>Aucun espace docdoc n'est associé à ce navigateur</h2>
      <p>Créez votre espace de travail, ou connectez-vous avec une passkey déjà enregistrée.</p>
      {error}
      {notice}
      <div class=\"auth-actions\">
        <a class=\"btn primary\" href=\"/auth/signup\">Créer un compte</a>
        <button type=\"button\" class=\"btn\" id=\"signin-btn\">Se connecter</button>
      </div>
      <p class=\"auth-note\" id=\"auth-status\" role=\"status\"></p>
    </section>",
            error = alert("error", error),
            notice = alert("notice", notice),
        ),
        &CLIENT_SCRIPTS,
    )
}

pub fn render_email_form(value: Option<&str>, error: Option<&str>) -> String {
    let value = value.unwrap_or(DEFAULT_SIGNUP_EMAIL);
    auth_shell(
        "Créer un compte",
        &format!(
            "<form method=\"post\" action=\"/auth/email\" class=\"auth-card\">
      <h2>Créer un compte</h2>
      <p>Indiquez votre adresse email : docdoc y enverra un code d'accès à usage unique.</p>
      {error}
      <label for=\"email\">Adresse email</label>
      <input id=\"email\" name=\"email\" type=\"email\" required autocomplete=\"email\" autofocus value=\"{value}\">
      <button class=\"btn primary\" type=\"submit\">Recevoir un code</button>
      <a class=\"auth-link\" href=\"/\">Retour</a>
    </form>",
            error = alert("error", error),
            value = escape_html(value),
        ),
        &[],
    )
}

pub fn render_code_form(
    email: &str,
    delivery: &str,
    notice: Option<&str>,
    error: Option<&str>,
) -> String {
    let where_message = if delivery == "log" {
        "Le code n'est pas envoyé par email (mode développement) : il est écrit dans les
         journaux du serveur, sous la forme <code>[docdoc][dev] code pour … : 123456</code>."
            .to_string()
    } else {
        format!(
            "Un code à 6 chiffres a été envoyé à <strong>{}</strong>. Il ne peut être utilisé qu'une fois.",
            escape_html(email)
        )
    };
    auth_shell(
        "Saisir le code",
        &format!(
            "<form method=\"post\" action=\"/auth/email/verify\" class=\"auth-card\">
      <h2>Saisir le code</h2>
      <p>{where_message}</p>
      {error}
      {notice}
      <label for=\"code\">Code</label>
      <input id=\"code\" name=\"code\" type=\"text\" inputmode=\"numeric\" pattern=\"[0-9]{{6}}\" maxlength=\"6\" required autofocus autocomplete=\"one-time-code\">
      <button class=\"btn primary\" type=\"submit\">Valider</button>
    </form>
    <form method=\"post\" action=\"/auth/email/resend\" class=\"auth-card auth-secondary\">
      <button class=\"btn link\" type=\"submit\">Renvoyer un nouveau code</button>
    </form>
    <form method=\"post\" action=\"/auth/cancel\" class=\"auth-card auth-secondary\">
      <button class=\"btn link\" type=\"submit\">Utiliser une autre adresse</button>
    </form>",
            where_message = where_message,
            error = alert("error", error),
            notice = alert("notice", notice),
        ),
        &[],
    )
}

pub fn render_passkey_enrollment(error: Option<&str>) -> String {
    auth_shell(
        "Enregistrer une passkey",
        &format!(
            "<section class=\"auth-card\">
      <h2>Enregistrer une passkey</h2>
      <p>Votre adresse est vérifiée. Enregistrez maintenant une passkey : elle remplacera le code
         pour toutes vos prochaines connexions.</p>
      {error}
      <button type=\"button\" class=\"btn primary\" id=\"register-passkey-btn\">Enregistrer une passkey</button>
      <p class=\"auth-note\" id=\"auth-status\" role=\"status\"></p>
    </section>",
            error = alert("error", error),
        ),
        &CLIENT_SCRIPTS,
    )
}

fn format_date(value: &str) -> String {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|date| date.format("%d/%m/%Y").to_string())
        .unwrap_or_default()
}

fn passkey_row(passkey: &crate::accounts::Passkey) -> String {
    let id = escape_html(&passkey.id);
    let created = format_date(&passkey.created_at);
    let used = if passkey.last_used_at.is_some() {
        format_date(passkey.last_used_at.as_deref().unwrap_or(""))
    } else {
        "jamais".to_string()
    };
    let backup = if passkey.backed_up {
        "synchronisée"
    } else {
        "liée à cet appareil"
    };
    format!(
        "<li class=\"passkey-row\">
      <div class=\"passkey-info\">
        <form method=\"post\" action=\"/auth/passkeys/rename\" class=\"inline-form passkey-rename\">
          <input type=\"hidden\" name=\"credentialId\" value=\"{id}\">
          <input name=\"label\" value=\"{label}\" maxlength=\"60\" aria-label=\"Nom de la passkey\">
          <button class=\"btn-mini\" type=\"submit\" title=\"Renommer\">✏️</button>
        </form>
        <span class=\"passkey-meta\">{backup} · créée le {created} · dernière utilisation : {used}</span>
      </div>
      <form method=\"post\" action=\"/auth/passkeys/revoke\" class=\"inline-form\" onsubmit=\"return confirm('Révoquer cette passkey ?');\">
        <input type=\"hidden\" name=\"credentialId\" value=\"{id}\">
        <button class=\"btn-mini danger\" type=\"submit\" title=\"Révoquer\">🗑</button>
      </form>
    </li>",
        id = id,
        label = escape_html(&passkey.label),
        backup = backup,
        created = escape_html(&created),
        used = escape_html(&used),
    )
}

pub fn render_passkeys(account: &Account, notice: Option<&str>, error: Option<&str>) -> String {
    let rows = if account.passkeys.is_empty() {
        "<p class=\"auth-note\">Aucune passkey enregistrée.</p>".to_string()
    } else {
        format!(
            "<ul class=\"passkey-list\">{}</ul>",
            account.passkeys.iter().map(passkey_row).collect::<String>()
        )
    };
    auth_shell(
        "Mes passkeys",
        &format!(
            "<section class=\"auth-card auth-wide\">
      <h2>Mes passkeys</h2>
      <p>Compte : <strong>{email}</strong></p>
      {error}
      {notice}
      {rows}
      <div class=\"auth-actions\">
        <button type=\"button\" class=\"btn primary\" id=\"register-passkey-btn\">Ajouter une passkey</button>
        <a class=\"btn\" href=\"/\">Retour à mes projets</a>
      </div>
      <p class=\"auth-note\" id=\"auth-status\" role=\"status\"></p>
      <p class=\"auth-note\">Si vous perdez tous vos appareils, la page d'accueil permet de recevoir un
         nouveau code par email et d'enregistrer une passkey de remplacement.</p>
    </section>",
            email = escape_html(&account.email),
            error = alert("error", error),
            notice = alert("notice", notice),
            rows = rows,
        ),
        &CLIENT_SCRIPTS,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escaping_is_complete() {
        assert_eq!(
            escape_html("<a href=\"x\">'&</a>"),
            "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&lt;/a&gt;"
        );
    }

    #[test]
    fn title_links_are_rendered_and_labelled() {
        let title = "Voir [la voiture](/domaine/voiture?reveal=abc-1#node-abc-1) maintenant";
        let html = render_title_html(title);
        assert!(html.contains("class=\"title-link\""));
        assert!(html.contains("href=\"/domaine/voiture?reveal=abc-1#node-abc-1\""));
        assert!(html.contains(">la voiture</a>"));
        assert_eq!(title_label(title), "Voir la voiture maintenant");
    }

    #[test]
    fn invalid_task_links_stay_text() {
        let title = "[lien](/domaine/x?reveal=a#node-b) et [autre](https://x)";
        let html = render_title_html(title);
        assert!(!html.contains("title-link"));
        assert!(html.contains("[lien](/domaine/x?reveal=a#node-b)"));
        assert!(html.contains("[autre](https://x)"));
    }

    #[test]
    fn confirm_submit_escapes_the_message() {
        let attribute = confirm_submit("Purger « a \"b\" » ?");
        assert!(attribute.starts_with("onsubmit=\"return confirm("));
        assert!(attribute.contains("&quot;"));
    }

    #[test]
    fn status_menu_offers_three_states_and_marks_en_cours_for_waiting() {
        use crate::model::IndexEntry;
        let entry = IndexEntry {
            parent: None,
            depth: 0,
            title: "Tâche".to_string(),
            status: "waiting".to_string(),
            collapsed: false,
            has_children: false,
        };
        let html = render_line(&entry, "n1", "maison", false);
        assert!(html.contains("title=\"En projet\""));
        assert!(html.contains("title=\"En cours\""));
        assert!(html.contains("title=\"Terminé\""));
        assert!(!html.contains("title=\"En attente\""));
        assert!(!html.contains("Un jour peut-être"));
        // Three status actions plus the six structural actions.
        assert_eq!(html.matches("class=\"menu-item").count(), 9);
        // A waiting line is shown as the "En cours" project state.
        assert!(html.contains("class=\"menu-item active\""));
        assert!(html.contains("status-waiting"));
    }

    #[test]
    fn home_board_groups_leaves_and_skips_parents_and_done() {
        use crate::model::{Domain, DomainSummary, Node};
        use crate::space::Space;
        use std::collections::HashMap;

        fn node(id: &str, title: &str, status: &str, children: Vec<Node>) -> Node {
            Node {
                id: id.to_string(),
                title: title.to_string(),
                status: status.to_string(),
                collapsed: false,
                children,
                extra: serde_json::Map::new(),
            }
        }

        let projects = vec![
            node(
                "a1",
                "Projet parent",
                "in_progress",
                vec![node("a1-1", "Tâche en cours 1", "in_progress", Vec::new())],
            ),
            node("a2", "Tâche en attente <b>", "waiting", Vec::new()),
            node("a5", "Tâche à faire 2", "todo", Vec::new()),
            node("a3", "Tâche un jour", "someday", Vec::new()),
            node("a4", "Tâche terminée", "done", Vec::new()),
            node("a6", "Tâche en cours 2", "in_progress", Vec::new()),
        ];
        let domain = Domain {
            id: "d1".to_string(),
            name: "Maison".to_string(),
            slug: "maison".to_string(),
            order: 0.0,
            labels: Vec::new(),
            projects,
            display_order: vec![
                "a1".to_string(),
                "a1-1".to_string(),
                "a2".to_string(),
                "a5".to_string(),
                "a3".to_string(),
                "a4".to_string(),
                "a6".to_string(),
            ],
        };
        let summary = DomainSummary {
            id: domain.id.clone(),
            name: domain.name.clone(),
            slug: domain.slug.clone(),
            order: 0.0,
            labels: Vec::new(),
        };
        let mut domains = HashMap::new();
        domains.insert(domain.id.clone(), domain);
        let space = Space {
            user_id: "u".to_string(),
            email: "u@example.test".to_string(),
            domains,
            domain_list: vec![summary],
            themes: Vec::new(),
            home_order: Default::default(),
        };

        let html = render_home_board(&space);
        assert!(html.contains("id=\"home-board\""));
        assert!(html.contains("class=\"gtd-group-title\">En cours</h2>"));
        assert!(html.contains("data-gtd=\"in_progress\""));
        assert!(html.contains("data-gtd=\"waiting\""));
        assert!(!html.contains("data-gtd=\"someday\""));
        assert!(html.contains("id=\"gtd-node-a1-1\""));
        assert!(html.contains("id=\"gtd-node-a2\""));
        assert!(!html.contains("id=\"gtd-node-a3\""));
        assert!(html.contains("id=\"gtd-node-a6\""));
        // The parent, the done line, the todo line and the legacy someday line
        // never become cards.
        assert!(!html.contains("id=\"gtd-node-a1\""));
        assert!(!html.contains("id=\"gtd-node-a4\""));
        assert!(!html.contains("id=\"gtd-node-a5\""));
        // The removed badge is no longer rendered.
        assert!(!html.contains("gtd-badge"));
        // The title is escaped and the rubrique menu is present.
        assert!(html.contains("Tâche en attente &lt;b&gt;"));
        assert!(html.contains("gtd-move-menu"));
        // The two in-progress leaves keep the outline order.
        let first = html.find("Tâche en cours 1").unwrap();
        let second = html.find("Tâche en cours 2").unwrap();
        assert!(first < second);
        // Counts are rendered per rubrique.
        assert!(html.contains("<span class=\"gtd-count\">2</span>"));
    }

    #[test]
    fn home_board_applies_the_manual_order_and_renders_order_controls() {
        use crate::model::{Domain, DomainSummary, Node};
        use crate::space::{HomeOrder, Space};
        use std::collections::HashMap;

        fn node(id: &str, title: &str) -> Node {
            Node {
                id: id.to_string(),
                title: title.to_string(),
                status: "in_progress".to_string(),
                collapsed: false,
                children: Vec::new(),
                extra: serde_json::Map::new(),
            }
        }

        let domain = Domain {
            id: "d1".to_string(),
            name: "Maison".to_string(),
            slug: "maison".to_string(),
            order: 0.0,
            labels: Vec::new(),
            projects: vec![node("a1", "A1"), node("a2", "A2"), node("a3", "A3")],
            display_order: vec!["a1".to_string(), "a2".to_string(), "a3".to_string()],
        };
        let summary = DomainSummary {
            id: domain.id.clone(),
            name: domain.name.clone(),
            slug: domain.slug.clone(),
            order: 0.0,
            labels: Vec::new(),
        };
        let mut domains = HashMap::new();
        domains.insert(domain.id.clone(), domain);
        let mut space = Space {
            user_id: "u".to_string(),
            email: "u@example.test".to_string(),
            domains,
            domain_list: vec![summary],
            themes: Vec::new(),
            home_order: HomeOrder {
                in_progress: vec!["a3".to_string(), "inconnu".to_string(), "a1".to_string()],
                waiting: Vec::new(),
            },
        };

        let html = render_home_board(&space);
        let a3 = html.find("id=\"gtd-node-a3\"").unwrap();
        let a1 = html.find("id=\"gtd-node-a1\"").unwrap();
        let a2 = html.find("id=\"gtd-node-a2\"").unwrap();
        assert!(a3 < a1 && a1 < a2, "ordinateur manuel non appliqué");

        let domain = &space.domains["d1"];
        let first = home_task_card(domain, &domain.projects[0], &[], "in_progress", 0, 3);
        let middle = home_task_card(domain, &domain.projects[1], &[], "in_progress", 1, 3);
        let last = home_task_card(domain, &domain.projects[2], &[], "in_progress", 2, 3);
        // Position 0 disables only "up"; the last position disables only "down".
        assert!(first.contains("disabled>↑"));
        assert!(!first.contains("disabled>↓"));
        assert!(first.contains("&quot;index&quot;:1"));
        assert!(!middle.contains("disabled>↑"));
        assert!(!middle.contains("disabled>↓"));
        assert!(middle.contains("&quot;index&quot;:0"));
        assert!(middle.contains("&quot;index&quot;:2"));
        assert!(last.contains("disabled>↓"));
        assert!(!last.contains("disabled>↑"));
        // The arrows name the task, and the rubrique menu uses the new route.
        assert!(first.contains("aria-label=\"Monter « A1 »\""));
        assert!(first.contains("aria-label=\"Descendre « A1 »\""));
        assert!(first.contains("hx-post=\"/api/home/order\""));
        assert!(first.contains("&quot;rubrique&quot;:&quot;waiting&quot;"));

        // A malformed or absent order keeps the natural order.
        space.home_order = HomeOrder::default();
        let natural = render_home_board(&space);
        let a1 = natural.find("id=\"gtd-node-a1\"").unwrap();
        let a2 = natural.find("id=\"gtd-node-a2\"").unwrap();
        let a3 = natural.find("id=\"gtd-node-a3\"").unwrap();
        assert!(a1 < a2 && a2 < a3);
    }
}
