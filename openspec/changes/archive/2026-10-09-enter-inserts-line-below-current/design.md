## Context

L'outline d'un domaine est un **arbre** (`projects[]`, chaque nœud `{id, title, status, collapsed, children[]}`) persisté sur S3 (`domains/<id>.json`) et rendu par `renderNode`/`renderOutline` (`server.js`) sous forme d'un **arbre imbriqué** :

```html
<ul id="outline"><li class="node">
  <div class="line" data-id="M">…</div>
  <ul class="children"><li class="node">…</li></ul>
</li></ul>
```

Conséquence structurelle : dans ce DOM, tout ce qui suit la ligne X à l'écran est **soit** l'un de ses descendants, **soit** l'un de ses frères suivants — jamais un frère *avant* ses descendants. Or la demande est exactement cet ordre-là : *Entrée en fin de ligne → nouvelle ligne au même niveau, juste sous la ligne courante, avant ses sous-lignes*.

État actuel vérifié (instance locale, données de démonstration) : `POST /domaine/:slug/api/nodes/:id/next` appelle `createNodeAfter`, qui insère déjà un **frère** dans l'arbre, mais le rendu le peint après toute la descendance :

```
● Rénovation cuisine
    ○ Définir le budget
    ○ Choisir les meubles
        ○ Comparer 3 devis
        ○ Nouvelle tâche   ← ligne créée par Entrée, affichée hors contexte
```

