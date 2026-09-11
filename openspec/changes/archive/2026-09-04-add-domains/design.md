## Context

L'app est un outliner de gestion de projets perso (Express + htmx) qui rend aujourd'hui une page unique « Mes projets » à partir d'un seul tableau en mémoire `outline` et d'un unique fichier `data/projects.json`. Le modèle de nœud est `{ id, title, status, collapsed, children[] }` (status ∈ `todo | in_progress | done`). Le besoin est de regrouper les projets par **domaine**, de servir **une page par domaine** accessible par **URL directe**, et de ne stocker **qu'un domaine par fichier JSON** — sans casser le modèle de nœud ni la logique d'arbre existante.

Aucune nouvelle dépendance (Express + htmx suffisent). Aucun changement de schéma de nœud.

## Goals / Non-Goals

**Goals:**
- Introduire le concept de domaine (domaine → projet → tâche) sans modifier le modèle de nœud.
- Persister chaque domaine dans son propre fichier JSON auto-décrit (`{ id, name, slug, order, projects[] }`), un seul fichier ne portant qu'un domaine.
- Énumérer les domaines en scannant `data/*.json` (ignore `.tmp`, `.bak`, JSON invalide).
- Servir une page par domaine via `GET /domaine/:slug`, avec slug généré depuis le nom, et rediriger `/` (302) vers le domaine d'ordre le plus bas.
- Scoper toutes les opérations de nœuds sur le domaine actif (routes sous `/domaine/:slug/...`).
- Afficher un panneau latéral gauche repliable listant les domaines (déplié par défaut, état persisté en localStorage).
- Gérer les domaines depuis la sidebar : créer, renommer (slug régénéré, ancienne URL → 404), supprimer (archivage dans `data/archive/`).
- Migrer l'ancien `projects.json` en un domaine « Projets » non destructivement (`.bak` conservé).

