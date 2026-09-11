## ADDED Requirements

### Requirement: Authenticate with a Google account using OpenID Connect
The system SHALL allow the user to sign in with their Google account via the OpenID Connect Authorization Code flow with PKCE, and SHALL only create a session after the Google-issued ID token has been verified.

#### Scenario: Initiate sign-in with Google
- **WHEN** the user clicks "Sign in with Google"
- **THEN** the system redirects the browser to Google's authorization endpoint with the configured scopes, a `state` parameter, and a `nonce`

#### Scenario: Successfully authenticate on the callback
- **WHEN** Google redirects back with an authorization code
- **THEN** the system exchanges the code for tokens, verifies the ID token (issuer, audience, signature, expiry, and nonce), and creates a server-side session

#### Scenario: Store the verified user in the session
- **WHEN** the ID token is verified
- **THEN** the session stores the Google subject, email, and display name of the authenticated user

### Requirement: Restrict access to an authorized Google account
The system SHALL only authenticate a Google account whose email is on the configured allowlist, and SHALL reject any other account.

#### Scenario: Allow the authorized account
- **WHEN** a Google account whose email is on the allowlist completes sign-in
- **THEN** the system creates a session and grants access

#### Scenario: Reject a non-authorized account
- **WHEN** a Google account whose email is not on the allowlist completes sign-in
- **THEN** the system denies access, does not create a session, and returns an authorization error

### Requirement: Protect application routes with an active session
The system SHALL require an active authenticated session for the application page and all API routes, and SHALL deny access otherwise.

#### Scenario: Unauthenticated page request is denied
- **WHEN** an unauthenticated user requests the application page
- **THEN** the system returns the sign-in page and does not render the outliner

#### Scenario: Unauthenticated API request is denied
- **WHEN** an unauthenticated user requests an `/api/*` route
- **THEN** the system returns `401` and does not expose the outline data

#### Scenario: Authenticated request is served
- **WHEN** a user with an active session requests the page or an API route
- **THEN** the system serves the content normally

### Requirement: Maintain and expire the session
The system SHALL keep the session across requests, expire it after an idle period, and destroy it on sign-out.

#### Scenario: Session persists across requests
- **WHEN** an authenticated user navigates or reloads the application
- **THEN** the session remains valid and the user stays signed in

#### Scenario: Session expires after idle
- **WHEN** an authenticated user is inactive past the configured idle timeout
- **THEN** the session is invalidated and the user must sign in again

#### Scenario: Sign out destroys the session
- **WHEN** the user signs out
- **THEN** the system destroys the session and subsequent requests are unauthenticated

### Requirement: Expose sign-in state to the client
The system SHALL provide an endpoint that reports the current authenticated user so the interface can display sign-in / sign-out state.

#### Scenario: Report the user when authenticated
- **WHEN** an authenticated user requests the session-status endpoint
- **THEN** the system returns the authenticated user's email and display name

#### Scenario: Report unauthenticated state
- **WHEN** an unauthenticated user requests the session-status endpoint
- **THEN** the system returns a `401` response indicating no active session
