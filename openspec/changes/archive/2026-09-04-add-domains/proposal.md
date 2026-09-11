## Why

Aujourd'hui l'outlineur de gestion de projets perso est à un seul niveau : tous les projets (maison, voitures, voyages) sont les racines d'une unique page et d'un unique fichier `data/projects.json`. Pour un gestionnaire qui couvre plusieurs domaines de vie, il faut regrouper les projets par domaine, donner à chaque domaine sa propre page accessible par une URL directe, et ne stocker qu'un domaine par fichier JSON — afin de naviguer et s'organiser par domaine sans tout mélanger sur une seule page.

## What Changes

- Introduit le concept de **domaine** : un domaine regroupe plusieurs projets ; chaque projet conserve ses tâches/sous-tâches (le modèle de nœud `{id, title, status, collapsed, children}` reste identique).
- Chaque domaine est **persisté dans son propre fichier JSON auto-décrit** `data/<id>.json` au format `{ id, name, slug, order, projects[] }` ; un fichier ne porte les données que d'un seul domaine.
- La liste des domaines est **énumérée en scannant** `data/*.json` (les fichiers `.tmp`/`.bak` et les JSON invalides sont ignorés, self-healing).
- Ajoute une **page par domaine**, accessible par une **URL directe** `GET /domaine/:slug` (slug généré depuis le nom : minuscules, accents retirés, espaces → `-`, dédupliqué). L'accueil `/` redirige (`302`) vers le domaine d'ordre le plus bas.
- Ajoute un **panneau latéral gauche repliable** listant les domaines — déplié par défaut, état persisté en `localStorage` — avec un bouton « + Nouveau domaine ».
- Ajoute la **gestion des domaines** : créer ; renommer (régénère le slug, l'ancienne URL renvoie 404) ; supprimer (**archivage** dans `data/archive/<slug>.json` plutôt que perte définitive).
- **Scope toutes les opérations de nœuds** (créer, renommer, réindenter, supprimer, déplacer, statut, replier/déplier) sur le **domaine actif** : les routes passent sous `/domaine/:slug/...` et le domaine est résolu depuis le chemin.
- **Migration** : au premier lancement, l'ancien `data/projects.json` est enveloppé en un domaine « Projets » (le fichier d'origine est renommé `projects.json.bak`, jamais supprimé). Sur base neuve, un domaine « Projets » avec l'outline d'exemple est semé.

## Capabilities

### New Capabilities
- `domain-storage`: Persiste chaque domaine dans son propre fichier JSON auto-décrit, énumère les domaines en scannant le dossier, écrit de façon atomique par fichier et migre l'ancienne structure mono-fichier.
- `domain-navigation`: Sert une page par domaine via une URL directe `/domaine/:slug`, génère/résout le slug, redirige l'accueil vers le domaine par défaut et affiche un panneau latéral gauche repliable listant les domaines.
- `domain-management`: Gère le cycle de vie d'un domaine — créer, renommer (slugs régénérés, ancienne URL → 404), supprimer (archivage réversible) — depuis le panneau latéral.

### Modified Capabilities
- `project-storage`: La persistance de l'outline est désormais **par domaine** (le tableau `projects` d'un domaine vit dans son fichier), et non plus dans un unique fichier global.
- `project-outliner`: L'outline est rendu **sur la page du domaine actif** (niveau 1 = les projets de ce domaine), et non plus pour une page unique.
- `node-management`: Les opérations de nœuds (créer, renommer, réindenter, supprimer, déplacer) sont **scopées au domaine actif**.
- `node-status-tracking`: L'application d'un statut est **scopée au domaine actif** (l'outline ciblé est celui du domaine courant).

## Impact

- **Backend (`server.js`)**: remplacement de l'`outline` global par un ensemble de domaines chargés (clé = id), résolution du domaine actif depuis `/domaine/:slug`, généralisation des helpers d'arbre (`findNode`, `createNode`, `moveNode`, …) pour opérer sur le `projects` d'un domaine, et `atomicWrite(file, data)` par fichier (garde la queue de sérialisation existante).
- **Routes**: nouvelles routes `/domaine/:slug`, `/domaine/:slug/outline-fragment`, `/domaine/:slug/api/outline`, et `/domaine/:slug/api/nodes*` ; `/` devient une redirection vers le domaine par défaut.
- **Nouveau dossier**: `data/archive/` (domaines supprimés) ; `data/projects.json` migré vers un domaine « Projets » (`.bak` conservé).
- **Frontend** (`public/style.css`, `public/app.js`): coquille en grille `sidebar | content`, panneau latéral repliable persisté, mise en surbrillance du domaine actif, et bouton « + Nouveau domaine ».
- **Format de données**: le payload n'est plus un tableau nu mais un objet `{ id, name, slug, order, projects }` ; le modèle de nœud est inchangé.
- **Aucune nouvelle dépendance externe** (Express + htmx suffisent).
