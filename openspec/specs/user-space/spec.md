# user-space Specification

## Purpose
TBD - created by archiving change passkey-auth. Update Purpose after archive.
## Requirements
### Requirement: Scope all stored data to the authenticated account
The system SHALL store every domain, project, theme, and archived object under a key prefixed by the owning account's identifier, and SHALL NOT read or write account data from a bucket-root key after the account exists.

#### Scenario: Writes are scoped to the account
- **WHEN** an authenticated user creates or modifies a domain, a node, or a theme
- **THEN** the object is written under that account's prefix

#### Scenario: Reads are scoped to the account
- **WHEN** an authenticated user opens the application
- **THEN** only the domains and themes stored under that account's prefix are loaded

#### Scenario: Bucket-root keys are no longer the data layer
- **WHEN** an account exists
- **THEN** the bucket-root `domains/`, `archive/`, and `themes.json` keys are not used to serve that account's data

### Requirement: Resolve the account from the session on every request
The system SHALL resolve the owning account from the authenticated session for every request, and SHALL NOT accept an account identifier supplied by the client.

#### Scenario: The account comes from the session
- **WHEN** a request carries an authenticated session
- **THEN** the system resolves the account from that session

#### Scenario: A client-supplied account identifier is ignored
- **WHEN** a request includes an account identifier in a parameter, a form field, or a header
- **THEN** the system ignores it and uses the session's account

### Requirement: Deny access to another account's data
The system SHALL refuse any request whose target object is not owned by the session's account, whether the target is addressed by identifier or by slug.

#### Scenario: Another account's domain identifier is refused
- **WHEN** an authenticated user requests a domain identifier that belongs to another account
- **THEN** the system refuses the request and returns no data

#### Scenario: Another account's slug is refused
- **WHEN** an authenticated user requests a slug that only exists in another account
- **THEN** the system refuses the request and returns no data

#### Scenario: Unauthenticated application routes are refused
- **WHEN** a request without an authenticated session targets a page route
- **THEN** the system returns the home page instead of the requested content

#### Scenario: Unauthenticated API routes are refused
- **WHEN** a request without an authenticated session targets an API route
- **THEN** the system returns an unauthorized response and exposes no outline data

### Requirement: Store account records and lookup indexes
The system SHALL store one account record per account, holding at least the account identifier, the email address, the creation date, and the registered passkeys, together with the lookup indexes required to resolve an account from an email address and from a credential identifier.

#### Scenario: The account record is written on creation
- **WHEN** an account is created
- **THEN** its record is stored under the account's prefix with the email address, the creation date, and the registered passkey

#### Scenario: An account is resolved from an email address
- **WHEN** the system looks up an account by email address
- **THEN** it uses an index keyed by a derived value of the normalized address and does not store the raw address in the key

#### Scenario: An account is resolved from a credential identifier
- **WHEN** an assertion is verified for a discoverable credential
- **THEN** the system resolves the owning account from an index keyed by the credential identifier without scanning every account

#### Scenario: An unknown address resolves to no account
- **WHEN** the system looks up an address that has no account
- **THEN** the lookup reports no account and creates nothing

### Requirement: Load account data without cross-account leakage
The system SHALL keep each account's loaded domains, domain list, and theme palette separate, and SHALL NOT serve a value loaded for one account to another.

#### Scenario: Concurrent sessions see only their own data
- **WHEN** two accounts are active at the same time
- **THEN** each request is served the domains and themes of its own account

#### Scenario: State is not retained globally across accounts
- **WHEN** the application resolves data for a request
- **THEN** it uses data resolved for the session's account and does not fall back to another account's previously loaded data

#### Scenario: A restart does not lose account data
- **WHEN** the server restarts
- **THEN** each account's domains and themes are reloaded from that account's prefix

