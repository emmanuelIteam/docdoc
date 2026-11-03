## Why

Sur un smartphone, le panneau latéral occupe presque toute la largeur de l'écran. On l'ouvre pour choisir un domaine ; la sélection charge bien la page du domaine, mais le panneau reste ouvert et écrase le contenu que l'on vient d'ouvrir. Il faut donc le refermer à la main avec le bouton ☰ après chaque changement de domaine, alors que la sélection était précisément le geste qui devait donner accès à l'outline.

## What Changes

- **Repli automatique à la sélection.** Quand un domaine est choisi dans le panneau et que la fenêtre est un écran étroit (≤ 640 px, le seuil déjà utilisé par l'application), le panneau latéral se replie.
- **La page du domaine arrive panneau fermé.** Le repli emprunte le même état persisté que le bouton ☰ : la navigation étant un chargement complet, la page du domaine choisi est rendue avec le panneau déjà replié, et elle le reste après un rechargement ou un retour arrière.
- **Le panneau reste rouvrable.** Le bouton ☰ rouvre le panneau comme avant, sur la page du domaine choisi ; l'état replié est simplement celui que le bouton bascule.
- **Écran large inchangé.** Au-dessus de 640 px, sélectionner un domaine laisse le panneau dans l'état où il était : on garde la navigation latérale pour passer d'un domaine à l'autre.
- **Aucun changement de données, de route ni de balisage** : seul le comportement client du panneau change.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `domain-navigation` : l'exigence du panneau latéral gagne le repli automatique après la sélection d'un domaine sur un écran étroit, sans modifier les autres comportements du panneau (groupement par thème, surbrillance du domaine actif, état persisté, lecture seule).

## Impact

- **`public/app.js`** : l'état replié est factorisé dans une fonction unique, partagée par le bouton ☰ et par un écouteur délégué sur les liens de domaine du panneau.
- **`test/e2e/sidebar.spec.js`** : nouvelle suite e2e (serveur enfant, deux domaines) couvrant le repli sur smartphone, sa persistance, la réouverture par ☰ et l'absence de repli sur écran large.
- **`openspec/specs/domain-navigation/spec.md`** : nouvelle exigence reportée à l'archivage.
- **`public/sw.js`** : incrément de `CACHE_VERSION`, `app.js` étant précaché.
- **Aucune migration de données** : l'état vit dans `localStorage`, comme le repli manuel déjà existant.
