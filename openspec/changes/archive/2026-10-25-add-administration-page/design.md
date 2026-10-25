## Context

L'application est un outlineur serveur-rendu (Express + htmx) multi-comptes : chaque compte possède son espace sous `users/{userId}/` (`themes.json`, `domains/<id>.json`, `archive/<id>.json`). La gestion des thèmes et des domaines existe déjà, mais dispersée :

```
Panneau gauche                              Page domaine
├─ en-tête de thème : <input nom> [✏️] [🗑] ├─ toolbar : [+ Nouveau projet] [Étiquettes] [nom ✏️] [🗑 archiver]
├─ [+ Nouveau thème] (nom + couleur)        └─ (la couleur d'un thème n'est modifiable nulle part)
└─ [+ Nouveau domaine] (nom)
```

La page domaine porte elle-même deux défauts de conception que ce changement corrige : sa barre d'outils occupe le haut du contenu pour des gestes qui ne sont pas du contenu (créer un projet, coller une étiquette), et un domaine peut se retrouver sans aucune ligne — le bouton « + Nouveau projet » est alors le seul point de création, donc le retirer sans projet par défaut créerait un cul-de-sac.

Trois manques structurels motivent la page : la couleur d'un thème n'est éditable qu'à la création (la route `POST /api/themes/:id/rename` accepte pourtant déjà `color`), le champ `order` des domaines n'est jamais écrit après la création (`nextOrder` seulement), et `archive/` n'est jamais listé — un domaine archivé est définitivement invisible pour l'application. Les contrôles inline actuels sont par ailleurs fragiles : un clic dans l'en-tête d'un thème ouvre un champ d'édition, et le renommage d'un domaine est un formulaire permanent dans sa barre d'outils.

Contraintes : pas de framework client, formulaires POST + redirection, pas de nouvelle dépendance, aucune migration de données (le format persisté ne change pas). L'accès est déjà garanti par `auth.guard` + `withSpace` : la page n'a pas à inventer de rôle.

## Goals / Non-Goals

**Goals:**
- Une page unique `/administration` qui regroupe le cycle de vie complet des thèmes, des domaines et des archives.
- Un panneau latéral en lecture seule, avec une rubrique Administration en pied et un état actif.
- Trois opérations aujourd'hui impossibles : changer la couleur d'un thème, réordonner thèmes et domaines, restaurer ou purger un domaine archivé.
- Une matrice thème × domaine pour voir et modifier les appartenances en un coup d'œil.
- Zéro changement de format persisté, zéro migration : la page ne fait que réécrire des objets existants.

**Non-Goals:**
- Pas d'historique de versions des thèmes ou des domaines (pas de brouillon/publié, pas de retour arrière).
- Pas de rôles ni d'administrateur système : « administration » = propriétaire de l'espace courant.
- Pas d'édition en masse (renommer 10 domaines d'un coup), pas de glisser-déposer pour l'ordre, pas de recherche/filtre.
- Pas de page par thème, pas de slug de thème, pas de changement du modèle de nœud/projet.
- Pas de modification du panneau latéral au-delà du retrait des contrôles et de l'ajout de la rubrique.

## Decisions

