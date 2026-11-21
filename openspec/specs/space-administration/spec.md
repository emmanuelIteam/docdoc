# space-administration Specification

## Purpose
The single administration page of a space: owner-only access, its entry in the sidebar footer, the sections it renders (themes, domains, archives, backup), and the return-to-page behaviour of the mutations submitted from it.

## Requirements
### Requirement: Serve the administration page to the space owner

The system SHALL serve an administration page at `GET /administration` to an authenticated session, rendered exclusively from that session's own space, and SHALL never expose another account's themes, domains, or archives on it.

#### Scenario: The owner reaches the administration page

- **WHEN** the authenticated user navigates to `/administration`
- **THEN** the administration page is displayed with the themes, domains, and archives of that user's space

#### Scenario: An unauthenticated request is refused

- **WHEN** a request without a valid session targets `/administration`
- **THEN** the access guard answers instead of the administration page

#### Scenario: Another account's data is never shown

- **WHEN** the page is rendered for one account while another account holds themes, domains, or archives
- **THEN** only the requesting account's data appears

### Requirement: Reach the page from the sidebar footer

The system SHALL display an "Administration" entry in the footer of the left sidebar on every page, linking to `/administration`, and SHALL mark that entry active while the administration page is displayed.

#### Scenario: The entry is present on every page

- **WHEN** any page is rendered
- **THEN** the sidebar footer shows the Administration entry pointing at `/administration`

#### Scenario: The entry is active on the administration page

- **WHEN** the administration page is displayed
- **THEN** the Administration entry is highlighted

#### Scenario: The entry is not active elsewhere

- **WHEN** a domain page is displayed
- **THEN** the Administration entry is not highlighted

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

### Requirement: Return to the administration page after a mutation

The system SHALL return the user to the administration page after a mutation submitted from it, using the return target carried by the submitting form, and SHALL ignore any return target other than the administration page.

#### Scenario: A mutation submitted from the page returns to it

- **WHEN** the user submits a theme, domain, or archive mutation from the administration page
- **THEN** the response redirects to `/administration`

#### Scenario: An unexpected return target is ignored

- **WHEN** a mutation carries a return target that is not the administration page
- **THEN** the route's usual redirect behaviour applies instead

#### Scenario: A failed mutation reports the error

- **WHEN** a mutation submitted from the administration page is rejected (for example a duplicate theme name)
- **THEN** the rejection is reported to the user and no data is changed

