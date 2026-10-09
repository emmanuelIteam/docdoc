## MODIFIED Requirements

### Requirement: List objects by prefix
The system SHALL list the object keys under a given prefix, so that a listing can be confined to the authenticated account's space.

#### Scenario: List objects under the domains prefix
- **WHEN** an account's domains are enumerated
- **THEN** the keys under that account's domains prefix are returned and no key belonging to another account appears

#### Scenario: A listing never returns another account's keys
- **WHEN** a listing is performed for an account
- **THEN** keys stored outside that account's prefix are not returned

### Requirement: Move an object
The system SHALL move an object from a source key to a destination key (copy then delete) for archive operations, where both keys belong to the authenticated account's space.

#### Scenario: Archive moves an object to the archive prefix
- **WHEN** a domain is archived
- **THEN** its object is moved from the account's domains prefix to the account's archive prefix
