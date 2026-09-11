## ADDED Requirements

### Requirement: Persist the outline to a local JSON file
The system SHALL persist the project outline to a local JSON file, saving on change and reloading on startup.

#### Scenario: Changes are saved
- **WHEN** the outline changes
- **THEN** the updated outline is written to the JSON data file

#### Scenario: Outline is restored after restart
- **WHEN** the server restarts
- **THEN** the outline is reloaded from the JSON data file

### Requirement: Store each node with its attributes
The system SHALL store each outline node with a unique id, a title, a status, a collapsed flag, and a children array.

#### Scenario: Node exposes its attributes
- **WHEN** a node is read from storage
- **THEN** it exposes an id, title, status, collapsed flag, and children array

### Requirement: Create initial seed data
The SHALL create an initial data file with example content on first run when no data file exists.

#### Scenario: Seed data on first run
- **WHEN** the server starts and no data file exists
- **THEN** the system creates the data file with example seed content
