## MODIFIED Requirements

### Requirement: Ordonner les tâches par domaine puis par ordre d'affichage

Le système SHALL afficher les cartes de chaque rubrique selon un ordre manuel propre à la rubrique et au compte. Tant qu'aucun ordre manuel n'a été enregistré pour une rubrique, les cartes SHALL suivre l'ordre des domaines du panneau latéral puis, dans un domaine, l'ordre d'affichage de l'outline. Dès qu'un ordre manuel est enregistré pour une rubrique, il SHALL primer sur l'ordre des domaines et de l'outline. Une carte listée qui n'a pas de position enregistrée dans sa rubrique SHALL être ajoutée à la fin de cette rubrique, dans l'ordre naturel. L'ordre SHALL être conservé d'un chargement à l'autre, SHALL être propre au compte de la session et SHALL NOT être partagé entre les deux rubriques.

#### Scenario: L'ordre initial suit le panneau latéral et l'outline

- **WHEN** aucun ordre manuel n'est enregistré et que les domaines sont affichés dans l'ordre A puis B dans le panneau latéral
- **THEN** les cartes de chaque rubrique suivent l'ordre des domaines puis, dans un domaine, l'ordre d'affichage de l'outline

#### Scenario: L'ordre manuel prime sur l'ordre des domaines

- **WHEN** la carte d'une tâche du domaine B est déplacée avant celle d'une tâche du domaine A dans la même rubrique
- **THEN** la carte du domaine B précède celle du domaine A, même si le domaine A vient avant le domaine B dans le panneau latéral

#### Scenario: L'ordre manuel survit à un rechargement

- **WHEN** une carte a été déplacée dans sa rubrique puis que la page d'accueil est rechargée
- **THEN** la carte occupe la même position qu'avant le rechargement

#### Scenario: Chaque rubrique a son propre ordre

- **WHEN** une carte de la rubrique « À faire » est déplacée
- **THEN** l'ordre des cartes de la rubrique « En attente » reste inchangé

#### Scenario: Une carte sans position enregistrée est ajoutée en fin de rubrique

- **WHEN** une tâche devient `in_progress` alors qu'aucune position ne lui est enregistrée dans « À faire »
- **THEN** sa carte apparaît à la fin de la rubrique « À faire »

#### Scenario: L'ordre d'un autre compte est ignoré

- **WHEN** le compte A a enregistré un ordre manuel et que la session du compte B ouvre `/`
- **THEN** les cartes du compte B suivent son propre ordre, sans référence à celui du compte A

### Requirement: Rattacher une tâche à une rubrique par glisser-déposer

Le système SHALL permettre de déplacer une carte d'une rubrique à une autre par glisser-déposer à la souris, au doigt ou au stylet. Le dépôt SHALL persister le statut de la rubrique cible — `in_progress` pour « À faire », `waiting` pour « En attente » — sur la seule tâche visée, SHALL placer la carte au point de dépôt — avant ou après la carte survolée, ou en fin de rubrique lorsque le dépôt ne vise aucune carte — et SHALL rafraîchir le tableau.

#### Scenario: Une carte passe de À faire à En attente

- **WHEN** l'utilisateur glisse une carte de la rubrique « À faire » et la dépose dans « En attente »
- **THEN** le statut de la tâche devient `waiting`, sa carte apparaît dans « En attente » et le tableau est rafraîchi

#### Scenario: Une carte revient dans À faire

- **WHEN** l'utilisateur glisse une carte de « En attente » et la dépose dans « À faire »
- **THEN** le statut de la tâche devient `in_progress` et sa carte apparaît dans « À faire »

#### Scenario: La carte déposée entre deux cartes s'insère à cette position

- **WHEN** l'utilisateur dépose une carte entre deux cartes de la rubrique cible
- **THEN** la carte déplacée apparaît entre ces deux cartes

#### Scenario: Le dépôt en fin de rubrique place la carte en dernier

- **WHEN** l'utilisateur dépose une carte sous la dernière carte de la rubrique cible
- **THEN** la carte déplacée apparaît en dernière position de cette rubrique

