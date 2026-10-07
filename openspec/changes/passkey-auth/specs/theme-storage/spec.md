## MODIFIED Requirements

### Requirement: Persist the theme palette in a single file
The system SHALL persist each account's themes as a single JSON object in the S3 bucket at key `users/{userId}/themes.json`, where `userId` is the owning account's identifier and the object holds an array of theme objects, each with a unique id, a display name, and a color. A single object SHALL carry the whole palette of one account; there SHALL be no per-theme object and no palette shared between accounts.

#### Scenario: The palette is persisted in one object
- **WHEN** a theme is created or modified
- **THEN** the updated palette is written to that account's themes key

#### Scenario: A theme exposes its attributes
- **WHEN** a theme is read from storage
- **THEN** it exposes an id, a name, and a color

#### Scenario: Each account has its own palette
- **WHEN** two accounts both hold themes
- **THEN** each account's palette is stored under its own key and neither sees the other's themes

### Requirement: Load the palette on startup
The system SHALL load an account's theme palette from that account's `themes.json` object when the account's data is resolved, and SHALL treat a missing or unparseable palette object as an empty palette rather than failing.

#### Scenario: An existing palette is loaded
- **WHEN** an account's data is resolved and that account's themes object exists
- **THEN** its themes are loaded

#### Scenario: A missing palette yields an empty palette
- **WHEN** an account's data is resolved and that account's themes object does not exist
- **THEN** the palette is empty and the application still serves the account

#### Scenario: An invalid palette does not break the request
- **WHEN** an account's themes object cannot be parsed as JSON
- **THEN** the palette is treated as empty and the account is still served

### Requirement: Write the theme palette atomically
The system SHALL write the account's `themes.json` object with a single atomic PUT, and SHALL serialize writes so concurrent mutations do not interleave on the object.

#### Scenario: Palette writes are atomic
- **WHEN** the palette is modified
- **THEN** it is written in a single PUT

#### Scenario: Palette mutations are serialized
- **WHEN** multiple palette mutations occur in sequence
- **THEN** they are written one at a time
