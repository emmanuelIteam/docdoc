## Context

L'application est un outlineur serveur-rendu (Express + htmx). Depuis `add-domains`, les projets sont regroupés dans des **domaines**, chacun persisté dans son propre fichier `data/<id>.json` (`{ id, name, slug, order, projects[] }`), listé dans un panneau latéral gauche, avec une URL directe `/domaine/:slug`. Le modèle de nœud du projet n'a pas changé.

Le besoin est un regroupement *transverse* au-dessus des domaines : un **thème**. Un thème fédère plusieurs domaines, et un domaine peut appartenir à plusieurs thèmes. Le lien se fait en **collant une étiquette** (thème) sur le domaine. On a choisi un modèle **léger** : le thème est une étiquette `{ id, name, color }` dans une **palette unique** (`data/themes.json`), sans page dédiée, sans slug, sans sous-dossier. La navigation latérale devient à deux niveaux (thèmes → domaines) avec une section « Sans thème ».

## Goals / Non-Goals

**Goals**
- Permettre de créer/renommer/supprimer un thème léger (nom + couleur) dans une palette unique.
- Attacher/détacher un thème à un domaine via son `labels` (plusieurs thèmes par domaine), sans casser le modèle projet/nœud ni l'URL `/domaine/:slug`.
- Afficher le panneau latéral groupé par thème, chaque domaine apparaissant sous chacun de ses thèmes, et une section « Sans thème » pour les domaines non étiquetés.
- Garantir l'intégrité référentielle : la suppression d'un thème retire son id de tous les domaines.
- Migrer sans perte : les fichiers de domaines existants (sans `labels`) restent valides.

**Non-Goals**
- Ne crée **pas** de page par thème (`/theme/:slug`), ni de slug/ordre/état replié par thème.
- Ne change pas le modèle de nœud (`{id, title, status, collapsed, children}`).
- Ne touche pas aux routes, ni à la logique d'édition, d'état, de déplacement ou de repli des nœuds/projets d'un domaine.
- N'introduit pas de nouvelle dépendance.

## Decisions

### D1 — Thème = étiquette légère dans une palette unique (`themes.json`)
Le thème est un objet `{ id, name, color }` stocké dans un tableau dans `data/themes.json`. Pas de fichier par thème, pas de slug, pas de page.
- *Pourquoi* : symétrie de coût faible vs. le besoin réel (un libellé pour grouper), et on évite la mécanique slug/dédup/page déjà portée par les domaines.
- *Alternatives rejetées* : thème comme objet de 1ʳᵉ classe avec slug/page/fichier (sur-dimensionné) ; étiquettes libres par domaine groupées par nom (couleur incohérente, pas de registre).
- L'ordre d'affichage des thèmes = ordre d'insertion dans la palette (pas de champ `order`, pour rester léger).