#### Scenario: Le dépôt ne modifie que la tâche visée

- **WHEN** une carte est déposée dans une rubrique
- **THEN** seul le statut de cette tâche est modifié, et les autres tâches du domaine conservent le leur

#### Scenario: Un second dépôt pendant une requête est ignoré

- **WHEN** une requête de déplacement est en cours et que l'utilisateur tente un nouveau dépôt
- **THEN** le second dépôt est ignoré jusqu'à la fin du rafraîchissement

### Requirement: Ne rien changer sur un dépôt sans cible

Le système SHALL NOT modifier le statut d'une carte déposée en dehors des deux rubriques, sur sa rubrique d'origine, ou lorsqu'un glissement est annulé ou interrompu. Un dépôt dans la rubrique d'origine SHALL réordonner la carte lorsque le point de dépôt diffère de sa position courante, et SHALL NOT envoyer de requête lorsqu'il ne la change pas. Les indicateurs de dépôt SHALL être retirés dans tous ces cas.

#### Scenario: Le dépôt à la position courante ne change rien

- **WHEN** l'utilisateur dépose une carte sur sa position actuelle dans sa rubrique
- **THEN** aucun statut n'est modifié, aucune requête de mutation n'est envoyée et l'ordre reste le même

#### Scenario: Le dépôt ailleurs dans la même rubrique ne change que l'ordre

- **WHEN** l'utilisateur dépose une carte à une autre position de sa rubrique d'origine
- **THEN** le statut de la tâche n'est pas modifié, sa position change et le tableau est rafraîchi

#### Scenario: Un dépôt hors rubrique ne change rien

- **WHEN** l'utilisateur relâche une carte en dehors des deux rubriques
- **THEN** aucun statut et aucun ordre ne sont modifiés, et la carte reste à sa place

#### Scenario: Un glisser annulé ne change rien

- **WHEN** l'utilisateur annule le glissement avant de déposer la carte
- **THEN** aucun statut et aucun ordre ne sont modifiés et les indicateurs de dépôt disparaissent

### Requirement: Déplacer une carte au doigt

Sur un appareil tactile, le système SHALL permettre de démarrer un glissement depuis la poignée d'une carte et de la déposer dans une autre rubrique ou à une autre position de sa rubrique, avec le même effet qu'à la souris.

#### Scenario: Le doigt déplace la carte depuis sa poignée

- **WHEN** sur un appareil tactile, l'utilisateur fait glisser la poignée d'une carte puis la dépose dans une autre rubrique
- **THEN** la carte rejoint cette rubrique, comme avec une souris

#### Scenario: Le doigt réordonne dans la même rubrique

- **WHEN** sur un appareil tactile, l'utilisateur fait glisser la poignée d'une carte et la dépose à une autre position de sa rubrique
- **THEN** la carte occupe cette position, comme avec une souris

### Requirement: Changer de rubrique sans glisser

Le système SHALL offrir sur chaque carte un contrôle accessible permettant de choisir l'une des deux rubriques sans utiliser le glisser-déposer. Le contrôle SHALL être activable au clavier, SHALL nommer la tâche et SHALL présenter les deux rubriques « À faire » et « En attente ». La rubrique courante SHALL être désactivée ou marquée comme courante. L'activation d'une autre rubrique SHALL persister le statut correspondant sur la seule tâche visée, SHALL placer la carte en fin de la rubrique cible et rafraîchir le tableau, avec le même effet qu'un dépôt.

#### Scenario: Le menu liste les deux rubriques

- **WHEN** l'utilisateur ouvre le contrôle de rubrique d'une carte
- **THEN** les choix « À faire » et « En attente » sont présentés

#### Scenario: La rubrique courante est désactivée

- **WHEN** une carte est dans « En attente » et que l'utilisateur ouvre son contrôle de rubrique
- **THEN** le choix « En attente » est désactivé ou marqué comme courant

#### Scenario: Un choix au clavier déplace la tâche