### D1 — Une seule page, trois sections empilées, archives en `<details>` replié
`GET /administration` rend les sections **Thèmes** (palette + matrice), **Domaines** (table) et **Archives** (replié). Pas d'onglets, pas de paramètre de section, pas de routepar section.
- *Pourquoi* : aucun état d'onglet à maintenir dans le rendu, les redirections et les tests ; une seule URL à partager ; le HTML reste du rendu serveur pur, sans JS supplémentaire. Les archives sont rares → repliées pour ne pas encombrer.
- *Alternatives rejetées* : onglets via `?section=` (état d'URL à propager partout, y compris dans `returnTo`) ; trois pages séparées (trois routes, rubrique à subdiviser). Écarté pour cette taille d'application.

### D2 — Réutiliser les routes POST existantes, avec un `returnTo` validé
Les routes de mutation existantes (`POST /api/themes`, `/api/themes/:id/rename`, `/api/themes/:id/delete`, `POST /api/domains`, `/api/domains/:id/rename`, `/api/domains/:id/archive`, `POST /domaine/:slug/api/labels`) sont conservées. Les formulaires de la page d'administration portent un champ caché `returnTo=/administration` ; un helper décide de la redirection :

```
redirectAfter(req, res, defaultPath):
  if req.body.returnTo === '/administration'  → 302 /administration
  else                                        → comportement actuel
                                                (page domaine régénérée, backTo(req), '/')
```

- *Pourquoi* : une seule implémentation par mutation, déjà testée et cohérente avec les specs ; pas de routes `/api/admin/*` dupliquées.
- *Sécurité* : `returnTo` est comparé à une valeur littérale unique — jamais concaténé à une URL, donc pas de redirection ouverte.
- *Conséquence* : le renommage d'un domaine n'est proposé que depuis l'administration ; la page domaine n'expose plus de formulaire de renommage. La route conserve son comportement de repli (redirection vers `/domaine/<nouveau-slug>`) pour un appel qui ne porterait pas `returnTo`.

### D3 — Ordre des thèmes = ordre du tableau, ordre des domaines = champ `order`
- **Thèmes** : `POST /api/themes/:id/move` avec `dir=up|down` échange l'élément avec son voisin dans le tableau `space.themes`, puis `persistThemes`. Aucun champ `order` n'est ajouté : la palette est déjà un tableau ordonné, et `theme-storage` n'a pas à changer.
- **Domaines** : `POST /api/domains/:id/move` reconstruit `domainList` (tri `order` puis nom), trouve le voisin affiché et échange leurs valeurs `order`. Si les deux valeurs sont égales (fichiers anciens ou restaurés), tous les domaines sont renumérotés `0..n-1` dans l'ordre affiché **avant** l'échange, puis les deux domaines concernés sont persistés.
- *Pourquoi* : ↑/↓ est le strict nécessaire pour une table ; le glisser-déposer demanderait un rendu client et un format de liste complète.
- *Alternatives rejetées* : champ `order` sur les thèmes (redondant avec le tableau) ; API « voici la liste ordonnée complète » (plus de surface, pas de besoin).

### D4 — La matrice thème × domaine est une seconde porte d'entrée sur `labels`
Chaque cellule de la matrice est un petit formulaire `POST /api/themes/:id/labels` avec `domainId` + `action=attach|detach`, qui réutilise la logique existante de `POST /domaine/:slug/api/labels` (factorisée en `setDomainLabel(space, domain, themeId, action)`).
- *Pourquoi* : l'appartenance reste portée par `labels` du domaine, une seule source de vérité, pas de table de jointure. On lit la relation dans les deux sens sans dupliquer la donnée.
- *Conséquence* : les pastilles de la page domaine restent en place (geste contextuel) ; la matrice répond au besoin inverse (« quels domaines portent ce thème ? »).
- *Rendu* : matrice = première colonne les thèmes (pastille + nom), colonnes les domaines, cellule ✓/○ ; `overflow-x: auto` si l'espace manque ; un formulaire par cellule (pas de JS).

### D5 — Archives : lister, restaurer, purger
- `storage.listArchiveKeys(userId)` = `listKeys(userKey(userId, 'archive/'))`, exactement calqué sur `listDomainKeys` : le préfixe est construit à partir du `userId` de la session, jamais d'un paramètre de requête.
- **Listing** : chaque clé est lue ; un objet illisible ou invalide est ignoré (même tolérance que `loadDomains`). On affiche nom, identifiant, et les thèmes qu'il portait encore.
- **Restauration** : lire le payload, calculer le slug avec `slugify(space, name, id)` (dédup sur les domaines actifs), fixer `order = nextOrder(space)` (le domaine réapparaît en bas), réécrire l'objet domaine avec `persistDomain`, puis supprimer l'objet d'archive (`deleteObject`). Dans cet ordre : une coupure entre les deux laisse une copie d'archive orpheline (purgeable), jamais un domaine perdu.
- **Purge** : `deleteObject(archiveKey)` après confirmation explicite ; irréversible, ne touche que le préfixe du compte.
- *Pourquoi* : `moveObject` seul écraserait le slug/ordre recalculés par le payload d'origine ; écrire puis supprimer garde la donnée du bon côté à chaque étape.
- *Perte silencieuse assumée* : un thème supprimé pendant l'archivage disparaît des `labels` au rechargement (`normalizeDomain` élague les ids inconnus) — la restauration ne ressuscite pas le thème.

### D6 — Panneau latéral et page domaine allégés
- `renderSidebar` : suppression des `form` de création, du champ de renommage et des boutons 🗑 des en-têtes de thème ; les en-têtes deviennent `<span>` + pastille. Ajout de la rubrique `Administration` dans `.sidebar-footer`, au-dessus de `.session-box`, avec la classe `sidebar-link active` quand `opts.admin` est vrai. Le corps du panneau est extrait dans `renderSidebarNav(space, activeSlug)` pour pouvoir être re-rendu seul (D10).
- `renderDomainActions` : supprimé. La page n'a plus de barre d'outils ; les étiquettes vivent dans la barre flottante décrite en D10, le renommage dans l'administration (D11), et la création d'un projet est celle de l'outliner (D9).
- `renderShell(space, content, activeSlug, opts)` gagne un drapeau `opts.admin` (titre « Administration », `data-domain-slug=""`, rubrique active, pas de `reveal`). La page domaine garde `opts.title = domain.name` mais sans aucun contrôle d'édition à côté.
- *Pourquoi* : une seule surface de mutation, un panneau qui redevient une navigation ; les specs `domain-navigation` et `domain-management` décrivent alors exactement ce que l'utilisateur voit.

```
Cible — page domaine                       Cible — section Domaines
┌──────────────────────────────┐           ┌──────────────────────────────────────────┐
│ ☰  Mon domaine               │           │ Mon domaine  ✎   /domaine/mon-domaine  ↑↓🗑 │
├──────────────────────────────┤           │   (le formulaire n'apparaît qu'au clic)  │
│ ● Nouveau projet             │           └──────────────────────────────────────────┘
│ ● ligne 2                    │
│                              │
│                 ┌──────────┐ │
│                 │🏷 ●● ×  +│ │  ← fixe, bas droite
│                 └──────────┘ │
└──────────────────────────────┘
```

### D7 — Accès et confinement
La page et toutes les routes d'administration vivent après `auth.guard` + `withSpace` ; aucune ne prend de `userId` ni de préfixe en paramètre. Toute lecture/écriture d'archive passe par `archiveKey(req.space.userId, id)` ou `listArchiveKeys(req.space.userId)`. Un id d'archive inexistant → 404 « Archive introuvable ».
- *Pourquoi* : c'est déjà le modèle de confinement du reste de l'application ; la page ne doit pas introduire de surface d'accès latérale.

### D8 — Interface, états vides, confirmations
- Tables HTML sans framework : `.admin-section`, `.admin-table`, `.admin-empty`, `.matrix`. Couleur = `<input type="color">` ; réordonnancement = boutons `↑`/`↓` ; suppression = `onsubmit="return confirm(...)"` (motif déjà utilisé).
- Le renommage d'un domaine est révélé par un bouton `✎` (voir D11) ; l'avertissement « l'URL du domaine sera régénérée à partir du nouveau nom » n'apparaît qu'à l'ouverture de l'éditeur (on n'affiche pas le slug prévisionnel, la déduplication pouvant le modifier).
- Purge : `confirm('Purger définitivement « <nom> » ? Cette action est irréversible.')`.
- États vides : section Thèmes sans thème → « Aucun thème — créez-en un ci-dessus » ; section Domaines sans domaine → « Aucun domaine » ; section Archives vide → « Aucun domaine archivé » (reste visible, repliée).
- Page d'accueil sans domaine : `renderEmptyPage` renvoie un lien vers `/administration` au lieu de « créez un domaine dans le panneau de gauche ».