Contraintes du projet : serveur Express + htmx, rendu HTML côté serveur, un seul fichier client (`public/app.js`), pas de framework, pas de build, données persistées en JSON sur S3, API domaine-scoped `/domaine/:slug/api/...`. Les comportements existants (repli/dépli, sélection ligne + sous-lignes, statuts en cascade, glisser-déposer, ancres profondes `?reveal=<id>#node-<id>`, thèmes) sont couverts par `openspec/specs/` et ne doivent pas régresser. Décision produit déjà arbitrée avec l'utilisateur : la nouvelle ligne reste **au même niveau** (frère/sœur) et s'affiche **au-dessus** des sous-lignes (option B de l'arbitrage), pas comme première sous-ligne.

## Goals / Non-Goals

**Goals:**

- Une ligne insérée comme frère suivant d'une ligne X s'affiche **juste sous X, avant les sous-lignes de X**, que X ait ou non des sous-lignes et qu'elle soit repliée ou dépliée.
- Conserver la hiérarchie, le repli, les statuts, la sélection, le glisser-déposer, les ancres et les deep-links à comportement identique.
- Zéro migration manuelle : les documents de domaine existants s'affichent à l'identique.
- Règle d'insertion unique et prévisible pour Entrée, « Ajouter une tâche », indenter/désindenter, glisser-déposer.

**Non-Goals:**

- Entrée au milieu du texte ne découpe pas le titre (aucun partage de texte) : le comportement de création reste identique, seule la position d'affichage change.
- Pas de changement de routes, d'API HTTP, de schéma de hiérarchie, ni du stockage S3 lui-même.
- Pas de passage à un modèle « liste plate » stocké (l'arbre reste la source de vérité de la hiérarchie).
- Pas de refonte visuelle (indentation conservée à 1,6 rem par niveau).

## Decisions

### 1. Rendu plat de l'outline, la profondeur portée par chaque ligne

`renderOutline` émet une **suite plate** de lignes, l'arbre n'étant plus traduit en imbrication DOM :

```html
<ul id="outline" class="outline">
  <li class="line" id="node-M" data-id="M" data-parent="" data-depth="0">…</li>
  <li class="line" id="node-N" data-id="N" data-parent="" data-depth="0">…</li>
  <li class="line" id="node-C1" data-id="C1" data-parent="M" data-depth="1">…</li>
</ul>
```

`.line` passe du `<div>` interne au `<li>` lui-même (mêmes styles : `display:flex`, `position:relative` pour le menu ancré, `:target` pour l'ancre profonde). Chaque ligne porte aussi `data-parent` : c'est ce qui permet d'identifier un sous-arbre malgré l'entrelacement (voir décision 5). L'indentation devient `margin-left: calc(var(--depth) * 1.6rem)` (variable CSS posée inline) — **une marge et non un padding** : le menu contextuel est en `position:absolute; left:0` et doit rester aligné sur la ligne indentée (avec un padding, `left:0` se réfère au bord de la boîte et le menu se décalerait vers la gauche). La règle `.outline .children` disparaît. Le repli est traité **au rendu** : les descendants d'une ligne repliée ne sont pas émis du tout (comportement déjà en place aujourd'hui), et la visibilité est résolue **par ascendance** (une ligne insérée sous une ligne repliée est une sœur, donc affichée).

*Alternatives écartées :*
- **Garder l'arbre imbriqué** : impossible d'afficher un frère avant les descendants d'une ligne, les descendants étant dans le `<li>` de cette ligne.
- **Rendre la ligne insérée à l'intérieur du `<li>` de sa ligne mère** (entre la ligne et le conteneur `.children`) : le DOM ne correspondrait plus aux données (une ligne sœur dans le nœud d'une autre), ce qui casse le repli, la portée de sélection, le fantôme de glisser et la détection de dépôt invalide — rustines à chaque endroit.
- **Faire de la nouvelle ligne la première sous-ligne** (option A) : écartée par l'utilisateur (la ligne doit rester au même niveau).
- **Faire adopter les sous-lignes existantes par la nouvelle ligne** (option C) : écartée par l'utilisateur (re-parentage destructif).

### 2. Ordre d'affichage explicite par domaine (`displayOrder`), arbre inchangé

L'arbre reste la seule source de vérité de la **hiérarchie** ; un **ordre d'affichage** lui est associé : `domain.displayOrder = [nodeId, …]`, persisté avec le domaine (nouveau champ `displayOrder` du document JSON). Le rendu parcourt `displayOrder`, résout chaque id vers son nœud et sa profondeur (calculée par la chaîne des parents), et saute les nœuds masqués par un ancêtre replié.

Le nom est `displayOrder` et non `order` : le domaine possède **déjà** un champ `order` (position du domaine dans le panneau latéral, utilisé par `nextOrder()` et `rebuildDomainList`). Réutiliser `order` aurait cassé le tri de la barre latérale.

Pourquoi un ordre explicite : l'ordre voulu (M, N, C1…Cn) **n'est pas un parcours d'arbre**. Aucun parcours déterministe de l'arbre ne peut placer un frère avant les enfants de son frère précédent sans réordonner le reste de l'outline (un parcours « nœud, puis frères suivants, puis enfants » ferait passer les enfants d'un frère sous le frère suivant).

*Alternatives écartées :*
- **Stocker l'outline à plat** (`{id, title, status, collapsed, depth}`) : source de vérité unique, mais réécriture de toutes les opérations (`findNode`, `deleteNode`, `reindentNode`, `moveNode`, statuts de sous-arbre, repli, révélation) **et** migration du format persisté — trop large pour le besoin.
- **Clé de rang fractionnaire par nœud** (`seq` global trié) : un champ par nœud au lieu d'une liste, mais impose une renumérotation et un calcul de rang médian ; pas plus simple à valider qu'une liste d'ids.
- **Dériver l'ordre de l'arbre à chaque rendu** : impossible (cf. ci-dessus).

### 3. Règle d'insertion unifiée : « frère suivant → juste sous la référence ; dernier enfant → fin du bloc »

| Opération | Place dans l'arbre | Position affichée |
| --- | --- | --- |
| Entrée en fin de ligne | frère suivant de X | juste sous X, avant les sous-lignes de X |
| « Ajouter une tâche » (+) | dernier enfant de X | après la dernière ligne du bloc de X |
| Indenter | dernier enfant du frère précédent Z | après la dernière ligne du bloc de Z |
| Désindenter | frère suivant de l'ancien parent Y | juste sous Y, avant les sous-lignes restantes de Y |
| Glisser « au-dessus de Y » | frère précédent de Y | juste avant Y |
| Glisser « en dessous de Y » | frère suivant de Y | juste sous Y, avant les sous-lignes de Y |
| Glisser « dans Y » | dernier enfant de Y | après la dernière ligne du bloc de Y |

C'est une généralisation directe de la demande : « la ligne insérée apparaît juste sous la ligne de référence », appliquée partout, plutôt qu'un cas particulier réservé à Entrée (un déplacement « en dessous » qui atterrirait après tout le sous-arbre serait perçu comme une incohérence).

### 4. Invariant d'ordre, canonisation et rendu défensif

`ensureDisplayOrder(projects, displayOrder)` est appelé au chargement d'un domaine et après toute mutation (`persistDomain` le normalise avant chaque écriture, `renderOutline` le normalise aussi) :

- ordre absent ou vide → **parcours canonique** (pré-ordre : chaque sous-ligne juste après son parent) ;
- id inconnu (nœud supprimé) → ignoré ;
- id en double → première occurrence conservée ;
- nœud absent de l'ordre → inséré **après le bloc de son parent** (ou en fin d'outline pour un projet racine).

Le rendu émet les nœuds atteints par cet ordre réparé : une liste d'ordre incomplète ne peut donc **jamais** masquer une ligne. Limite assumée : une liste complète mais **désordonnée** (édition manuelle du document) n'est pas re-triée — elle n'occulte aucune ligne, elle n'affecte que la position verticale. Toutes les mutations de l'application maintiennent l'ordre (vérifié par tests).

Le « bloc » d'une ligne X (utilisé par l'insertion en dernier enfant, l'indentation et les déplacements) n'est **pas** une plage contiguë de profondeur : comme une ligne insérée sous X s'affiche avant les sous-lignes de X, le bloc de X est « la ligne X suivie de toutes ses lignes descendantes affichées », repérées par **ascendance** (`isTreeAncestor`), à l'intérieur de la région de X (les lignes comprises entre X et la première ligne de profondeur strictement inférieure).

### 5. Sélection, portée des statuts et glisser-déposer recalculés par ascendance

`public/app.js` gagne un helper `subtreeRows(line)` : les lignes suivantes de `#outline` (jusqu'à la sortie de la région de `line`, c'est-à-dire la première ligne de profondeur strictement inférieure) **dont la chaîne des parents (`data-parent`) contient `line`**. La profondeur seule ne suffit pas : une ligne insérée sous X s'affiche entre X et ses sous-lignes, donc les sous-lignes ne sont pas les lignes qui suivent immédiatement, et une ligne de même profondeur que X ne marque pas la fin de son sous-arbre. Ce helper remplace les usages de `.node` / `.children` :

- sélection (clic sur le bouton) : `targets = [line, ...subtreeRows(line)] ;` `hadSubtreeSelected = subtreeRows(line).some(l => l.classList.contains('selected'))` ;
- portée des statuts (attribut `hx-vals` rendu par le serveur) : `js:{status:"…", scope: window.outlineSubtreeHasSelected(this) ? "subtree" : "head"}` — la fonction est exportée sur `window` par `app.js` et reçoit le bouton cliqué (`this`) ;
- fantôme de glisser : les lignes du sous-arbre sont clonées dans un conteneur hors écran (`position:absolute; left:-9999px`) posé dans le document (exigence de `setDragImage`) et retiré au `dragend` ;
- dépôt invalide : cible = ligne déplacée ou une ligne de `subtreeRows(ligne déplacée)`.

### 6. API et persistance

Aucune route nouvelle ni modifiée. `POST /api/nodes/:id/next` (Entrée) garde son contrat (en-tête `X-New-Node-Id`, fragment HTML de l'outline) : seule la position d'affichage change, côté serveur. `normalizeDomain` accepte/valide `displayOrder` (tableau d'ids) ; `domainPayload` le persiste. Un document sans `displayOrder` reste lisible (canonisé au chargement).

## Risks / Trade-offs

- **[Régression des interactions liées à l'imbrication DOM]** (sélection, portée des statuts, glisser-déposer, repli) → tous les points d'appui `.node` / `.children` recensés (4 dans `app.js`, expression `scopeExpr` dans `server.js`, règles CSS `.outline .children`) et remplacés par le calcul par ascendance ; scénarios dédiés dans les specs ; une passe manuelle en navigateur reste recommandée (voir tâche 6.9).
- **[Sous-arbre non contigu]** — corrigé en cours d'implémentation : identifier un sous-arbre par la seule profondeur était faux dès qu'une ligne sœur s'intercale avant les sous-lignes (le repli ne masquait plus les sous-lignes, la sélection et le fantôme de glisser en oubliaient). Le calcul par ascendance (`data-parent` côté client, `isTreeAncestor` côté serveur) remplace la profondeur ; couvert par des tests dédiés.
- **[Ordre d'affichage désynchronisé de l'arbre]** (nœud invisible ou dupliqué) → `ensureDisplayOrder` au chargement, avant chaque écriture et à chaque rendu ; le repli, les statuts et la visibilité ne dépendent jamais de l'ordre d'affichage.
- **[Fantôme de glisser-déposer]** : `setDragImage` exige un élément rendu → conteneur hors écran (`.drag-ghost`) ajouté au document au `dragstart` et supprimé au `dragend`.
- **[`hx-vals` en `js:` dépendant d'une fonction globale]** : si `app.js` n'est pas chargé, la portée retombe sur `"head"` (garde `window.outlineSubtreeHasSelected && …` dans l'expression rendue).
- **[Sémantique de déplacement modifiée]** : un dépôt « en dessous de Y » place désormais la ligne avant les sous-lignes de Y (au lieu d'après tout le bloc) → assumé et documenté (règle unifiée, décision 3) ; c'est le seul changement de comportement non demandé explicitement, il découle de l'option B retenue.
- **[Menu contextuel et indentation]** : le menu est ancré en `left:0` sur la ligne ; l'indentation se fait donc par `margin-left` (et non `padding-left`) pour que le menu reste aligné sur la ligne indentée.
- **[Taille du DOM]** : le rendu plat émet le même nombre de lignes que le rendu imbriqué (moins de conteneurs) ; coût O(n) par mutation pour l'ordre, négligeable à cette échelle.
- **[Rollback]** : le code précédent ignore le champ `displayOrder` (et le perd à la première écriture) ; aucun format de données n'est cassé dans l'autre sens, donc un retour arrière est sûr (l'outline reprend l'ordre canonique).

## Migration Plan

1. Déployer le nouveau `server.js` + `public/app.js` + `public/style.css` (application mono-service, redémarrage suffisant).
2. Au premier chargement de chaque domaine, `ensureDisplayOrder` canonise l'ordre (aucune écriture forcée : la canonisation est faite en mémoire et persistée à la mutation suivante).
3. Vérifier sur un domaine de démonstration : Entrée sur une ligne à sous-lignes, repli/dépli, sélection + statut en cascade, glisser-déposer, ancre `?reveal=<id>#node-<id>`.
4. Rollback : redéployer la version précédente ; l'ordre d'affichage est recalculé canoniquement, aucune donnée n'est perdue.

## Open Questions

- Aucune bloquante. Point à confirmer pendant la recette : après un glisser-déposer « en dessous de Y », l'utilisateur attend-il la nouvelle règle (juste sous Y, avant ses sous-lignes) ou l'ancienne (après tout le bloc de Y) ? La règle unifiée est retenue par défaut.
