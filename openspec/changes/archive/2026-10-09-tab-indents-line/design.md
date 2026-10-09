## Context

Un domaine est un **arbre** (`projects[]`, `{id, title, status, collapsed, children[]}`) persisté sur S3 et rendu par `renderLine`/`renderOutline` (`server.js`) comme une **suite plate de lignes** : chaque `<li class="line">` porte `data-id`, `data-parent` et `data-depth` (indentation `--depth`), l'ordre vertical venant de `domain.displayOrder`. L'outline est re-rendu **côté serveur** et remplacé par htmx ou par affectation directe de `outerHTML` (`public/app.js`).

Le réindent existe déjà côté serveur : `reindentNode(domain, id, direction)` (`server.js`) implémente `'indent'` (la ligne devient le **dernier enfant de son frère précédent**, via `displayMoveToBlockEnd`) et `'outdent'` (la ligne devient le **frère suivant de son ancien parent**, via `displayMoveAfter`). Il est exposé par deux routes qui renvoient le fragment d'outline re-rendu :

- `POST /domaine/:slug/api/nodes/:id/indent`
- `POST /domaine/:slug/api/nodes/:id/outdent`

Ces routes sont aujourd'hui déclenchées uniquement par les boutons `→` / `←` du menu contextuel (`renderLine`), donc **à la souris**. Le seul clavier existant sur une ligne est le champ de renommage (`startRename` dans `public/app.js`) : `Entrée` (valide + crée une ligne sœur via `POST .../next`) et `Échap` (abandonne). Aujourd'hui, `Tab` dans ce champ n'est pas traité : le navigateur fait un **blur**, ce qui valide la ligne (`finish(true)`) et déplace le focus hors de l'outline.

Contraintes du projet : serveur Express + htmx, HTML rendu côté serveur, **un seul fichier client** (`public/app.js`), pas de framework ni de build, une seule route par opération, données JSON sur S3, aucune automatisation navigateur dans le dépôt (`npm test` ne lance que `test/passkey-flow.js`).

Arbitrages produit déjà rendus avec l'utilisateur :

1. `Tab` / `MAJ+Tab` agissent **dans les deux contextes** : champ de titre ouvert, et ligne sélectionnée hors édition ;
2. après un réindent réussi, on **reste en édition**, le **texte saisi est conservé** et le **curseur est conservé** ;
3. quand l'indentation est impossible, **rien ne se passe, silencieusement, sans requête**.

## Goals / Non-Goals

**Goals:**

- `Tab` sur la ligne courante monte son indentation d'un cran ; `MAJ+Tab` la descend d'un cran — en réutilisant **exactement** la sémantique existante de `reindentNode` (donc du bouton `→` / `←`).
- Fonctionner dans les deux contextes retenus (édition du titre ; ligne sélectionnée), sans jamais détourner `Tab` ailleurs (panneau latéral, hors outline).
- Après un réindent réussi, **conserver le contexte** (titre en cours de saisie enregistré, champ rouvert au même curseur ; sélection restaurée) pour pouvoir **enchaîner** les raccourcis.
- Cas impossibles : **aucune requête**, aucune modification, aucun déplacement de focus.
- Aucune route, aucun schéma, aucun format persisté, aucun style modifiés.

**Non-Goals:**

