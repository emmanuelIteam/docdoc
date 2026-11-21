## RENAMED Requirements

- FROM: `### Requirement: Organize the page in three sections`
- TO: `### Requirement: Organize the page in three sections and a backup section`

## MODIFIED Requirements

### Requirement: Organize the page in three sections and a backup section

Le système SHALL rendre la page d'administration en trois sections de gestion empilées — thèmes, domaines et archives — suivies d'une section Sauvegarde, avec la section des archives repliée par défaut, et SHALL afficher un état vide explicite dans chacune des trois sections de gestion qui n'a aucune entrée. La section Sauvegarde SHALL rester déployée et SHALL contenir le lien d'export et le formulaire de restauration décrits par la capacité `data-backup`.

#### Scenario: Three sections are displayed

- **WHEN** la page d'administration est rendue
- **THEN** les sections thèmes, domaines et archives apparaissent dans cet ordre

#### Scenario: Archives start collapsed

- **WHEN** la page d'administration est chargée
- **THEN** la section des archives est repliée et son dépliage liste les domaines archivés

#### Scenario: The backup section follows the archives

- **WHEN** la page d'administration est rendue
- **THEN** la section Sauvegarde suit immédiatement la section Archives

#### Scenario: The page works with an empty space

- **WHEN** l'espace ne contient ni thème, ni domaine, ni archive
- **THEN** chacune des trois sections de gestion affiche son état vide, la section Sauvegarde reste utilisable et aucune redirection vers un domaine n'a lieu
