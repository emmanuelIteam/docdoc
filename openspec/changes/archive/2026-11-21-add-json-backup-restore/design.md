## Context

L'espace d'un compte est réparti sous `users/{userId}/` : `themes.json` (la palette, un tableau ordonné), `domains/{id}.json` (un objet par domaine, avec `id`, `name`, `slug`, `order`, `labels`, `projects` et `displayOrder`) et `archive/{id}.json` (les mêmes objets, déplacés lors de l'archivage). `account.json` et les index `users/by-email/` et `users/by-credential/` portent l'identité et les passkeys. `server.js` charge l'espace en mémoire (`spaceFor`) et sérialise les écritures par `space.writeQueue` ; le portage Rust fait de même avec `AppState.spaces` et `Space`.

La page Administration rend déjà trois sections (thèmes, domaines, archives) et les mutations qui en partent reviennent sur `/administration`. L'outline est un arbre `projects` doublé d'un ordre vertical plat `displayOrder` ; les titres peuvent contenir des liens internes `/domaine/<slug>?reveal=<id>#node-<id>`. Les identifiants et les slugs sont donc des données fonctionnelles, pas des détails internes.

Aucun des deux serveurs n'a de parseur multipart : `express.json()` est monté avec sa limite par défaut (100 ko) et axum applique 2 Mo aux corps. Une sauvegarde complète peut dépasser ces limites ; la restauration reçoit un document JSON, pas un formulaire multipart.

## Goals / Non-Goals

**Goals :**

- Un export JSON unique, lisible, versionné, qui décrit tout ce que l'utilisateur peut voir et gérer dans son espace : thèmes, domaines actifs, archives.
- Une restauration qui remet l'espace dans l'état du fichier, y compris après une perte de compte ou une suppression accidentelle.
- La conservation des identifiants, des slugs et des ordres pour ne casser ni les liens internes ni les URL.
- Un refus en bloc et sans écriture de tout fichier invalide, avec un message compréhensible.
- Une opération scopée au compte de la session, sans toucher aux identifiants ni aux autres comptes.
- Le même comportement dans `server.js` et dans `rust/`.

**Non-Goals :**

- Aucune sauvegarde des passkeys, de l'adresse email ou des index de compte : ils ne doivent pas être restaurables depuis un fichier, sous peine de permettre l'usurpation d'un compte.
- Aucune fusion ni import partiel : la restauration remplace tout l'espace (voir D3), pas un domaine isolé.
- Aucun historique de versions côté serveur, aucune sauvegarde automatique planifiée, aucune purge des sauvegardes : l'utilisateur garde ses fichiers.
- Aucun format d'import d'une autre application, aucun schéma JSON publié séparément.
- Aucune modification du format des objets S3 existants ni des routes existantes.

## Decisions

### D1 — Un document unique, autoportant et versionné

Le fichier est un objet JSON :

```json
{
  "format": "docdoc-backup",
  "version": 1,
  "exportedAt": "2026-11-21T17:45:00.000Z",
  "themes": [{ "id": "t1", "name": "Maison", "color": "#2f6f4e" }],
  "domains": [
    {
      "id": "d1",
      "name": "Voyages",
      "slug": "voyages",
      "order": 0,
      "labels": ["t1"],
      "projects": [
        { "id": "n1", "title": "Réserver le camping", "status": "todo", "collapsed": false, "children": [] }
      ],
      "displayOrder": ["n1"]
    }
  ],
  "archives": []
}
```

`format` et `version` permettent de refuser explicitement un fichier étranger ou produit par une version future. `exportedAt` est informatif. Les trois tableaux sont toujours présents, même vides. Le fichier est indenté et encodé en UTF-8 pour rester lisible et diffusable.

*Alternatives écartées :* un fichier ZIP avec un objet par domaine (illisible sans outil, impossible à valider d'un coup) ; un format ligne à ligne (perte de la hiérarchie et de l'ordre) ; réutiliser tel quel le contenu du bucket (il faudrait connaître les clés et le préfixe du compte, et le fichier ne serait pas autoportant).

### D2 — Le périmètre est l'espace visible, pas le compte

L'export contient les thèmes, les domaines actifs et les archives. Il ne contient ni `account.json`, ni les passkeys, ni les index `by-email`/`by-credential`. La restauration réécrit uniquement `themes.json`, `domains/*.json` et `archive/*.json` sous le préfixe du compte de la session ; elle ne touche jamais `account.json` ni les index.

*Pourquoi :* restaurer une passkey depuis un fichier téléchargé reviendrait à accepter une clé d'authentification fournie par le porteur du fichier ; un fichier de sauvegarde doit rester un fichier de données. Le compte et la session sont l'identité, pas la sauvegarde.

*Alternatives écartées :* inclure les passkeys (risque d'usurpation, format WebAuthn à maintenir) ; inclure l'adresse email (donnée personnelle inutile au contenu) ; restaurer dans un nouveau compte (hors périmètre, l'utilisateur recrée son compte par le parcours d'enrôlement existant).

### D3 — La restauration remplace l'espace entier

Le mode unique est le remplacement : après restauration, les thèmes, domaines et archives du compte sont exactement ceux du fichier ; les objets absents sont supprimés. La confirmation est explicite (case à cocher dans le formulaire, `confirm=replace` exigé par le serveur) et la copie de la section prévient que les données actuelles seront remplacées.

*Pourquoi :* « restaurer » doit produire un état connu et reproductible. Une fusion laisserait cohabiter des données d'époques différentes, avec des questions sans bonne réponse (que faire d'un domaine du même id ? d'un domaine absent du fichier ? d'un thème renommé ?). Le remplacement est aussi le seul mode qui restaure un espace vide ou recréé.

*Alternatives écartées :* fusion par id (résultat imprévisible, ne supprime jamais rien, ne répare pas une suppression) ; import dans un domaine isolé (demande différente, et un domaine exporté seul ne porterait pas les thèmes) ; mode « ajouter seulement » (laisse les données corrompues en place).

### D4 — Tout valider avant d'écrire, refuser en bloc

Le serveur construit une représentation validée en mémoire avant la première écriture. Règles : objet racine, `format === "docdoc-backup"`, `version === 1`, trois tableaux ; thèmes avec `id`, `name` et `color` non vides et ids uniques ; domaines et archives avec `id`, `name` et `slug` strings, `projects` tableau, `labels` tableau, `order` numérique ; nœuds avec id non vide, titre string ou absent (défaut vide), statut absent ou valide pour le modèle, enfants tableau ; ids uniques entre domaines et archives et, dans un domaine, entre nœuds ; slugs uniques entre domaines actifs ; chaque libellé référence un thème du document. `displayOrder` est réparé avec `ensureDisplayOrder` et n'est pas une condition de refus.

Un document invalide ne doit pas produire une restauration partielle : le refus est global (400 corps illisible, 413 trop volumineux, 415 type de contenu non JSON, 422 document invalide) et aucune écriture n'a eu lieu. Un message en français désigne le premier problème (domaine ou nœud concerné).

*Alternatives écartées :* valider à mesure des écritures (une erreur au dixième domaine laisse un espace mélangé) ; ignorer les objets invalides comme le fait le chargement tolérant (une restauration silencieusement partielle est pire qu'un refus) ; réutiliser `normalizeDomain` seul (il filtre les nœuds invalides et les libellés orphelins au lieu de les signaler).

### D5 — Écrire les nouveaux objets avant de supprimer les absents

Séquence : (1) attendre la fin des écritures en cours (`space.writeQueue`), (2) écrire `themes.json`, (3) écrire chaque domaine, (4) écrire chaque archive, (5) supprimer les clés `domains/` et `archive/` du compte absentes du document, (6) invalider l'espace en cache, (7) rediriger.

Si une écriture échoue avant l'étape 5, aucun objet existant n'a été supprimé : la restauration peut être relancée avec le même fichier. Si l'échec survient à l'étape 5, tous les objets du fichier sont déjà écrits et les survivants sont des objets hors fichier que la prochaine restauration supprimera. La restauration est idempotente.

*Pourquoi :* un stockage objet n'offre pas de transaction multi-objets. Cet ordre garantit qu'une panne ne détruit jamais une donnée qui n'a pas d'équivalent dans le fichier. Les thèmes sont écrits en premier pour que les libellés des domaines restent valides pendant l'opération.

*Alternatives écartées :* supprimer d'abord puis écrire (une panne perd tout) ; copier l'espace actuel dans un objet temporaire puis le remplacer (nécessite un manifeste et une reprise, hors périmètre) ; verrouiller tout l'espace (les requêtes sont déjà servies par un seul processus, mais un autre onglet peut muter pendant la restauration ; le remplacement reste le dernier écrivain).

### D6 — Conserver identifiants, slugs et ordres

L'export écrit les ids, les slugs, `order` et `displayOrder` tels que l'application les sert, et la restauration les réutilise tels quels. Elle ne régénère pas les slugs.

*Pourquoi :* un titre peut contenir un lien `/domaine/<slug>?reveal=<id>#node-<id>` ; les favoris, les liens copiés et les liens de tâche pointent vers ces valeurs. Régénérer un slug ou un id après restauration casserait silencieusement ces liens et changerait l'URL du domaine. L'ordre vertical et l'ordre du panneau font aussi partie de l'état restauré.

*Conséquence :* deux domaines actifs qui partageraient un slug dans le fichier sont refusés (plutôt que renommés), car renommer casserait les liens sans que l'utilisateur l'ait demandé.

*Alternatives écartées :* régénérer les ids (perte des liens internes) ; régénérer les slugs en cas de collision (restauration non fidèle) ; ignorer `displayOrder` et recalculer un ordre canonique (perte de l'ordre voulu, notamment après déplacement de lignes).

### D7 — Export par lien, restauration par `fetch` JSON, limite de 10 Mo

L'export est un `GET` avec `Content-Disposition: attachment` ; un `<a href="/api/backup" download>` suffit et fonctionne sans JavaScript. La restauration utilise un `<input type="file">` ; `public/app.js` lit le fichier et l'envoie en `fetch` avec `Content-Type: application/json`, après contrôle de la case de confirmation. Le serveur reçoit le document brut, pas un formulaire multipart.

*Pourquoi :* aucun des deux serveurs n'a de parseur multipart, et le document est déjà du JSON. Un champ `<input type="file">` soumis sans JavaScript enverrait du multipart, que le serveur ne sait pas lire ; le formulaire est donc amélioré par JavaScript, et une note l'indique.

*Limite :* 10 Mo côté client et côté serveur (413 au-delà). Node monte un parseur `express.raw({ type: 'application/json', limit: '10mb' })` sur `/api/restore` avant le `express.json()` global (dont la limite de 100 ko reste inchangée) ; Rust applique `DefaultBodyLimit::max(10 * 1024 * 1024)` à la seule route de restauration.

*Alternatives écartées :* ajouter une dépendance multipart (deux implémentations à maintenir pour un seul formulaire) ; un `<textarea>` où coller le JSON (illisible pour un fichier de plusieurs centaines de kilo-octets) ; relever la limite globale à 10 Mo (élargit tous les corps, y compris les routes d'authentification).

### D8 — Une section dans Administration, un succès signalé par l'URL

La section `#admin-backup` est rendue après Archives, avec l'encart, le lien et un `<details>` de restauration. En cas de succès, le serveur redirige vers `/administration?restaure=ok#admin-backup` ; la page rend un message de succès statique quand le paramètre vaut exactement `ok`. En cas d'échec, la requête `fetch` reste sur la page et affiche le message du serveur dans `#restore-status`.

*Pourquoi :* la page Administration est déjà la surface de gestion ; un `<details>` garde l'action destructrice discrète sans ajouter d'état. Le paramètre d'URL évite un stockage de message temporaire et rend le succès testable. La valeur n'est comparée qu'à `ok`, jamais insérée comme du HTML.

*Alternatives écartées :* un message en session (nouvel état à maintenir et à purger) ; une page dédiée `/sauvegarde` (deuxième surface de gestion) ; un message uniquement côté client (perdu au rechargement, et le formulaire n'a de toute façon pas de repli sans JavaScript).

### D9 — Même contrat pour Node et Rust

Les deux serveurs exposent les mêmes routes, le même format, les mêmes codes d'erreur et le même balisage (mêmes ids et classes). Les helpers peuvent différer, mais un fichier exporté par l'un doit être restaurable par l'autre.

*Pourquoi :* la production sert le portage Rust alors que les tests et le développement utilisent Node ; un format différent selon le serveur rendrait les sauvegardes non portables.

*Alternatives écartées :* n'implémenter que dans Node (la production ne l'aurait pas) ; n'implémenter que dans Rust (les tests Playwright et la référence de développement ne l'auraient pas).

## Risks / Trade-offs

- **Restauration destructive** : un fichier ancien ou erroné remplace des données plus récentes. La confirmation et l'avertissement limitent le risque, mais il n'y a ni historique ni corbeille. Recommandation explicite : exporter avant de restaurer. Une sauvegarde automatique avant restauration est une évolution possible, hors périmètre.
- **Pas d'atomicité multi-objets** : une panne au milieu laisse un espace partiellement restauré. L'ordre d'écriture (nouveaux objets avant suppression) garantit qu'aucune donnée du fichier n'est perdue et que la relance est idempotente ; l'utilisateur peut réessayer.
- **Concurrence** : une mutation depuis un autre onglet pendant la restauration peut être écrasée (dernier écrivain). L'opération est courte et destinée à un usage personnel ; aucun verrou n'est ajouté.
- **Objets illisibles ignorés à l'export** : un domaine ou une archive que l'application ne sait pas déjà lire n'entre pas dans le fichier ; s'il est supprimé à la restauration, il l'aurait de toute façon été par une mutation ultérieure. L'export décrit l'espace tel que l'application le sert.
- **Fichier volumineux** : 10 Mo couvrent très largement un espace textuel ; au-delà, le refus est explicite. Un espace anormalement gros ne peut pas être restauré.
- **Version future** : un fichier produit par une version ultérieure est refusé (422) plutôt que partiellement interprété ; il faudra mettre à jour l'importateur.
- **Fuite du fichier** : le fichier contient tout le contenu de l'espace (titres, thèmes, archives) mais aucune credential. Il doit être conservé comme une donnée personnelle.
- **Pas de JavaScript** : l'export fonctionne, la restauration non ; la section l'indique. C'est cohérent avec le reste de l'application, qui utilise htmx pour ses mutations.

## Migration Plan

Aucune migration de données : le format des objets S3 ne change pas, aucune clé n'est ajoutée et aucune route existante n'est modifiée. Le déploiement peut se faire dans n'importe quel ordre ; un serveur qui ne connaît pas encore les routes laisse simplement la section absente de l'ancien rendu. Les fichiers exportés par la version courante portent `version: 1`. Retour arrière : retirer les deux routes, la section, le JavaScript et les styles ; les données et les fichiers exportés restent lisibles, et aucune donnée n'a été transformée par l'export.

## Open Questions

- Faut-il proposer, en plus du remplacement, une fusion par identifiant pour récupérer un domaine isolé ? Reporté : le remplacement couvre le besoin de restauration, et la fusion demande des règles de conflit qui n'ont pas été spécifiées.
- Faut-il conserver automatiquement une copie de l'espace avant chaque restauration ? Reporté : cela ajoute un stockage, une purge et une interface de reprise ; l'utilisateur peut exporter avant de restaurer.
- Faut-il exposer un export par domaine ? Reporté : la sauvegarde demandée porte sur l'espace entier.