### D9 — Un domaine n'a jamais un outline vide
Invariant : toute page domaine affiche au moins une ligne racine. Un helper unique `ensureDefaultProject(space, domain)` matérialise `Nouveau projet` quand `projects.length === 0`, en réutilisant `createNode(domain, null)` (donc `defaultTitle`, le statut `todo`, `collapsed: false` et l'insertion dans `displayOrder`). Il est appelé :
- dans `POST /api/domains`, juste après `makeDomain` ;
- dans `GET /domaine/:slug` et `GET /domaine/:slug/outline-fragment` — c'est le seul cas où un GET écrit, et uniquement si l'outline est vide ;
- dans `DELETE /domaine/:slug/api/nodes/:id`, après `deleteNode`, pour que la réponse htmx contienne déjà la ligne de remplacement.

Le test `projects.length === 0` et la création sont synchrones avant toute écriture asynchrone : deux requêtes concurrentes ne peuvent pas créer deux lignes par défaut.

- *Pourquoi* : le bouton « + Nouveau projet » disparaît, et une ligne racine ne peut être créée qu'avec `Entrée` sur une ligne existante. Sans cet invariant, supprimer la dernière ligne, restaurer une archive vide ou ouvrir un domaine ancien vide laisserait une page sans aucun point de création.
- *Conséquence assumée* : supprimer la dernière ligne ne vide pas le domaine, elle la remplace par un `Nouveau projet`. L'utilisateur voit la ligne « réapparaître » ; c'est le prix de l'invariant.
- *Alternatives rejetées* : une ligne fantôme non persistée (il faudrait créer le nœud au premier clic, avec un rendu différent de l'API) ; interdire la suppression de la dernière ligne (geste bloqué, message à ajouter, moins simple).
- *Hors chargement de l'espace* : on ne matérialise pas les domaines vides de tous les comptes au démarrage ; la matérialisation est paresseuse, à la première consultation.

### D10 — Barre d'étiquettes : un fragment htmx, pas une page
La barre `#labels-bar` est fixée en bas à droite du viewport et contient une puce retirable par thème, un bouton `+` qui révèle le sélecteur (ouvert vers le haut), et le message « Aucun thème » avec un lien vers `/administration` quand la palette est vide. `renderLabelsZone` devient `renderLabelsBar(space, domain)`.

- **Route** : `POST /domaine/:slug/api/labels` conserve `setDomainLabel` + `persistDomain`. Si la requête porte `HX-Request`, elle répond avec le fragment de barre **et** un `<nav class="sidebar-nav" hx-swap-oob="outerHTML">` produit par `renderSidebarNav(space, domain.slug)`. Sinon elle redirige comme aujourd'hui (repli sans JS).
- **Cibles** : chaque formulaire de puce et le formulaire d'attachement portent `hx-target="#labels-bar"` + `hx-swap="outerHTML"`.
- **Délégation** : le bouton `+` est recréé à chaque swap ; `app.js` passe d'un listener sur l'élément capturé au chargement à une délégation sur `document` (comme les autres gestes de l'outliner).
- *Pourquoi l'OOB* : les étiquettes sont le critère de regroupement du panneau. Une barre à jour et un panneau périmé seraient une contradiction visible ; l'OOB évite de recharger la page et de perdre le scroll.
- *Alternatives rejetées* : ne rafraîchir que la barre (panneau faux) ; `fetch` + mise à jour locale des puces (il faudrait redessiner le panneau à la main, donc dupliquer le rendu) ; conserver le rechargement complet (la barre fixe rendrait le retour en haut de page très visible).
- *Limites* : un thème créé ou supprimé dans un autre onglet n'apparaît dans la barre qu'au prochain chargement ; une erreur (thème inconnu → 404) laisse la barre en place, htmx ne swappant pas.

### D11 — Renommage d'un domaine : un bouton, pas un formulaire permanent
Dans la section Domaines, la cellule nom devient du texte suivi d'un `<details class="admin-rename">` dont le `<summary>` est le bouton `✎` (marqueur natif masqué en CSS). Le formulaire existant (input pré-rempli, `required`, `✓`, `returnTo=/administration`) vit dans le bloc replié, avec l'avertissement de régénération d'URL.

- *Pourquoi* : supprime un input et un paragraphe d'avertissement par domaine, sans JS et sans perdre l'accessibilité clavier ; le nom de la page domaine reste en lecture seule.
- *Alternatives rejetées* : bouton + JS (le renommage disparaîtrait sans JS, et il faudrait gérer `Échap`) ; modale (surdimensionnée) ; formulaire permanent (le problème d'origine).
- *Conséquence* : refermer le `<details>` sans valider perd la saisie ; geste rare, comportement natif accepté. Le nom reste du texte, pas un second lien : la colonne URL porte déjà le lien vers le domaine.

## Risks / Trade-offs

- **Renommer casse les liens partagés** → décision assumée ; l'avertissement est affiché à l'ouverture de l'éditeur, et la spec `domain-management` l'énonce explicitement. Aucun alias d'ancienne URL n'est conservé.
- **Supprimer la dernière ligne la voit réapparaître** → comportement voulu de l'invariant D9, documenté dans `node-management` ; l'alternative (bloquer la suppression) a été écartée.
- **Écriture pendant un GET** → limitée au seul cas d'un outline vide, contrôle et création synchrones, écriture idempotente ; aucune matérialisation au chargement de l'espace.
- **Réponse couplée barre + panneau** → le fragment d'étiquettes dépend de `renderSidebarNav` et porte un swap OOB ; un panneau ouvert dans un autre onglet reste daté jusqu'au prochain chargement, comme aujourd'hui.
- **Barre fixe en bas à droite** → espace réservé sous l'outline et au-dessus du pied de page, sélecteur ouvert vers le haut, barre compacte sur écran étroit pour ne pas masquer le contenu.
- **`<details>` refermé sans valider** → la saisie est perdue ; geste rare, comportement natif assumé, pas de JS pour le retenir.
- **Purge irréversible** → confirmation nominative ; l'objet n'est supprimé que dans le préfixe du compte ; pas de corbeille de second niveau.
- **Restauration avec collision de slug** → `slugify` déduplique (`-2`) ; l'ancien lien était de toute façon mort depuis l'archivage.
- **Restauration d'un domaine dont un thème a été supprimé** → les `labels` orphelins sont élagués au chargement ; perte silencieuse documentée, pas de ressuscitation du thème.
- **Ordres dupliqués** (fichiers anciens, restaurations) → renumérotation `0..n-1` au premier déplacement, sinon le tri `order` puis nom reste stable et déterministe.
- **Onglets multiples / état en mémoire** → `space` est partagé par processus et les écritures sont sérialisées (`writeQueue`) ; une page ouverte peut afficher un état légèrement daté, corrigé au rechargement suivant.
- **Matrice large** (beaucoup de domaines) → conteneur `overflow-x: auto` ; pas de virtualisation, échelle attendue modeste.
- **`returnTo` détourné** → liste blanche d'une seule valeur, jamais de concaténation.

## Migration Plan

1. Aucune migration de données : le format de `themes.json`, `domains/<id>.json` et `archive/<id>.json` est inchangé ; le projet par défaut est un nœud ordinaire.
2. Déploiement : redémarrage du serveur (les espaces en mémoire sont rechargés depuis le bucket au premier accès).
3. Vérification : créer un thème et un domaine (le domaine doit naître avec `Nouveau projet`), changer une couleur, réordonner, archiver puis restaurer et purger ; vérifier que le nom se renomme uniquement par le bouton `✎`, qu'attacher/détacher une étiquette ne recharge pas la page et regroupe le panneau, et que supprimer la dernière ligne d'un domaine en recrée une.
4. Rollback : revenir au commit précédent ; les objets réécrits par une restauration restent des objets domaine valides pour l'ancien code, et les archives inchangées sont simplement ignorées.

## Open Questions

- La purge doit-elle demander de recopier le nom du domaine, ou une simple confirmation suffit-elle ? (choix retenu : confirmation simple, cohérente avec l'archivage existant)
- Faut-il afficher un compteur d'archives sur la rubrique Administration, ou seulement le nombre dans le titre de la section repliée ?
- La matrice doit-elle être repliable au-delà d'un certain nombre de thèmes, ou rester toujours visible ?
