## 1. Modèle de domaine & stockage par fichier

- [x] 1.1 Définir la forme d'un domaine (`{ id, name, slug, order, projects[] }`) et les helpers de chargement/sauvegarde d'un fichier de domaine dans `server.js`
- [x] 1.2 Généraliser l'écriture atomique en `atomicWrite(file, data)` (temp + rename) et conserver la queue de sérialisation existante
- [x] 1.3 Implémenter l'énumération des domaines en scannant `data/*.json` (ignorer `.tmp`, `.bak` et les fichiers invalides)
- [x] 1.4 Implémenter la génération de slug (minuscules, retrait accents, espaces→`-`, collapse, déduplication `-2`, `-3`)

## 2. Migration & seed

- [x] 2.1 Détecter un `data/projects.json` legacy (tableau nu) au démarrage et l'envelopper en un domaine « Projets » ; renommer l'original en `data/projects.json.bak`
- [x] 2.2 Semer un domaine « Projets » avec l'outline d'exemple quand aucun fichier de domaine n'existe

## 3. Routage & pages par domaine

- [x] 3.1 Ajouter `GET /domaine/:slug` qui résout le domaine actif depuis le slug (404 « Domaine introuvable » sinon)
- [x] 3.2 Ajouter `GET /domaine/:slug/outline-fragment` retournant le fragment d'outline du domaine
- [x] 3.3 Remplacer `GET /` par une redirection `302` vers le domaine d'ordre le plus bas
- [x] 3.4 Faire rendre la coquille (`renderPage`) avec la sidebar et le `<h1>` (nom du domaine) + l'outline du domaine courant

## 4. Scoper les opérations de nœuds sur le domaine actif

- [x] 4.1 Paramétrer `findNode`, `createNode`, `deleteNode`, `reindentNode`, `moveNode`, `setStatus`, `toggleCollapse` pour opérer sur le `projects` du domaine
- [x] 4.2 Déplacer les routes `/api/nodes*` sous `/domaine/:slug/api/nodes*` et résoudre le domaine actif depuis le chemin
- [x] 4.3 Mettre à jour les attributs htmx rendus dans l'outline pour viser les chemins scopés au domaine
- [x] 4.4 Adapter `/api/outline` (ou le déplacer en `/domaine/:slug/api/outline`) pour refléter le domaine actif

## 5. Gestion des domaines (créer / renommer / supprimer)

- [x] 5.1 Créer un domaine depuis la sidebar (nom → fichier `{ id, slug, order, projects:[] }`) et rediriger vers sa page
- [x] 5.2 Renommer un domaine (mettre à jour `name` + régénérer `slug` dans le même fichier) ; l'ancienne URL renvoie 404
- [x] 5.3 Supprimer un domaine en archivant son fichier dans `data/archive/` et en le retirant de la liste
- [x] 5.4 Afficher un état vide invitant à créer un domaine quand il n'y en a aucun

## 6. Panneau latéral (sidebar)

- [x] 6.1 Construire la sidebar (liste des liens de domaines, surbrillance du domaine actif) dans la coquille
- [x] 6.2 Ajouter le bouton de bascule ☰ et la grille CSS `sidebar | content` avec l'état replié (`sidebar-collapsed` → `0 1fr`)
- [x] 6.3 Persister l'état replié en `localStorage` et le ré-appliquer au chargement de la page

## 7. Vérification

- [x] 7.1 Démarrer le serveur et confirmer la migration/seed ainsi que la redirection de `/` vers le domaine par défaut
- [x] 7.2 Confirmer que chaque domaine vit dans son propre fichier et qu'un seul domaine par fichier
- [x] 7.3 Confirmer que les opérations de nœuds sont scopées au domaine actif et persistées dans le bon fichier
- [x] 7.4 Confirmer créer/renommer/supprimer (archivage), la 404 de l'ancienne URL après renommage, et la présence du fichier archivé
- [x] 7.5 Confirmer la bascule/persistance de la sidebar, la surbrillance du domaine actif, et que htmx ne remplace que l'outline
