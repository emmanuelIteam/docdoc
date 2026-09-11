## ADDED Requirements

### Requirement: Persist the theme palette in a single file
The system SHALL persist all themes in a single auto-described JSON file at `data/themes.json`, where the file holds an array of theme objects, each with a unique id, a display name, and a color. A single file SHALL carry the whole palette; there SHALL be no per-theme file.

#### Scenario: The palette is persisted in one file
- **WHEN** a theme is created or modified
- **THEN** the updated palette is written to `data/themes.json`

#### Scenario: A theme exposes its attributes
- **WHEN** a theme is read from storage
- **THEN** it exposes an id, a name, and a color

### Requirement: Load the palette on startup
The system SHALL load the theme palette on startup, and SHALL treat a missing or unparseable `data/themes.json` as an empty palette rather than failing.

#### Scenario: An existing palette is loaded
- **WHEN** the server starts and `data/themes.json` exists
- **THEN** its themes are loaded

#### Scenario: A missing palette yields an empty palette
- **WHEN** the server starts and `data/themes.json` does not exist
- **THEN** the palette is empty and the app still starts

#### Scenario: An invalid palette does not break startup
- **WHEN** `data/themes.json` cannot be parsed as JSON
- **THEN** the palette is treated as empty and the app continues to start

### Requirement: Write the theme palette atomically
The system SHALL write `data/themes.json` atomically by writing to a temporary file then renaming it over the target, and SHALL serialize writes so concurrent mutations do not interleave on the file.

#### Scenario: Palette writes are atomic
- **WHEN** the palette is modified
- **THEN** it is written to a temporary file and atomically renamed over the target

#### Scenario: Palette mutations are serialized
- **WHEN** multiple palette mutations occur in sequence
- **THEN** they are written one at a time
