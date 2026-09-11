## Contexte

L'outliner rend une liste à puces hiérarchique où chaque ligne (`.line`) est un nœud avec un `data-id` globalement unique et persistant (un UUID généré par `genId()` et stocké dans le JSON du domaine). Le rendu est entièrement côté serveur (`renderNode`/`renderOutline` dans `server.js`) ; l'outline est renvoyée à chaque chargement de page complet (`/domaine/:slug`) et re-rendue via htmx lors des nombreuses mutations de nœuds (statut, ajout, indentation, désindentation, suppression, déplacement, repli/dépli).

Deux faits contraignent chaque choix de conception ici :

1. **La cible d'ancre existe déjà mais n'est pas exposée.** L'élément `.line` d'une ligne porte `data-id` mais **pas d'attribut `id`**, donc le navigateur n'a ni cible de fragment native, ni de `:target` à styler.
2. **Les nœuds repliés ne rendent pas du tout leurs enfants.** Dans `renderNode`, `children` n'est émis que lorsque le nœud n'est pas replié :
   ```js
   const children = !collapsed && hasKids
     ? `<ul class="children">…</ul>` : '';
   ```
   Donc un nœud caché sous un ancêtre replié **n'existe pas dans le DOM**. Impossible de défiler jusqu'à lui, de le sélectionner ou de le surligner tant que ses ancêtres ne sont pas rendus dépliés. La partie fragment d'une URL est côté client uniquement et n'est jamais envoyée au serveur, donc un simple `#node-<id>` ne peut pas faire déplier quoi que ce soit côté serveur.

L'utilisateur veut : que chaque ligne projet/tâche soit une ancre de la page, afin qu'un lien direct puisse pointer vers elle.

## Objectifs / Hors-périmètre

**Objectifs**
- Que chaque ligne soit adressable par un fragment unique et stable (`#node-<id>`), dérivé de l'id persistant du nœud, inchangé lors des renommages et des re-rendus.
- Qu'ouvrir un lien profond révèle la cible même si elle est sous des ancêtres repliés, défile jusqu'à elle et la surligne distinctement.
- Que copier le lien d'une ligne produise un lien profond partageable (`/domaine/<slug>?reveal=<id>#node-<id>`).
- Que la révélation garde la cible visible tant que l'utilisateur reste sur la page (travaille sur cette ligne), afin qu'une action ne la fasse pas disparaître.

**Hors-périmètre**
- Pas de nouvelle route par nœud ni de page séparée ; tous les nœuds restent sur la page unique d'outline du domaine.
- Aucun changement de la façon dont fonctionnent la sélection, le repli/dépli, le glisser-déposer ou le statut.
- Aucun changement du modèle de données persisté : la `reveal` n'est qu'au moment du rendu et ne mute jamais la valeur `collapsed` d'un nœud.
- Aucun changement des actions existantes du menu contextuel.

## Décisions

- **Ancre posée sur la `.line`, pas sur le `<li class="node">`.** L'id d'ancre `node-<id>` est posé sur la rangée (`.line`) pour que `:target` fasse défiler la rangée visible dans le champ de vision, et non toute sa sous-arborescence (qui peut être grande). La `.line` porte déjà `data-id` ; l'`id` dérive du même id de nœud. Les UUID sont en hexadécimal minuscule + tirets, ce qui est valide dans une `id`/un fragment.

- **Utiliser un paramètre de requête `reveal`, et non le fragment, pour déplier les ancêtres.** Comme un fragment n'est jamais envoyé au serveur et que les enfants repliés sont absents du DOM, seul le serveur peut rendre les ancêtres dépliés. Le lien profond porte donc **les deux** parties :
  ```
  /domaine/<slug>?reveal=<id>#node-<id>
   └── query ──► le serveur rend les ancêtres dépliés (sans persistance)
       └── hash ─► :target natif : scroll + surlignage
  ```
  Le couple `:target` + `id` offre le scroll et le surlignage quasi gratuitement ; le paramètre de requête est le seul vrai changement serveur.

- **La révélation est au moment du rendu et ne mute jamais l'état persisté.** Le serveur calcule la chaîne d'ancêtres de la cible (en remontant les liens `parent`/`grandParent` de `findNode`), construit un ensemble d'ids d'ancêtres, et dans `renderNode` rend ces ancêtres comme si `collapsed:false` — mais n'écrit rien. Rouvrir la même page sans `?reveal` montre les ancêtres dans leur état sauvegardé.

