## ADDED Requirements

### Requirement: Register a passkey after a verified code
The system SHALL run a WebAuthn registration ceremony after the one-time code has been verified, SHALL issue a server-side challenge for it, and SHALL verify the returned attestation before storing the credential.

#### Scenario: Registration options are issued
- **WHEN** a visitor with a verified code requests registration options
- **THEN** the system returns a challenge, the relying party identifier, and a user handle that is opaque, stable, and no longer than 64 bytes

#### Scenario: The user handle never exposes the email address
- **WHEN** registration options are issued
- **THEN** the user handle is an opaque account identifier that does not contain the email address, while the human-readable display name may show the address to the user

#### Scenario: A successful registration stores the credential
- **WHEN** the browser returns a valid attestation
- **THEN** the system verifies the challenge and the origin, stores the credential identifier, public key, signature counter, transports, and a creation label, and treats the passkey as registered

#### Scenario: Already registered authenticators are excluded
- **WHEN** registration options are issued for an account that already has passkeys
- **THEN** the system includes those credentials in the exclusion list

#### Scenario: An invalid attestation is refused
- **WHEN** verification of the returned attestation fails
- **THEN** the system refuses the registration, stores no credential, and does not create an account

### Requirement: Authenticate with a passkey
The system SHALL authenticate a returning user through a WebAuthn assertion ceremony and SHALL open an authenticated session only after the assertion has been verified.

#### Scenario: Sign-in without typing an email address
- **WHEN** the visitor starts a passkey sign-in from the home page
- **THEN** the system issues a challenge that accepts discoverable credentials without requiring an email address

#### Scenario: A successful assertion opens a session
- **WHEN** the browser returns a valid assertion
- **THEN** the system verifies it, resolves the account from the credential identifier, and opens an authenticated session for that account

#### Scenario: Sign-in with a known address
- **WHEN** the ceremony is started for a known email address
- **THEN** the system restricts the accepted credentials to that account's registered passkeys

### Requirement: Refuse invalid authentication ceremonies
The system SHALL refuse an assertion whose challenge is unknown, expired, or already used, whose origin or relying party identifier does not match the configured one, whose credential is unknown to the system, or whose signature does not verify.

#### Scenario: An unknown or expired challenge is refused
- **WHEN** an assertion refers to a challenge that is not pending, has expired, or has already been consumed
- **THEN** the system refuses the assertion and opens no session

#### Scenario: A mismatched origin or relying party identifier is refused
- **WHEN** the assertion was produced for another origin or another relying party identifier
- **THEN** the system refuses the assertion and opens no session

#### Scenario: An unknown credential is refused
- **WHEN** the assertion refers to a credential identifier that is not registered
- **THEN** the system refuses the assertion and opens no session

#### Scenario: A replayed assertion is refused
- **WHEN** a previously accepted assertion is submitted again
- **THEN** the system refuses it because its challenge is no longer pending

### Requirement: Restrict registration to a limited enrollment session
The system SHALL confine a session created by code verification to the passkey registration operations only, and SHALL NOT serve account data or application routes to it.

#### Scenario: An enrollment session cannot read account data
- **WHEN** a request carrying only an enrollment session targets a domain, project, theme, or archive route
- **THEN** the system refuses the request

#### Scenario: The enrollment session is short lived
- **WHEN** an enrollment session has exceeded its configured lifetime
- **THEN** the visitor must verify a new code before registering a passkey

### Requirement: Manage the account's registered passkeys
The system SHALL let an authenticated user list, label, and revoke the passkeys of their account, and SHALL refuse to revoke the last remaining passkey.

#### Scenario: Registered passkeys are listed
- **WHEN** an authenticated user opens passkey management
- **THEN** the system lists that account's passkeys with their labels and creation dates, and never exposes another account's passkeys

#### Scenario: A passkey can be labelled
- **WHEN** the user renames a passkey
- **THEN** the new label is stored and shown in the list

#### Scenario: A revoked passkey stops working immediately
- **WHEN** the user revokes a passkey
- **THEN** subsequent assertions with that credential are refused

#### Scenario: The last passkey cannot be revoked
- **WHEN** the user attempts to revoke the only remaining passkey of the account
- **THEN** the system refuses and explains that a replacement must be registered first

### Requirement: Accept synchronized passkeys and tolerate counter anomalies
The system SHALL accept backup-eligible passkeys, SHALL NOT refuse an assertion solely because the stored signature counter did not increase, and SHALL NOT require attestation.

#### Scenario: A synchronized passkey is accepted
- **WHEN** the registration returns a backup-eligible credential
- **THEN** the system stores and accepts it

#### Scenario: An unchanged counter does not lock the user out
- **WHEN** an assertion reports a signature counter that did not increase
- **THEN** the system accepts the assertion and records the observation

#### Scenario: Device-bound and synchronized passkeys coexist
- **WHEN** an account holds both a device-bound and a synchronized passkey
- **THEN** either can be used to sign in

### Requirement: Recover access with an email code
The system SHALL keep the email code available as a permanent recovery path, so that a user who has lost every registered passkey can verify a code and register a new passkey.

#### Scenario: Recovery after losing all devices
- **WHEN** the authorized user requests a code from the home page, verifies it, and registers a new passkey
- **THEN** the new passkey is added to the existing account and does not create a second account

#### Scenario: Recovery does not require an existing passkey
- **WHEN** the account has no usable passkey left
- **THEN** the code path alone is sufficient to register a replacement
