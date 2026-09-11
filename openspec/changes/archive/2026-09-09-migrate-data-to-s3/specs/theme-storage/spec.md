# theme-storage Specification

## MODIFIED Requirements

### Requirement: Persist the theme palette in a single file
The system SHALL persist all themes as a single JSON object in the S3 bucket at key `themes.json`, where the object holds an array of theme objects, each with a unique id, a display name, and a color. A single object SHALL carry the whole palette; there SHALL be no per-theme object.

#### Scenario: The palette is persisted in one object
- **WHEN** a theme is created or modified
- **THEN** the updated palette is written to `themes.json`

#### Scenario: A theme exposes its attributes
- **WHEN** a theme is read from storage
- **THEN** it exposes an id, a name, and a color

### Requirement: Load the palette on startup
The system SHALL load the theme palette on startup from the `themes.json` object, and SHALL treat a missing or unparseable `themes.json` object as an empty palette rather than failing.

#### Scenario: An existing palette is loaded
- **WHEN** the server starts and the `themes.json` object exists
- **THEN** its themes are loaded

#### Scenario: A missing palette yields an empty palette
- **WHEN** the server starts and the `themes.json` object does not exist
- **THEN** the palette is empty and the app still starts

#### Scenario: An invalid palette does not break startup
- **WHEN** the `themes.json` object cannot be parsed as JSON
- **THEN** the palette is treated as empty and the app continues to start

### Requirement: Write the theme palette atomically
The system SHALL write `themes.json` with a single atomic PUT, and SHALL serialize writes so concurrent mutations do not interleave on the object.

#### Scenario: Palette writes are atomic
- **WHEN** the palette is modified
- **THEN** it is written in a single PUT

#### Scenario: Palette mutations are serialized
- **WHEN** multiple palette mutations occur in sequence
- **THEN** they are written one at a time
