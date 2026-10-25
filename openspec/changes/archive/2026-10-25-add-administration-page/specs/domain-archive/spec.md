## ADDED Requirements

### Requirement: List the archived domains of the account

The system SHALL enumerate the objects under the session account's `archive/` prefix, ignore any object that is not a valid domain object, and SHALL NOT enumerate archives belonging to another account or to the bucket root.

#### Scenario: Archived domains are listed

- **WHEN** the archives section of the administration page is expanded
- **THEN** each valid archived domain object of the account is listed with its name

#### Scenario: Invalid archive objects are ignored

- **WHEN** an object under the account's archive prefix cannot be parsed or is not a valid domain object
- **THEN** it is not listed and the remaining archives are still listed

#### Scenario: Another account's archives are not listed

- **WHEN** another account holds archived domains
- **THEN** none of them appears in this account's archives section

### Requirement: Restore an archived domain

The system SHALL restore an archived domain by writing it back as an active domain object and removing its archive object, giving it a slug regenerated against the active domains and an order placing it after the existing domains; a restored domain SHALL keep its outline and its known theme labels.

#### Scenario: A restored domain becomes active

- **WHEN** the user restores an archived domain
- **THEN** it is written back to the account's domains prefix and listed in the sidebar

#### Scenario: The restored domain is reachable at its URL

- **WHEN** a domain is restored
- **THEN** `GET /domaine/<regenerated slug>` serves it

#### Scenario: A colliding slug is deduplicated

- **WHEN** the restored domain's name produces a slug already used by an active domain
- **THEN** the restored domain receives a unique suffixed slug such as `-2`

#### Scenario: The archive copy disappears

- **WHEN** a domain is restored
- **THEN** its archive object no longer exists, so it cannot be restored twice

#### Scenario: The outline is preserved

- **WHEN** a domain is restored
- **THEN** its projects and its display order are unchanged

#### Scenario: Labels of deleted themes are dropped

- **WHEN** a restored domain carried a label whose theme was deleted while the domain was archived
- **THEN** that label is not restored and the domain's remaining labels are

### Requirement: Purge an archived domain permanently

The system SHALL allow permanently deleting an archived domain after an explicit confirmation, removing its archive object irreversibly.

#### Scenario: A purge deletes the archive object

- **WHEN** the user confirms the purge of an archived domain
- **THEN** its archive object is deleted and it no longer appears in the archives section

#### Scenario: A purged domain cannot come back

- **WHEN** a domain has been purged
- **THEN** no restore action can recreate it from the archive

### Requirement: Restore a domain through its former archive only

The system SHALL restore a domain only from an archive object of the session account, and SHALL answer not found for an archive identifier that does not exist in that account's archive prefix.

#### Scenario: An unknown archive is rejected

- **WHEN** a restore or purge targets an archive identifier that is not in the account's archive prefix
- **THEN** the system answers "Archive introuvable" and changes nothing

#### Scenario: An archive of another account is not addressable

- **WHEN** a restore or purge targets an identifier that exists only in another account's archive prefix
- **THEN** the system answers not found and the other account's archive is untouched