- Pas de refonte des boutons `→` / `←` du menu contextuel (ils restent, à l'identique).
- Pas d'autre raccourci clavier (navigation par flèches, création, suppression, statuts) : seul le réindent est demandé.
- Pas d'indentation **au sein du texte** du titre (pas de tabulation insérée dans le titre).
- Pas de nouvelle route ni d'enrichissement du contrat des routes `indent`/`outdent` (pas de code d'erreur, pas d'en-tête supplémentaire).
- Pas de refonte de l'outillage de test existant : `npm test` reste le parcours d'authentification côté serveur, les tests navigateur vivent dans une suite séparée (`npm run test:e2e`, voir décision 7).

## Decisions

### 1. Deux points d'entrée clavier, une seule opération de réindent

Un même chemin d'exécution `reindentLine(line, direction)` est atteint par deux écouteurs, parce que le focus ne se trouve pas au même endroit selon le contexte :

| Contexte | Focus | Écouteur |
| --- | --- | --- |
| Édition du titre | `.title-input` de la ligne | `keydown` du champ, déjà en place dans `startRename` |
| Ligne sélectionnée hors édition | `.bullet` de la ligne (le clic sur le bouton de sélection le focalise) | **nouvel** écouteur `keydown` au niveau du document (délégué, comme les autres interactions de ligne) |

Le traitement est armé sur `e.key === 'Tab'` **et** sans modificateur (`!e.ctrlKey && !e.altKey && !e.metaKey`), afin de laisser intacts `Ctrl+Tab` (onglets), `Alt+Tab` (fenêtres) et `Ctrl+MAJ+Tab`. La direction vient de `e.shiftKey`. Dans tous les cas traités, `e.preventDefault()` est appelé : c'est ce qui empêche le blur (contexte édition) et le déplacement de focus (contexte sélection).

L'écouteur document s'abstient dès qu'un champ de saisie (`input`, `textarea`, `select`, `[contenteditable]`) détient le focus — testé sur `document.activeElement` plutôt que sur la cible de l'événement, car certains navigateurs ne focalisent pas un bouton au clic (la cible serait alors `<body>`) — et exige qu'une `.line.selected-head` existe dans `#outline` : la navigation `Tab` normale du panneau latéral (formulaires domaine et thème) reste donc inchangée.

*Alternatives écartées :*
- **Ne traiter que le champ de titre** : laisse de côté le contexte « ligne sélectionnée » retenu par l'utilisateur, et oblige à entrer en édition pour indenter.
- **Ne traiter que la ligne sélectionnée** : ne règle pas le problème initial (dans le champ de titre, `Tab` continue de valider et de sortir de la ligne).
- **Un écouteur unique au niveau du document, y compris pour le champ** : possible, mais il faudrait y redécouvrir l'état interne de `startRename` (`done`, valeur en cours, offset de curseur) ; s'accrocher au `keydown` du champ réutilise l'état déjà présent.

### 2. Faisabilité testée côté client, le serveur reste l'autorité

Pour tenir l'arbitrage « aucune requête quand c'est impossible », le client teste la faisabilité **avant** d'appeler le serveur, à partir du DOM rendu par le serveur :

- **`Tab` (indenter)** possible **si et seulement si** la ligne a un **frère précédent** : on remonte les `.line` précédents de la suite plate jusqu'à la première ligne partageant le même `data-parent`. Absence → inerte.
- **`MAJ+Tab` (désindenter)** possible **si et seulement si** `data-parent` n'est pas vide (la ligne n'est pas à la racine). `data-parent` vide → inerte.

