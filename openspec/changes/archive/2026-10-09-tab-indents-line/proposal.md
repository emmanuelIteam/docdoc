## Why

Indenter une ligne n'est possible aujourd'hui **qu'à la souris** : il faut sélectionner la ligne (survol + clic sur le bouton) puis viser le bouton `→` du menu contextuel, et `←` pour désindenter. Pour un outliner utilisé au clavier, c'est un aller-retour souris permanent au milieu de la saisie. Pire : dans le champ de renommage, `Tab` fait aujourd'hui **l'inverse** de ce qu'on attend — il fait sortir du champ (blur), ce qui valide la ligne et déplace le focus vers le panneau latéral.

`Tab` / `MAJ+Tab` sont les raccourcis d'indentation universels des outliners (Workflowy, Dynalist, OmniOutliner, Notion) : c'est le geste que l'utilisateur tente déjà instinctivement, et il échoue silencieusement.

## What Changes

- **`Tab` sur une ligne de tâche monte son indentation d'un cran** : la ligne devient le **dernier enfant de son frère précédent** — exactement l'opération du bouton `→` existant (`reindentNode(…, 'indent')`), aucune sémantique nouvelle.
- **`MAJ+Tab` descend son indentation d'un cran** : la ligne devient le **frère suivant de son ancien parent** — opération du bouton `←` existant (`reindentNode(…, 'outdent')`).
- **Deux contextes d'activation** (tous deux sur la ligne courante) :
  1. **édition du titre ouverte** — le champ de renommage de la ligne a le focus (`Tab` n'est plus laissé au navigateur : il est neutralisé et traité) ;
  2. **ligne sélectionnée, hors édition** — la ligne porte l'état de tête de sélection (clic sur son bouton de sélection), le focus étant sur le bouton de sélection de cette ligne.
- **Continuité du contexte après un réindent réussi** : le texte en cours de saisie est **enregistré** (le titre saisi n'est pas perdu), l'outline est re-rendu, puis le **champ de renommage est rouvert sur la même ligne à la même position de curseur** ; dans le contexte « ligne sélectionnée », la **sélection de la ligne est restaurée**. Le raccourci peut donc être enchaîné (`Tab` `Tab` pour indenter de deux crans).
- **Cas impossibles : rien ne se passe, silencieusement.** Déjà premier enfant de son parent → `Tab` inerte ; déjà à la racine → `MAJ+Tab` inerte. **Aucune requête n'est envoyée** et la ligne reste en édition, inchangée (le client teste la faisabilité avant d'appeler le serveur, qui reste de toute façon sans effet).
- **Aucun détournement de `Tab` en dehors de l'outline** : la navigation clavier normale est préservée dans le panneau latéral (formulaires domaine/thème) et partout hors des lignes.
- **Documentation du pied de page** mise à jour pour citer `Tab` / `MAJ+Tab`.
- **Aucun changement** de route, d'API HTTP, de modèle de données, de format persisté, de feuille de style ni de comportement des boutons `→` / `←` (qui restent en place).

## Capabilities

### New Capabilities

Aucune. Le réindent existe déjà comme capacité du domaine ; cette évolution ajoute des **déclencheurs clavier** et la continuité du contexte d'édition à des exigences existantes.

### Modified Capabilities

- `node-management` : l'exigence **Reindent a node** gagne ses déclencheurs clavier (`Tab` / `MAJ+Tab`), leurs contextes d'activation, la continuité du contexte (titre en cours de saisie conservé et champ rouvert au même curseur ; sélection restaurée) et le **no-op silencieux sans requête** quand l'indentation est impossible.
- `project-outliner` : l'exigence **Document line interactions in a page footer** liste désormais `Tab` / `MAJ+Tab` parmi les interactions documentées.

## Impact

- **Frontend (`public/app.js`)** : gestion de `Tab` / `MAJ+Tab` dans le gestionnaire `keydown` du champ de renommage (`startRename`) ; **nouvel écouteur `keydown` au niveau du document** pour le contexte « ligne sélectionnée » (le focus étant sur le bouton de sélection de la ligne) ; test de faisabilité côté client (frère précédent repéré par `data-parent` dans la suite plate de lignes) ; après re-rendu, réouverture du champ d'édition au même offset de curseur et restauration de la sélection.
- **Backend (`server.js`)** : seule la phrase du **pied de page** (`.hint`) est complétée. Les routes `POST /domaine/:slug/api/nodes/:id/indent` et `.../outdent` sont **réutilisées telles quelles** (elles renvoient déjà le fragment d'outline re-rendu) ; `reindentNode` est inchangé et reste l'autorité (il ne mute rien quand le déplacement est impossible, et répond aujourd'hui `200` dans ce cas).
- **Aucun impact** sur `public/style.css`, le stockage S3, les routes, les thèmes, l'authentification, ni le format persisté d'un domaine.
- **Vérification** : contrôles HTTP du no-op des routes existantes (dans `test/passkey-flow.js`), plus une **suite navigateur Playwright** (`npm run test:e2e`, Chrome installé + authentificateur virtuel) qui joue réellement les touches et couvre les deux contextes, le curseur, le texte saisi, la sélection et l'absence de requête quand le déplacement est impossible. Le glisser-déposer, le repli/dépli et le lien profond restent à confirmer à la main.
- **Correctif constaté en recette** : le fragment d'outline posé par affectation directe n'était pas rattaché par htmx — le menu contextuel devenait inerte après un `Tab` (et l'était déjà après un `Entrée`). Un helper `swapOutlineHtml` appelle désormais `htmx.process()` sur le nouvel outline, aux trois sites d'injection.
