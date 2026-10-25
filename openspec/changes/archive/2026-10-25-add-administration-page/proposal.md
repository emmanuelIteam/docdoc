## Why

La gestion des thèmes et des domaines est aujourd'hui éparpillée dans des contrôles inline : renommage et suppression d'un thème dans l'en-tête de son groupe, renommage et archivage d'un domaine sur sa page, création dans deux formulaires cachés du pied du panneau. Trois opérations manquent purement et simplement — changer la couleur d'un thème après sa création, réordonner les domaines (le champ `order` existe mais aucune UI ne l'écrit), et retrouver un domaine archivé (`archive/` est un aller simple). Une page d'administration, atteignable par une rubrique en pied du panneau latéral, centralise le cycle de vie de ces deux objets et laisse le panneau n'être plus qu'une surface de navigation.

Le même mouvement recentre la page domaine sur son contenu : son nom n'y est plus éditable, ses étiquettes passent dans une barre flottante en bas à droite, et le bouton « + Nouveau projet » disparaît au profit d'un projet par défaut — un outline n'est jamais vide.

## What Changes

- Nouvelle page `GET /administration`, accessible à tout propriétaire d'espace authentifié, organisée en trois sections empilées : **Thèmes**, **Domaines**, **Archives** (repliée par défaut).
- **Panneau latéral en lecture seule** : les formulaires de création et les contrôles d'édition disparaissent ; il ne reste que les domaines groupés par thème, une rubrique **Administration** en pied (surlignée quand la page est active) et la boîte de session. **BREAKING** pour les habitudes : créer un domaine ou un thème ne se fait plus depuis le panneau.
- **Page domaine recentrée sur son contenu** : la barre d'outils disparaît. Les étiquettes passent dans une **barre flottante en bas à droite**, mise à jour en place avec htmx — la barre et le panneau latéral se rafraîchissent sans recharger la page ni perdre le scroll. Le bouton « + Nouveau projet » est retiré : un projet est une ligne de premier niveau, créée par Entrée sur une ligne racine.
- **Un projet par défaut, et jamais d'outline vide** : un domaine créé contient une ligne racine « Nouveau projet » ; supprimer la dernière ligne la remplace par une nouvelle ligne par défaut ; un domaine vide hérité ou restauré depuis l'archive est matérialisé à sa première consultation.
- **Renommage par bouton d'édition** : dans la section Domaines, le nom n'est plus un formulaire permanent. Un bouton `✎`, rendu par une balise `<details>` (aucun JS), révèle le champ et l'avertissement de régénération d'URL. Le nom reste en lecture seule sur la page domaine.
- **Gestion des thèmes depuis la page** : créer (nom + couleur), renommer, **modifier la couleur après création**, supprimer (avec retrait de l'étiquette de chaque domaine), réordonner par ↑/↓.
- **Gestion des domaines depuis la page** : créer, renommer par bouton d'édition, archiver, réordonner par ↑/↓. **BREAKING** : renommer régénère le slug, l'ancienne URL renvoie « Domaine introuvable » — comportement conservé, annoncé à l'ouverture de l'éditeur.
- **Archives réversibles** : lister les domaines archivés du compte, les restaurer (slug régénéré s'il entre en collision avec un domaine actif, domaine replacé en fin de liste) ou les purger définitivement.
- **Matrice thème × domaine** dans la section Thèmes : cocher/décocher l'appartenance d'un domaine à un thème en un coup d'œil, en complément de la barre d'étiquettes de la page domaine.
- **Espace vide** : `/` ne renvoie plus vers un message invitant à créer un domaine « dans le panneau de gauche », mais vers la page d'administration.
- Aucun changement du modèle persisté : pas de champ `order` sur les thèmes (l'ordre est celui du tableau), pas de nouveau fichier, pas de migration de données. Le projet par défaut est un nœud ordinaire, au même format que les autres.

## Capabilities

### New Capabilities

- `space-administration` : la page d'administration elle-même — route, accès réservé au propriétaire de l'espace, les trois sections, l'état vide, la rubrique du panneau et son état actif.
- `domain-archive` : l'archive comme cycle de vie réversible — énumération confinée au préfixe du compte, restauration avec régénération de slug en cas de collision, purge définitive.

### Modified Capabilities

- `theme-management` : création, renommage, changement de couleur, suppression et réordonnancement des thèmes se font depuis la page d'administration ; la couleur devient modifiable après création ; l'attachement d'un thème à un domaine est disponible à deux endroits (barre flottante du domaine et matrice), et la barre se met à jour en place, panneau latéral compris.
- `domain-management` : création (avec un projet par défaut), renommage par bouton d'édition, archivage et réordonnancement des domaines se font depuis la page d'administration ; le renommage casse explicitement l'ancienne URL ; la création ne se fait plus depuis le panneau ; la page domaine n'offre plus le renommage.
- `node-management` : un domaine n'affiche jamais un outline vide — création automatique du projet par défaut, remplacement de la dernière ligne supprimée, matérialisation d'un domaine vide à sa première consultation ; la création d'un projet de premier niveau se fait par Entrée sur une ligne racine, plus par un bouton dédié.
- `domain-navigation` : le panneau latéral devient une navigation en lecture seule (plus de création ni d'édition), gagne une rubrique Administration en pied avec état actif, et son message d'espace vide pointe vers la page d'administration. Il continue de se regrouper par étiquette, y compris lors d'une mise à jour partielle depuis la barre flottante.

## Impact

- **`server.js`** : nouveau renderer `renderAdminPage` (sections, tables, matrice), route `GET /administration`, routes `POST /api/themes/:id/move`, `POST /api/domains/:id/move`, `POST /api/archives/:id/restore`, `POST /api/archives/:id/purge`, `POST /api/themes/:id/labels` (matrice) ; redirections des routes existantes vers la page d'origine via un `returnTo` validé ; `renderSidebar` simplifié et extraction de `renderSidebarNav` (réutilisé en OOB) ; `renderDomainActions` supprimé, remplacé par une barre d'étiquettes flottante `#labels-bar` ; `POST /domaine/:slug/api/labels` renvoie un fragment htmx (barre + panneau latéral en OOB) et garde la redirection pour les requêtes non-htmx ; helper `ensureDefaultProject` appelé à la création, sur les GET d'outline et après suppression de la dernière ligne ; bouton d'édition du nom de domaine en `<details>` dans la table d'administration.
- **`storage.js`** : `listArchiveKeys(userId)` calqué sur `listDomainKeys`, confiné à `users/{userId}/archive/` ; réutilisation de `moveObject` (restauration) et `deleteObject` (purge). Aucun changement de format.
- **`public/app.js`** : bascule du `+` de la barre d'étiquettes en délégation d'événements (l'élément est remplacé à chaque swap htmx) ; le renommage du domaine n'ajoute aucun JS (balise `<details>`).
- **`public/style.css`** : styles de table d'administration, de rubrique de panneau, de matrice et de formulaire de couleur ; barre d'étiquettes fixée en bas à droite, sélecteur ouvert vers le haut, espace réservé sous l'outline et au-dessus du pied de page ; styles du bouton d'édition `<details>`.
- **Specs** : deux capacités ajoutées, quatre modifiées (`domain-management`, `node-management`, `theme-management`, `domain-navigation`) ; `domain-storage` et `theme-storage` inchangées (aucun changement de format persisté).
- **Tests** : la spec Playwright `test/e2e/administration.spec.js` est adaptée (ouvrir l'éditeur avant de saisir le nom, barre d'étiquettes au lieu de la zone d'outils, domaine restauré vide) et gagne des cas pour le projet par défaut, l'outline jamais vide et la mise à jour partielle des étiquettes ; la suite existante (`test/e2e/reindent.spec.js`) ne doit pas bouger.
- Aucune nouvelle dépendance externe ; aucun changement de configuration ou de déploiement.