### D2 — Le lien domaine↔thème vit dans `labels: [themeId]` sur le domaine
Chaque domaine porte `labels` (tableau d'ids de thèmes) persisté dans son fichier. Coller/détacher = ajouter/retirer un `themeId`.
- *Pourquoi* : le connecteur est porté par la donnée déjà « source de vérité » du domaine ; pas de table de jointure séparée, pas d'état dénormalisé à maintenir.
- *Adresse* : la relation est M:N (un domaine peut porter plusieurs thèmes, un thème peut être sur plusieurs domaines).
- *Alternatives rejetées* : champ `parent` sur le domaine (impossible en M:N) ; fichier de jointure global (sur-ingénierie pour une petite app locale).

### D3 — Groupement du panneau calculé à la volée depuis la palette + `labels`
Le panneau ne stocke aucun état de groupement : au rendu, on itère la palette (bandeau par thème avec pastille couleur) et on y regroupe les domaines dont `labels` contient l'id, puis une section « Sans thème » pour les domaines sans étiquette. Le domaine actif est surligné là où il apparaît.
- *Pourquoi* : conservation d'une seule source de vérité, pas de dérive après ajout/retrait d'étiquette.
- *Influence* : `renderSidebar` regroupe à partir de `domains` + `themes` plutôt que de la liste plate `domainList`.

### D4 — Intégrité référentielle : suppression de thème → pruning dans tous les domaines
Supprimer un thème le retire de la palette **et** de `labels` de chaque domaine qui le porte (chaque domaine concerné est persisté atomiquement via `persistDomain`).
- *Défense en profondeur* : au chargement d'un domaine, `normalizeDomain` filtre `labels` aux ids de thèmes connus, et au rendu on ignore les ids sans thème résolu — un id orphelin (édition manuelle du fichier) ne casse rien.

### D5 — Interface
- **Panneau latéral** : en-têtes de thèmes (pastille couleur + nom, édition du nom inline, ✕ pour supprimer) avec les domaines rattachés en dessous ; section « Sans thème » ; contrôles « + Nouveau thème » (nom + couleur) et « + Nouveau domaine » en pied.
- **Page domaine** : zone « Étiquettes » dans la barre d'actions — pastilles des thèmes courants (détachables) + « + » ouvrant un sélecteur de thèmes de la palette (avec création inline). Les pastilles utilisent la couleur du thème.

### D6 — Données & points d'intégration backend
- `normalizeDomain` : ajoute `labels: Array.isArray(raw.labels) ? raw.labels.filter(isKnownTheme) : []`.
- `persistDomain` : ajoute `labels` au payload.
- Nouvel état `themes` (Map/tableau) + `loadThemes()` (lit `data/themes.json`, palette vide si absent/invalide) + `persistThemes()` (écriture atomique sérialisée sur la même `writeQueue`).
- `loadDomains` : exclure explicitement `themes.json` de l'énumération des fichiers de domaines.
- **Routes** : `GET /api/themes`, `POST /api/themes` (créer, rejet si nom dupliqué), `POST /api/themes/:id/rename` (nom+couleur), `POST /api/themes/:id/delete` (palette + pruning), et `POST /domaine/:slug/api/labels` (attacher/détacher, rejet si thème inconnu).
- La couleur d'un nouveau thème a une valeur par défaut (palette rotative de couleurs prédéfinies).

## Risks / Trade-offs

- **Ids orphelins** (thème absent mais référencé dans un `labels`) → filtré au chargement dans `normalizeDomain` et ignoré au rendu ; la suppression de thème fait déjà le pruning.
- **Fan-out d'écritures à la suppression d'un thème** (plusieurs fichiers domaines) → petit volume local, écritures sérialisées par `writeQueue` (même mécanisme que l'existant), écriture atomique par fichier.
- **Couleur non-contrastée / choix de couleur** → palette prescrite + input couleur ; les pastilles utilisent la couleur du thème avec un libellé texte, pas seulement la couleur.
- **Regroupement recalculé à chaque rendu** → trivial à cette échelle (domaines + thèmes en mémoire).
- **Enregistrer le `themes.json` avec les fichiers de domaines** → énumération de domaines exclut explicitement `themes.json`.

## Migration Plan

1. Au démarrage, `loadThemes()` : `data/themes.json` absent → palette vide ; invalide → vide.
2. `normalizeDomain` garantit `labels: []` pour tout fichier de domaine existant (aucune donnée perdue ; les domaines migrent sous « Sans thème »).
3. Aucun changement de format du reste du fichier de domaine ni du modèle de nœud.
4. Rollback : restaurer la version de `server.js` précédente ; les fichiers de domaines avec `labels` sont ignorés par l'ancien code (champ inconnu), `themes.json` est simplement non lu.

## Open Questions

- Faut-il semer 1-2 thèmes d'exemple au premier lancement (démo) ou laisser une palette vide ?
- La couleur doit-elle être indépendamment modifiable du nom, ou modifiée conjointement (même formulaire) ?
- Le tri des domaines *dans* un groupe de thèmes doit-il suivre l'ordre général des domaines (`order`, puis nom) ou un ordre propre ?