Ce test est **équivalent** à celui de `reindentNode` : `data-parent` et l'ordre des frères sont rendus depuis l'arbre, et une ligne **visible** ne peut pas avoir de frère masqué (une ligne n'est masquée que si un ancêtre est replié, auquel cas tous ses descendants le sont). Le serveur n'est donc pas modifié et reste seul juge : s'il était appelé dans un cas impossible, `reindentNode` renverrait le nœud inchangé (comportement actuel), mais le client évite ce re-rendu inutile qui détruirait le curseur.

*Alternatives écartées :*
- **Toujours appeler la route et déduire du résultat** : les routes `indent`/`outdent` répondent `200` et renvoient l'outline dans les deux cas (appliqué ou non) ; il faudrait **changer leur contrat** (en-tête ou code d'état), ce que la proposition exclut.
- **Faire confiance à la seule profondeur (`data-depth`)** : insuffisant, la suite plate entrelace sous-lignes et frères (une ligne insérée sous X s'affiche avant les sous-lignes de X) ; c'est `data-parent`, et non la profondeur, qui identifie les frères.

### 3. Continuité du contexte après le re-rendu

Le réindent passe par les routes existantes : la réponse **remplace tout `#outline`**, donc la ligne est un **nouvel élément** (même `data-id`, `data-parent` et `data-depth` mis à jour) et les classes de sélection comme l'état d'édition sont perdus. Le chemin d'exécution les restaure :

**Contexte édition**
1. Lire la valeur du champ et l'offset du curseur (`selectionStart`) **avant** toute requête.
2. Enregistrer le titre s'il a changé, comme le fait déjà `finish` (`PUT /domaine/:slug/api/nodes/:id`, qui répond `{ok:true}` sans re-rendre) — **le texte saisi n'est pas perdu**. Les deux appels sont **séquentiels** (`await`) : le `PUT` doit précéder le `POST` pour que l'outline re-rendu porte le bon titre.
3. `POST .../indent` ou `.../outdent`, puis remplacer `#outline` par le fragment reçu.
4. Retrouver la ligne par `.line[data-id="…"]` et **rouvrir le champ** sur son `.title` avec le **même offset de curseur**.

Le garde `done` de `startRename` est posé **avant** les requêtes (comme dans le chemin `Entrée` existant) : la disparition de l'ancien champ lors du remplacement de `#outline` ne peut donc pas déclencher un second enregistrement via `blur`. L'action de réindent est branchée sur la même mécanique que `next` (un troisième cas de `finish`), pour hériter de ce garde et du remplacement du champ par le titre.

`startRename(span, clientX, clientY, forceEnd, selectAll)` ne sait aujourd'hui placer le curseur qu'à la fin (`forceEnd`) ou tout sélectionner (`selectAll`). On lui ajoute un paramètre optionnel de **curseur explicite** (offset), utilisé par ce chemin. *Alternative écartée* : simuler un `clientX`/`clientY` de clic pour retomber sur la logique `caretOffsetAtPoint` — dépend de la mise en page, du défilement et de l'état du DOM fraîchement remplacé, donc fragile.

**Contexte ligne sélectionnée**
Après le remplacement, on **restaure la sélection** sur la ligne (mêmes classes que la tête de sélection : `selected-head` et, si le groupe était sélectionné, `selected` sur ses sous-lignes) et on **remet le focus sur son `.bullet`**, pour que le raccourci soit immédiatement répétable sans re-clic. Le menu contextuel, rendu par le serveur à l'intérieur de la ligne, réapparaît du seul fait de la classe `selected-head` (règle CSS existante).

*Alternative écartée* : laisser tomber la sélection (c'est ce qui se passe aujourd'hui après un clic sur un bouton du menu) — le raccourci deviendrait à usage unique, ce qui vide de son sens un raccourci clavier.

### 4. Le no-op silencieux est le seul retour d'erreur

Aucun message, aucun toast, aucun son : dans les cas impossibles, `preventDefault()` est appelé (le focus ne bouge pas, la ligne reste en édition) et rien d'autre ne se produit. C'est cohérent avec les boutons `→` / `←` actuels, qui ne produisent déjà aucun effet visible à la racine ou sur un premier enfant.

### 5. Documentation du pied de page

Le paragraphe `.hint` rendu par `renderShell` (`server.js`) énumère les interactions de ligne ; il reçoit la mention de `Tab` (indenter) et `MAJ+Tab` (désindenter), dans le ton et le format des phrases existantes. Aucun autre texte d'interface ne change.

### 6. Ré-injection de l'outline : `htmx.process` obligatoire (correctif constaté en recette)

Le fragment renvoyé par les routes de réindent n'est pas posé par un échange htmx mais par une affectation directe (`outlineEl.outerHTML = html`). Or **htmx n'observe pas le DOM** (le bundle `public/htmx.min.js` ne contient aucun `MutationObserver`) : les attributs `hx-post` / `hx-delete` de l'outline fraîchement injectée ne sont **jamais rattachés**, donc **tout le menu contextuel (statuts, indenter/désindenter, ajouter, supprimer) devient inerte** après un `Tab`. C'est le défaut signalé en recette (« les menus ne fonctionnent plus »).

Un helper unique `swapOutlineHtml(html)` remplace donc l'affectation directe : il pose le fragment puis appelle `htmx.process(fresh)` sur le nouvel `#outline`. Il est utilisé par les **trois** sites d'injection (les deux du réindent et celui d'`Entrée`/`next`, qui souffrait du même défaut **avant** ce change — le correctif bénéficie donc aussi à la création de ligne).

*Alternatives écartées :*
- **Passer par `htmx.ajax('POST', …)`** comme le font `toggle`/`move`/`status` : htmx traiterait le contenu, mais il faudrait enchaîner la restauration du curseur/de la sélection sur l'événement `htmx:afterSwap`, et la séquence `PUT` (titre) puis `POST` (réindent) deviendrait plus difficile à ordonner. `htmx.process` garde le `fetch` explicite et la séquence.
- **Ne corriger que les deux sites du réindent** : laisse `Entrée` casser les menus, ce qui contredit la non-régression attendue (tâche 6.9) et reproduirait le même symptôme par un autre chemin.

### 7. Recette navigateur : Playwright sur le Chrome installé, application en process

`test/e2e/reindent.spec.js` (`npm run test:e2e`) joue les touches dans un vrai navigateur. Trois choix structurent cette suite :

- **Chrome installé plutôt qu'un Chromium téléchargé** (`channel: 'chrome'` dans `playwright.config.js`) : aucun téléchargement de navigateur, la machine en a déjà un.
- **Application démarrée dans le process de test**, avec `DOCDOC_DATA_DIR` sur un dossier temporaire et `DOCDOC_ENV_FILE` neutralisé pour qu'un `.env` local ne fuie pas. C'est ce qui permet de **capturer le code à usage unique** (le mailer de développement l'écrit via `console.log`) sans lire un fichier de log ni dépendre d'un `webServer` externe, et de remettre l'outline de référence avant chaque test (`storage.writeJson` + `invalidateSpace`).
- **Authentificateur virtuel via CDP** (`WebAuthn.enable` + `addVirtualAuthenticator`, `isUserVerified` et `automaticPresenceSimulation`) : l'enrôlement passkey se déroule réellement dans le navigateur, sans matériel ni modification du code de production. La session obtenue est réutilisée par tous les tests via `storageState`.

*Alternatives écartées :*
- **`webServer` Playwright + lecture du code dans un fichier de log** : redirection de sortie à faire porter par la commande, dépendante du shell, et parsing de log à maintenir.
- **Chromium Playwright** : téléchargement inutile alors que Chrome est présent ; en prime le build déjà en cache (1217) ne correspond pas forcément à la version de Playwright installée.
- **Contourner l'authentification** (route de test ou session injectée) : ajouterait une surface d'authentification au code de production pour un besoin de test.

## Risks / Trade-offs

- **[Le `Tab` du champ de titre n'est plus une sortie de champ]** — changement de comportement volontaire : `Tab` valide désormais sans quitter l'édition (au lieu de valider et déplacer le focus). *Mitigation* : c'est la demande ; `Échap` et le clic hors de la ligne restent les sorties d'édition, et `MAJ+Tab` reste traité (donc plus de sortie arrière non plus). À valider en recette, car cela peut surprendre au premier usage.
- **[Divergence possible entre le test client et `reindentNode`]** (le client refuserait un réindent que le serveur aurait appliqué) → le test s'appuie sur `data-parent`/ordre des frères **rendus par le serveur**, et non sur une heuristique de profondeur ; l'invariant « ligne visible ⇒ ses frères sont visibles » garantit l'équivalence. En cas de doute résiduel, le bouton `→` / `←` du menu reste disponible et fait autorité.
- **[Perte du texte en cours de saisie lors du re-rendu]** → le titre est enregistré (`PUT`) **avant** le `POST` de réindent, séquentiellement ; le fragment re-rendu porte donc la valeur saisie.
- **[Curseur perdu après re-rendu]** → l'offset est capturé avant la requête et réappliqué à l'ouverture du nouveau champ, sur le même principe (`requestAnimationFrame`) que le positionnement existant au clic.
- **[Double enregistrement déclenché par le `blur` du champ supprimé]** → le garde `done` est posé avant les requêtes, comme dans le chemin `Entrée` existant.
- **[Réindent en rafale si la touche est maintenue]** (auto-répétition) → borné par la faisabilité (la ligne s'arrête au premier enfant, ou à la racine) et identique à des appuis répétés ; pas de traitement spécifique.
- **[Sélection restaurée = comportement non uniforme avec les boutons du menu]** (qui, eux, perdent la sélection après re-rendu) → assumé : la restauration est ce qui rend le raccourci clavier utilisable ; les boutons ne sont pas modifiés.
- **[Indenter sous un frère précédent replié fait disparaître la ligne]** — constaté à l'implémentation : si le frère précédent Y est replié, `Tab` fait de la ligne un enfant de Y, donc une descendante masquée ; après re-rendu la ligne n'est plus affichée (le client ne la retrouve pas et ne restaure ni curseur ni sélection). C'est un **comportement pré-existant du serveur**, partagé à l'identique par le bouton `→` du menu, et hors périmètre ici (aucune modification de `reindentNode` n'est prévue). Piste pour un change ultérieur : déplier le nouveau parent lors d'un réindent, ou refuser l'indentation dans ce cas. *Mitigation actuelle* : le client ne casse pas (il ne restaure simplement rien) et l'outline reste correct.
- **[Double réindent quand une ligne sélectionnée est aussi en cours d'édition]** — constaté à l'implémentation : `finish` retire le champ **synchroniquement** (`input.replaceWith`), donc au moment où l'événement `Tab` remonte jusqu'à l'écouteur document, `document.activeElement` est déjà `<body>` et la ligne (encore `selected-head`) serait indentée une **seconde** fois. *Mitigation* : `e.stopPropagation()` dans le gestionnaire du champ, plus un garde `document.querySelector('.title-input')` dans l'écouteur document (ceinture et bretelles, le mode d'échec étant silencieux).
- **[Outline injecté non rattaché par htmx → menus inertes]** — défaut **effectivement rencontré en recette** (voir décision 6) : l'affectation directe de `outerHTML` laisse les `hx-*` non traités, donc le menu contextuel ne répond plus après un `Tab`. *Mitigation* : `swapOutlineHtml()` appelle `htmx.process()` sur le nouvel outline, aux trois sites d'injection (réindent ×2, `Entrée`).
- **[Sélection restaurée balayée par le `mouseout` du re-rendu]** — le remplacement de `#outline` retire la ligne survolée, ce que le navigateur peut signaler comme une sortie de ligne ; l'écouteur `mouseout` effacerait alors la sélection que le re-rendu vient de restaurer (menu refermé aussitôt). *Mitigation* : l'écouteur ignore les événements dont la ligne n'est plus connectée (`head.isConnected`), une ligne détachée ne pouvant pas être « quittée par le pointeur ».
- **[Couverture clavier]** → les deux contextes sont couverts par une suite Playwright (`test/e2e/reindent.spec.js`) qui joue les touches sur le Chrome installé : curseur et texte conservés, enchaînement de deux `Tab`, sélection conservée, no-op sans requête, et **menus fonctionnels après un re-rendu**. Ce dernier point a été validé par **test de mutation** : en désactivant `htmx.process()`, les deux scénarios de menu échouent — la suite a donc bien des dents. Restent à confirmer à la main (tâche 6.10) le glisser-déposer, le repli/dépli et le lien profond.

## Migration Plan

1. Déployer `public/app.js` et `server.js` (application mono-service : un redémarrage suffit).
2. Aucune migration de données : aucune route, aucun champ persisté, aucun format ne change ; `displayOrder` et l'arbre restent tels quels.
3. Recette sur un domaine de démonstration : `Tab` / `MAJ+Tab` dans le champ de titre (curseur et texte conservés, enchaînement de deux `Tab`), puis sur une ligne sélectionnée ; vérifier les cas impossibles (premier enfant, racine) et la non-régression de `Tab` dans le panneau latéral ; vérifier que les boutons `→` / `←` du menu sont inchangés.
4. Rollback : redéployer la version précédente. Aucune donnée n'est transformée, donc le retour arrière est sans effet de bord (les indentations déjà appliquées restent, simplement elles ne sont plus accessibles au clavier).

## Open Questions

- Aucune bloquante. Point à confirmer en recette : le maintien de l'édition après `Tab` (le champ ne se ferme plus) est-il bien perçu comme un progrès, ou faut-il à terme une sortie d'édition explicite au clavier (par exemple `Échap` seul sortant, `Tab` restant dans l'outline) ?
