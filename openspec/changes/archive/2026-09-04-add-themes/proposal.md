## Why

Maintenant que les projets sont regroupés en **domaines** (chacun sur sa page et son fichier), il manque un niveau de regroupement *transverse* : un **thème** qui fédère plusieurs domaines, et qui permette à un même domaine d'appartenir à plusieurs thèmes. Un thème est une étiquette légère (nom + couleur) collée sur un domaine — cela offre une seconde lecture des domaines sans toucher au modèle projet/nœud.

## What Changes

- Introduit le concept de **thème** : étiquette légère `{ id, name, color }`, stockée dans une **palette unique** `data/themes.json`. Pas de page dédiée, pas de slug, pas de sous-dossier par thème.
- Un **domaine** porte désormais un tableau `labels` de `themeId` ; **coller/coller/retirer** une étiquette lie/délie le domaine à un thème. Un domaine peut porter plusieurs étiquettes → appartenir à plusieurs thèmes. Le modèle de projet/nœud reste identique.
- Le **panneau latéral gauche** devient à deux niveaux : les thèmes en groupes → les domaines portant leur étiquette, plus une section **« Sans thème »** (aucun domaine n'est jamais masqué). Le domaine actif reste surligné ; la page et l'URL `/domaine/:slug` du domaine sont inchangées.
- Ajoute la **gestion des thèmes** (depuis la palette) : créer, renommer (nom + couleur), supprimer (retire le thème et son étiquette de chaque domaine), choisir une couleur.
- Ajoute l'**interface de collage** : sur la page d'un domaine, une zone de pastilles « Étiquettes » pour ajouter/retirer des thèmes (mêmes pastilles que dans le panneau latéral).
- **Migration** : les domaines existants n'ont pas d'étiquette → ils apparaissent sous « Sans thème » ; palette vide semée, éventuellement 1-2 thèmes d'exemple au premier lancement.

## Capabilities

### New Capabilities
- `theme-storage`: Persiste la palette de thèmes dans un fichier unique auto-décrit `data/themes.json` (énumération/chargement, écriture atomique, état vide/semé).
- `theme-management`: Gère le cycle de vie d'un thème — créer, renommer, supprimer, choisir une couleur — et le collage/retrait d'une étiquette de thème sur un domaine, en retirant l'id d'un thème supprimé de chaque domaine.

### Modified Capabilities
- `domain-storage`: L'objet domaine porte désormais un champ `labels` (tableau de `themeId`) à côté de `id`/`name`/`slug`/`order`/`projects`, persisté dans son fichier par domaine.
- `domain-navigation`: Le panneau latéral groupe les domaines par thème (en-têtes de thèmes → leurs domaines étiquetés) et affiche une section « Sans thème » pour les domaines non étiquetés, à la place de la liste plate de domaines.

## Impact

- **Backend (`server.js`)**: lecture/écriture de `themes.json`; champ `labels: []` sur les objets domaine; helper de regroupement des domaines par thème pour le panneau; routes `GET /api/themes`, `POST /api/themes`, renommage/suppression d'un thème, et `POST /domaine/:slug/api/labels` (attacher/détacher un `themeId`). La suppression d'un thème propage le retrait de son id dans tous les domaines (écriture atomique par fichier concerné).
- **Data**: nouveau `data/themes.json`; les fichiers de domaines gagnent un champ `labels` (les fichiers existants sont initialisés à `[]`). Le format des fichiers de domaines est sinon inchangé.
- **Frontend** (`public/style.css`, `public/app.js`, rendu serveur): panneau latéral à deux niveaux, groupes de thèmes et pastilles, zone « Étiquettes » sur la page du domaine.
- **Aucune nouvelle dépendance externe** (Express + htmx suffisent).
