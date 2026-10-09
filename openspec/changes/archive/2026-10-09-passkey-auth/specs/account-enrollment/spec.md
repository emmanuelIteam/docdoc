## ADDED Requirements

### Requirement: Present a home page to unauthenticated visitors
The system SHALL serve a home page, and never the outliner, to any request that has no authenticated session, and that home page SHALL state that no docdoc space is associated with the browser.

#### Scenario: An unauthenticated visitor sees the home page
- **WHEN** a visitor without an active session opens the application
- **THEN** the system displays a home page stating that no docdoc space is associated with this browser, and renders no domain, project, or theme

#### Scenario: An authenticated user reaches the outliner
- **WHEN** a visitor with an active session opens the application
- **THEN** the system serves the outliner instead of the home page

### Requirement: Offer both account creation and passkey sign-in from the home page
The home page SHALL offer a way to create an account and a way to sign in with an existing passkey, because the absence of a session does not establish that the visitor has no space.

#### Scenario: The visitor can start account creation
- **WHEN** the unauthenticated home page is displayed
- **THEN** the system presents an account creation action

#### Scenario: The visitor can start a passkey sign-in
- **WHEN** the unauthenticated home page is displayed
- **THEN** the system presents a sign-in action that requires no email address to be typed

### Requirement: Collect the email address for account creation
The system SHALL present a form requesting the visitor's email address when account creation is requested.

#### Scenario: The account creation form asks for an email address
- **WHEN** the visitor requests account creation
- **THEN** the system presents a form containing an email address field

#### Scenario: An empty or malformed address is rejected
- **WHEN** the visitor submits an empty or syntactically invalid email address
- **THEN** the system re-displays the form with an error and sends no code

### Requirement: Restrict account creation to authorized email addresses
The system SHALL compare the submitted email address, normalized by trimming whitespace and ignoring letter case, against the configured allowlist, whose default value is `emmanuel.grandiere@laposte.net`, and SHALL inform and reject any address that is not on it, without sending any email.

#### Scenario: An unauthorized address is rejected before any email is sent
- **WHEN** the visitor submits an email address that is not on the allowlist
- **THEN** the system informs the visitor that they are not authorized on docdoc, sends no email, and creates no account

#### Scenario: An authorized address proceeds to code delivery
- **WHEN** the visitor submits an email address that is on the allowlist
- **THEN** the system sends a one-time code to that address and presents the code entry form

#### Scenario: Address comparison ignores case and surrounding whitespace
- **WHEN** the visitor submits the authorized address with different letter case or surrounding spaces
- **THEN** the system treats that address as authorized

### Requirement: Create the account space only after a passkey is registered
The system SHALL create the account record and its data space only after a passkey registration ceremony has been verified for the requested email address.

#### Scenario: The space is created on successful registration
- **WHEN** the code has been verified and the passkey registration ceremony succeeds
- **THEN** the system creates the account record, creates the account's data space, and opens an authenticated session

#### Scenario: Nothing is created before the passkey exists
- **WHEN** the visitor has submitted only an email address or a code
- **THEN** no account record and no data space are created

#### Scenario: An existing account is reused rather than duplicated
- **WHEN** the authorized address already has an account
- **THEN** the system does not create a second account for that address

### Requirement: Adopt the existing single-tenant data into the first account
The system SHALL move the bucket-root data (`domains/`, `archive/`, `themes.json`) into the account space the first time an account is created, exactly once, and SHALL stop reading the bucket-root keys afterwards.

#### Scenario: Existing data is adopted on first enrollment
- **WHEN** the first account is created and bucket-root domain or theme objects exist
- **THEN** those objects are moved under the new account's space and appear in that account

#### Scenario: Adoption is idempotent
- **WHEN** another account is created, or the first account is created again after adoption
- **THEN** the bucket-root keys are already gone and no data is moved or duplicated

#### Scenario: An empty space stays empty
- **WHEN** the first account is created and no bucket-root data exists
- **THEN** the account space starts empty and no example outline is seeded