- **WHEN** l'utilisateur ouvre le contrôle au clavier et choisit « En attente »
- **THEN** la tâche prend le statut `waiting` et sa carte apparaît dans « En attente »

#### Scenario: La carte choisie rejoint la fin de la rubrique

- **WHEN** l'utilisateur choisit une autre rubrique depuis le menu d'une carte
- **THEN** la carte apparaît en dernière position de la rubrique cible

#### Scenario: Le contrôle nomme la tâche

- **WHEN** une carte est rendue
- **THEN** son contrôle de rubrique porte un nom accessible qui inclut le titre de la tâche

### Requirement: Conserver le focus et annoncer un déplacement

Après un déplacement ou un réordonnancement réussi, le système SHALL remettre le focus sur le contrôle qui a déclenché l'action : le lien du titre de la carte pour un glisser-déposer ou un choix de rubrique, la flèche utilisée pour un déplacement aux flèches — ou l'autre flèche lorsqu'elle devient désactivée, à défaut le lien du titre. Le système SHALL annoncer l'action dans une région `aria-live` polie en nommant la tâche et, pour un réordonnancement, sa nouvelle position dans la rubrique. En cas d'échec de la requête, le système SHALL annoncer l'échec et SHALL laisser le tableau dans un état cohérent avec les données du serveur.

#### Scenario: Le focus revient sur la carte déplacée

- **WHEN** une carte est déplacée au clavier par le menu de rubrique ou par glisser-déposer
- **THEN** après le rafraîchissement, le focus est sur le lien du titre de cette carte dans sa nouvelle rubrique

#### Scenario: Le focus reste sur la flèche utilisée

- **WHEN** une carte est déplacée avec la flèche haut ou la flèche bas
- **THEN** après le rafraîchissement, le focus est sur la même flèche de la carte déplacée, ou sur l'autre flèche si la première est devenue désactivée

#### Scenario: Le déplacement est annoncé

- **WHEN** une carte passe dans une autre rubrique
- **THEN** une région `aria-live` annonce le titre de la tâche et la rubrique cible

#### Scenario: Le réordonnancement est annoncé

- **WHEN** une carte change de position dans sa rubrique
- **THEN** une région `aria-live` annonce le titre de la tâche et sa nouvelle position

#### Scenario: Un échec est annoncé

- **WHEN** la requête de déplacement échoue
- **THEN** une région `aria-live` annonce l'échec et le tableau reste cohérent avec les données du serveur

#### Scenario: Le focus reste utilisable après un rafraîchissement

- **WHEN** le tableau est remplacé après un déplacement
- **THEN** le focus ne reste pas sur un élément supprimé du document

## ADDED Requirements

### Requirement: Réordonner une carte par glisser-déposer dans sa rubrique

Le système SHALL permettre de réordonner une carte à l'intérieur de sa rubrique par glisser-déposer à la souris, au doigt ou au stylet. Pendant le glissement, le système SHALL signaler le point d'insertion — un repère entre deux cartes, ou la fin de la liste — et SHALL retirer ce repère lorsque le pointeur quitte la zone de dépôt. Le dépôt SHALL enregistrer le nouvel ordre et SHALL rafraîchir le tableau ; il SHALL NOT modifier le statut de la tâche.

#### Scenario: La carte déposée au-dessus remonte

- **WHEN** l'utilisateur glisse une carte et la dépose au-dessus d'une carte qui la précède
- **THEN** la carte déplacée précède cette carte et le tableau est rafraîchi

#### Scenario: La carte déposée en dessous descend

- **WHEN** l'utilisateur glisse une carte et la dépose en dessous d'une carte qui la suit
- **THEN** la carte déplacée suit cette carte et le tableau est rafraîchi

#### Scenario: Le point d'insertion est signalé

- **WHEN** une carte survole l'espace entre deux cartes de sa rubrique pendant un glissement
- **THEN** un repère visible indique où la carte sera insérée, et les autres repères disparaissent

#### Scenario: Le statut n'est pas modifié