**Non-Goals:**
- Déplacer un projet entre domaines (capacité dédiée ultérieure).
- Agrégation/dashboard multi-domaines ou recherche transversale.
- Multi-utilisateur (l'auth Google est un changement séparé, `google-oidc-auth`).
- Modifier le modèle de nœud, les statuts, ou la logique de déplacement intra-arbre.

## Decisions

**Decision 1: fichier auto-décrit par domaine + énumération par scan (pas de registre).**
Chaque `data/<id>.json` = `{ id, name, slug, order, projects[] }`. On scanne le dossier pour lister les domaines ; un fichier invalide ou un `.tmp`/`.bak` est ignoré.
- *Why* : une seule source de vérité, fidèle à « un fichier ne porte qu'un domaine », self-healing (pas d'index à synchroniser, pas d'orphelins).
- *Alternatives* : registre `domains.json` (contrôle explicite de l'ordre et du nom, mais 2 sources et index à garder cohérents) — écarté pour la simplicité et la fidélité à la contrainte.

**Decision 2: `id` (uuid) comme clé interne et nom de fichier ; `slug` comme URL.**
Le nom de fichier ne change jamais (id stable) ; le renommage ne touche que le contenu du fichier (`name` + `slug` régénéré). L'URL est nommée via le slug.
- *Why* : découple le renommage du fichier physique (pas d'atomicité multi-fichiers) et respecte « page portant le nom du domaine ».
- *Alternatives* : utiliser l'id dans l'URL (stable mais pas nommé) ; utiliser le nom de fichier comme slug (lierait renommage et déplacement de fichier) — écartés.

**Decision 3: routes imbriquées `/domaine/:slug/...` plutôt que `/api/nodes/:id` + domaine en header/champ.**
Le domaine actif est résolu depuis le chemin (`req.params.slug`) ; les attributs htmx sont rendus par le serveur qui connaît déjà le slug, donc zéro état à transporter côté client.
- *Why* : cohérent avec l'« URL directe », explicite, et évite de devoir localiser le domaine d'un nœud à chaque mutation.
- *Alternatives* : garder `/api/nodes/:id` à plat et retrouver le domaine par l'id du nœud (uuid globaux) — plus court mais moins explicite et nécessite un scan ; écarté.

**Decision 4: helpers d'arbre paramétrés par le tableau `projects` du domaine.**
`findNode`, `createNode`, `deleteNode`, `reindentNode`, `moveNode`, `setStatus`, `toggleCollapse` opèrent sur le `projects` du domaine actif plutôt que sur l'`outline` global.
- *Why* : réutilise telle quelle la logique d'arbre (ajouts/suppressions/réindentation/déplacement/cycles) et le modèle de nœud.
- *Alternatives* : dupliquer la logique par domaine (écarté, redondant) ; passer par des closures capturant le domaine (possible mais plus de surface).

**Decision 5: persistance par fichier gardant le pattern atomique + queue de sérialisation.**
On généralise `atomicWrite(file, data)` (temp + rename) et on conserve une queue globale pour sérialiser les écritures.
- *Why* : hérite de la garantie anti-corruption actuelle ; le renommage n'écrivant qu'un fichier, pas de problème d'atomicité multi-fichiers.
- *Alternatives* : une queue par domaine (plus isolée mais inutile ici) — écarté ; écriture directe (écarté, corruption possible).

**Decision 6: slug normalisé + dédupliqué ; pas d'historique de slugs.**
`lowercase → strip accents (NFD) → remplace tout non-alphanum par '-' → collapse → trim → déduplique (maison, maison-2)`. Au renommage le slug est régénéré et l'ancienne URL renvoie 404.
- *Why* : nom d'URL stable et lisible ; le choix utilisateur (pas d'historique) garde le modèle simple.
- *Alternatives* : `slugHistory:[]` pour rediriger les anciennes URL (écarté, retenu par l'utilisateur).

**Decision 7: coquille en grille avec panneau latéral repliable, persistance côté client.**
`body > .shell { display:grid; grid-template-columns:auto 1fr }` ; `body.sidebar-collapsed` → `0 1fr`. Le ☰ bascule la classe ; l'état est persisté en `localStorage` et ré-appliqué au chargement. La sidebar fait partie de la coquille rendue par `renderPage()` et n'est **jamais** ré-rendue par htmx (seul `#outline` dans `<main>` est swappé).
- *Why* : la coquille est identique à chaque navigation ; l'état replié survit d'une page à l'autre côté client.
- *Alternatives* : sidebar rendue côté serveur avec état dans l'URL (artificiel, écarté) ; jamais repliable (écarté, la contrainte l'exige).

**Decision 8: migration M1 non destructive.**
Au premier lancement, si `data/projects.json` existe et est un tableau nu, on l'enveloppe en un domaine « Projets » (`projects` = ces racines) puis on renomme l'original en `.bak`. Si aucun fichier n'existe, on sème un domaine « Projets » avec l'outline d'exemple.
- *Why* : zéro perte, zéro saisie ; l'utilisateur réorganise ensuite.
- *Alternatives* : split auto par mots-clés (fragile, écarté) ; migration manuelle (effort, écarté).

## Risks / Trade-offs

- **[Renommage casse l'URL ; ancienne URL → 404]** → Choix assumé (pas d'historique) ; les favoris pointent vers l'id ? Non, vers le slug — l'utilisateur devra mettre à jour les liens. Acceptable pour un outil perso.
- **[Fichier de domaine supprimé/corrompu à la main]** → Le scan ignore les fichiers invalides (self-healing) ; la suppression passe par l'archivage ; conseiller de sauvegarder `data/`.
- **[Écritures concurrentes sur plusieurs fichiers]** → Queue mondiale de sérialisation + écritures atomiques par fichier ; coût négligeable.
- **[Migration si l'utilisateur a déjà créé des domaines + un vieux `projects.json`]** → Ne migrer le legacy que s'il n'existe aucun domaine ; sinon ignorer le legacy (éviter de créer un domaine « Projets » en double).
- **[Collision de slugs / accents]** → Normalisation NFD + déduplication (`-2`, `-3`).
- **[Sidebar vs confinement htmx]** → La sidebar n'est pas dans la zone swap ; les mutations (nœuds) ne changent pas la liste des domaines, donc pas de désynchronisation.
- **[Intégration `google-oidc-auth`]** → Les pages `/domaine/*` et la sidebar tomberont derrière l'auth ; à combiner dans un ordre cohérent (l'auth protège les routes, les domaines s'appuient dessus).
- **[Base sans aucun domaine]** → État vide invitant à créer un domaine (éviter un 404 en boucle).

## Migration Plan

1. Sauvegarder `data/` (au moins `projects.json`).
2. Déployer le code : au premier démarrage, `projects.json` (tableau nu) est détecté et enveloppé en `data/<uuid>.json` (domaine « Projets »), l'original renommé `data/projects.json.bak`.
3. Vérifier que le domaine « Projets » apparaît dans la sidebar et que l'outline est intact.
4. Créer ensuite les domaines souhaités (Maison, Voiture, Voyages) ; le déplacement de projets entre domaines est un changement ultérieur.
5. **Rollback** : arrêter le serveur, restaurer la sauvegarde `data/` et rétablir `server.js` (l'ancien format reste lisible).

## Open Questions

- « Projets » reste-t-il après réorganisation ? (sans conséquence : supprimable par l'utilisateur via l'archivage). Aucune décision requise pour la v1.
- Le domaine dit « par défaut » est défini par `order` le plus bas (déjà acté). Rien d'autre en suspens.