- **Découvrir une cible de révélation au moment du rendu, pas comme une préférence persistée.** La cible vient de `req.query.reveal` dans la requête. Un id inconnu (pas un nœud de ce domaine) est ignoré et l'outline est rendue normalement.

- **Garder la révélation active lors des re-rendus de l'outline (option a, confirmée).** Sinon, ouvrir un lien profond puis changer un statut remplacerait l'outline par une version non révélée et re-cacherait la cible. Deux volets :
  - Serveur : chaque route qui rend l'outline (la route de page, `/outline-fragment`, et les routes de mutation de nœuds qui renvoient une outline) lit `req.query.reveal` (un helper rend l'outline avec l'ensemble à déplier). Additif et sans effet quand le paramètre est absent.
  - Client : un écouteur `htmx:configRequest` lit la cible de révélation active depuis l'URL au chargement et ajoute `reveal=<id>` à chaque requête htmx sortante, afin que l'outline re-rendue garde les ancêtres de la cible dépliés. Quand l'utilisateur navigue ailleurs (autre domaine, URL fraîche sans `?reveal`), l'écouteur cesse de l'ajouter et l'outline revient à l'état sauvegardé.
  - *Alternative envisagée :* révélation uniquement au chargement initial (option b) — plus simple, mais une ligne liée peut disparaître dès l'action suivante, ce qui contredit l'intérêt de « faire un lien vers une ligne ». Prendre en compte le cas résiduel : si l'utilisateur replie explicitement un ancêtre de la cible pendant qu'une révélation est active, la vue la garde dépliée jusqu'à ce qu'il quitte la page (la révélation prime sur un repli durant la même session).

- **L'action « copier le lien » est une commodité purement client dans le menu.** Ajouter un `.menu-item` icône seule `copy-link` (avec une infobulle `title`, comme les autres éléments de menu). Volontairement **pas** une action htmx : un gestionnaire de clic délégué construit le lien profond depuis `location.origin` + le chemin de domaine courant + `?reveal=<id>#node-<id>`, l'écrit avec `navigator.clipboard.writeText` (avec repli sur un textarea temporaire + `document.execCommand('copy')` en contexte non sécurisé), et donne un retour transitoire « Lien copié » (infobulle/toast). Le pont de survol existant du menu garde le pointeur sur le menu pendant que l'utilisateur clique dessus.

- **Le surlignage lié est distinct de la sélection.** Un fond/anneau `.line:target` utilisant la couleur d'accent, nettement différent du `.selected` (#eef2ff) utilisé pour la sélection, afin qu'une ligne liée ne soit pas confondue avec une ligne sélectionnée. `:target` correspond dès que le fragment pointe sur la ligne ; quand le fragment change ou est retiré, le surlignage est libéré automatiquement.

## Risques / Compromis

- **[Un fragment seul ne peut pas révéler une ligne cachée]** → résolu par le paramètre de requête `?reveal=` ; la révélation est une préoccupation serveur délibérée, pas une astuce CSS.
- **[La révélation peut primer sur un repli explicite dans la même session]** → accepté et documenté : la révélation prime tant qu'elle est active, afin de garantir que la cible reste visible. Quitter la page la libère.
- **[`__:target` ne surligne que lors du changement/chargement du hash]** → cela correspond au cas d'usage « ouvrir un lien profond ». Si le hash est mis à jour sur place (ex. l'utilisateur copie un lien), la nouvelle cible est surlignée sans rechargement, ce qui convient.
- **[L'API presse-papiers exige un contexte sécurisé ou un repli]** → `navigator.clipboard` requiert https/localhost ; le repli textarea + `execCommand('copy')` couvre un service non sécurisé (ex. http simple sur un LAN). L'outline est servie en http sur la machine de l'utilisateur, donc le chemin de repli doit être testé.
- **[`htmx:configRequest` touchant chaque requête]** → restreint aux requêtes du domaine actif et uniquement quand une cible de révélation est présente ; le paramètre est ignoré par les points de terminaison hors outline (renommages, gestion de domaine), donc additif et sans risque.

## Plan de migration

- Changement client + serveur : ajouter l'`id` d'ancre + la gestion `reveal` dans `server.js`, le gestionnaire « copier le lien » + l'écouteur configRequest dans `public/app.js`, et le style `:target` dans `public/style.css`. Aucune migration de schéma, de base de données ou de dépendance.
- Retour arrière : retirer l'`id` sur `.line`, la gestion de `?reveal` et l'élément de menu « copier le lien », ainsi que le code `:target` / configRequest ; l'outline revient à un adressage uniquement au niveau du domaine.
