## MODIFIED Requirements

### Requirement: Persist the outline to a local JSON file
The system SHALL persist each domain's outline to its own object in the S3 bucket keyed `users/{userId}/domains/{id}.json`, where `userId` is the owning account's identifier, saving on change and reloading per account rather than only once at startup, and SHALL not combine multiple domains into a single object.

#### Scenario: Changes are saved to the domain's object
- **WHEN** a domain's outline changes
- **THEN** the updated outline is written to that domain's object under the owning account's prefix

#### Scenario: Outline is restored after restart
- **WHEN** the server restarts
- **THEN** each account's domains are reloaded from their own objects when that account next makes a request

#### Scenario: Only one domain is stored per object
- **WHEN** a domain object is read
- **THEN** it contains that single domain's outline only
