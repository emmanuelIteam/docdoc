## Context

L'outline est rendu côté serveur : `renderLine` (`server.js`) produit chaque ligne et son menu contextuel. L'action « + » était un bouton htmx (`hx-post` avec `hx-vals='{"parentId":"…"}'`) : la route créait le nœud, persistait le domaine et renvoyait l'outline rendue, que htmx remplaçait. Rien ne permettait au client de savoir quel nœud venait d'être créé, donc la nouvelle ligne n'était ni sélectionnée ni ouverte à la saisie.

La création par Entrée a déjà résolu le même problème : `POST /api/nodes/:id/next` renvoie l'id du nouveau nœud dans `X-New-Node-Id`, le client remplace l'outline puis appelle `startRename(titleEl, 0, 0, true, true)`. `startRename` remplace le `<span class="title">` par un `<input class="title-input">`, lui donne le focus et sélectionne tout le texte à la frame suivante (`selectAll`).

Une ligne repliée n'émet pas ses descendants (`hiddenNodeIds`), donc une sous-tâche créée sous une ligne repliée serait absente du DOM : le client ne pourrait pas l'ouvrir.

## Goals / Non-Goals

**Goals:**

- Cliquer sur « + » crée la sous-tâche et ouvre immédiatement son titre avec « Nouvelle tâche » entièrement sélectionné.
- La première frappe remplace le titre par défaut ; le titre saisi est enregistré comme un renommage normal.
- La nouvelle ligne est visible même si le parent était replié.
- Aucun changement de modèle, de route existante (hors en-tête) ni de dépendance.

**Non-Goals:**

- Changer l'emplacement de la nouvelle ligne (elle reste la dernière sous-ligne du parent).
- Créer plusieurs lignes à la suite depuis « + » (l'utilisateur peut rouvrir le menu ou appuyer sur Entrée dans le champ).
- Remplacer le titre par défaut par un texte d'attente non persisté.
- Modifier la création par Entrée, la sélection de sous-arbre ou le glisser-déposer.

## Decisions

### 1. Création pilotée par le client, id renvoyé dans `X-New-Node-Id`

Le bouton « + » perd ses attributs htmx et devient un simple bouton `.menu-item.add-child`. Un gestionnaire délégué sur le document envoie `POST /domaine/:slug/api/nodes` avec `{ parentId }`, lit l'id dans l'en-tête, remplace l'outline avec `swapOutlineHtml`, puis retrouve la nouvelle ligne par son id et ouvre son titre.

*Alternatives écartées :*

- **Garder htmx et écouter `htmx:afterRequest`** : il faudrait corréler la réponse à l'action (le même POST sert à d'autres créations), et l'ordre entre le swap et la lecture de l'en-tête est plus fragile.
- **Retrouver la ligne par son titre** : plusieurs lignes peuvent déjà s'appeler « Nouvelle tâche » ; l'id est la seule clé fiable.
- **Renvoyer l'id dans le HTML** : possible, mais l'en-tête est déjà le contrat utilisé par `/next` pour le même besoin.

### 2. Ouvrir le champ avec le texte par défaut sélectionné

Après le swap, le client appelle `startRename(newTitle, 0, 0, true, true)`. `selectAll` sélectionne toute la valeur dans la frame suivante, exactement comme pour la ligne créée par Entrée. Aucun nouveau mode d'édition n'est introduit : le champ reste le `<input>` existant, et la validation (Entrée, Tab, blur) enregistre par le PUT habituel.

*Alternatives écartées :*

- **Créer la ligne avec un titre vide et un `placeholder`** : change le modèle de données (titre vide) et le rendu des lignes existantes, pour un comportement identique à l'écran.
- **Sélectionner la ligne plutôt que le texte** : laisse le titre par défaut à effacer, ce qui est précisément le problème.

### 3. Déplier le parent à la création

Dans la route `POST /api/nodes`, quand un `parentId` est fourni, le parent est marqué `collapsed = false` avant la persistance et le rendu. Le client peut alors trouver la nouvelle ligne et l'ouvrir, et l'utilisateur voit ce qu'il vient de créer. Le pli est persisté avec le reste du domaine.

*Alternatives écartées :*

- **Déplier côté client après le rendu** : la ligne serait absente du DOM, il faudrait un second aller-retour (toggle) puis un second rendu avant de pouvoir ouvrir le champ.
- **Laisser le parent replié** : la ligne existe mais reste invisible, et l'action semble sans effet.

### 4. Conserver la révélation active

Si la page est ouverte avec `?reveal=<id>`, le POST du client ajoute ce paramètre à l'URL. Le serveur déplie donc aussi les ancêtres de la cible, comme pour toute autre requête htmx réémise avec `reveal` ; un re-rendu ne referme pas la ligne révélée.

## Risks / Trade-offs

- **La création n'est plus couverte par les attributs htmx** → le handler est délégué sur le document, comme le renommage et la copie de lien ; il ne dépend pas du re-rendu de l'outline.
- **Un échec réseau laisse la ligne non créée** → `reloadOutline()` restaure l'outline du serveur et la console journalise l'erreur, comme pour `/next`.
- **Le parent est déplié durablement** → c'est le comportement attendu après un ajout ; l'utilisateur peut le replier d'un double-clic.
- **Un ancien service worker sert l'ancien `app.js`** → incrément de `CACHE_VERSION`, déjà la règle du dépôt pour tout actif précaché.

## Migration Plan

Aucune migration : le modèle `{id, title, status, collapsed, children}` et les clés S3 sont inchangés. Déploiement normal ; `CACHE_VERSION` est incrémenté. Retour arrière : remettre les attributs htmx sur le bouton « + » et retirer l'en-tête et le gestionnaire client ; les domaines déjà créés restent valides.

## Open Questions

Aucune question bloquante.