- **WHEN** une carte est réordonnée dans sa rubrique
- **THEN** le statut de sa tâche reste celui de la rubrique et aucun autre statut n'est modifié

#### Scenario: L'ordre réordonné est conservé après un rechargement

- **WHEN** une carte a été réordonnée puis que la page d'accueil est rechargée
- **THEN** la carte occupe la nouvelle position

#### Scenario: Un glisser hors d'une rubrique ne réordonne pas

- **WHEN** l'utilisateur relâche une carte en dehors de toute rubrique
- **THEN** l'ordre reste inchangé et le repère d'insertion disparaît

### Requirement: Réordonner une carte avec des flèches haut et bas

Le système SHALL afficher sur chaque carte deux contrôles accessibles, une flèche haut et une flèche bas, dont le nom accessible inclut le titre de la tâche. Leur activation SHALL déplacer la carte d'un cran vers le haut ou vers le bas dans sa rubrique, SHALL enregistrer le nouvel ordre et SHALL rafraîchir le tableau sans modifier le statut de la tâche. La flèche haut SHALL être désactivée sur la première carte de la rubrique et la flèche bas sur la dernière. Les deux contrôles SHALL être activables au clavier.

#### Scenario: La flèche haut remonte la carte d'un cran

- **WHEN** l'utilisateur active la flèche haut d'une carte qui n'est pas la première
- **THEN** la carte échange sa position avec la carte qui la précède et le tableau est rafraîchi

#### Scenario: La flèche bas descend la carte d'un cran

- **WHEN** l'utilisateur active la flèche bas d'une carte qui n'est pas la dernière
- **THEN** la carte échange sa position avec la carte qui la suit et le tableau est rafraîchi

#### Scenario: La première carte ne peut pas monter

- **WHEN** la première carte d'une rubrique est rendue
- **THEN** sa flèche haut est désactivée et son activation ne change rien

#### Scenario: La dernière carte ne peut pas descendre

- **WHEN** la dernière carte d'une rubrique est rendue
- **THEN** sa flèche bas est désactivée et son activation ne change rien

#### Scenario: Les flèches s'activent au clavier

- **WHEN** l'utilisateur atteint une flèche au clavier et appuie sur `Entrée` ou `Espace`
- **THEN** la carte est déplacée d'un cran dans la direction de la flèche

#### Scenario: Le statut n'est pas modifié par une flèche

- **WHEN** une carte est déplacée avec une flèche
- **THEN** sa tâche conserve le statut de la rubrique

#### Scenario: Les deux flèches nomment la tâche

- **WHEN** une carte est rendue
- **THEN** ses flèches portent des noms accessibles qui incluent le titre de la tâche et la direction

### Requirement: Refuser un positionnement invalide sans rien modifier

Le système SHALL refuser sans rien modifier une demande de positionnement dont la rubrique n'est pas l'une des deux rubriques, dont la tâche n'appartient pas au compte ou dont la tâche n'est pas une feuille active listée sur le tableau. Une position numérique hors bornes SHALL être ramenée à la première ou à la dernière position de la rubrique. Le refus SHALL répondre 400 ou 404 selon le cas.

#### Scenario: Une rubrique inconnue est refusée

- **WHEN** une demande de positionnement porte une rubrique autre que « À faire » ou « En attente »
- **THEN** la réponse est 400 et aucun ordre n'est modifié

#### Scenario: Une tâche non listée est refusée

- **WHEN** une demande de positionnement vise une tâche terminée, en projet ou une ligne mère
- **THEN** la réponse est 400 et aucun ordre n'est modifié

#### Scenario: Une tâche d'un autre compte est refusée

- **WHEN** une demande de positionnement vise l'identifiant d'une tâche d'un autre compte
- **THEN** la réponse est 404 et aucun ordre n'est modifié

#### Scenario: Une position hors bornes est ramenée dans la rubrique

- **WHEN** une demande de positionnement porte une position supérieure au nombre de cartes de la rubrique
- **THEN** la carte est placée en dernière position et aucun autre ordre n'est modifié
