## ADDED Requirements

### Requirement: Issue a single-use code bound to the requested address
The system SHALL issue a six-digit code bound to the email address that was requested, valid for a limited lifetime, usable exactly once, and stored in a form that does not allow the code to be read back from storage.

#### Scenario: A code is issued for an authorized address
- **WHEN** an authorized email address requests a code
- **THEN** the system generates a six-digit code, stores it bound to that address with an expiry, and sends it

#### Scenario: A code can be used only once
- **WHEN** a correct code has been verified successfully
- **THEN** the same code is no longer accepted

#### Scenario: An expired code is refused
- **WHEN** a code is submitted after its lifetime has elapsed
- **THEN** the system refuses it and offers to send a new one

#### Scenario: Stored codes are not readable
- **WHEN** the stored code record is read
- **THEN** it does not contain the code in a directly readable form

### Requirement: Deliver the code by email
The system SHALL deliver the code to the requested address through the configured email provider, and SHALL provide a development mode that records the code instead of sending it.

#### Scenario: The code is sent to the requested address
- **WHEN** a code is issued
- **THEN** the system sends it to the requested address through the configured provider

#### Scenario: Development mode does not send email
- **WHEN** the system runs in development mode
- **THEN** the code is written to the server log and no email is sent

#### Scenario: A delivery failure is reported without crashing
- **WHEN** the email provider fails to accept the message
- **THEN** the system reports that the code could not be sent and the server keeps running

### Requirement: Verify a submitted code
The system SHALL verify a submitted code against the code issued for the same address and SHALL refuse a code that is wrong, expired, already used, or issued for another address.

#### Scenario: The correct code is accepted
- **WHEN** the visitor submits the code issued for the authorized address within its lifetime
- **THEN** the system accepts it and moves the visitor to passkey registration

#### Scenario: A wrong code is refused
- **WHEN** the visitor submits an incorrect code
- **THEN** the system refuses it and keeps the visitor on the code entry form

#### Scenario: A code issued for another address is refused
- **WHEN** a code issued for one address is submitted for a different address
- **THEN** the system refuses it

### Requirement: Allow requesting a new code
The system SHALL allow the visitor to request a new code from the code entry form, and SHALL invalidate the previous code when a new one is issued.

#### Scenario: Requesting a new code replaces the previous one
- **WHEN** the visitor requests a new code
- **THEN** a new code is issued and the previous code is no longer accepted

#### Scenario: Repeated requests are rate limited
- **WHEN** the visitor requests a new code before the resend cooldown has elapsed
- **THEN** the system refuses the request and states when a new code may be requested

### Requirement: Limit verification attempts and request rate
The system SHALL limit the number of verification attempts per issued code and the number of code requests per address and per client, and SHALL refuse further attempts once a limit is reached.

#### Scenario: Too many wrong attempts invalidate the code
- **WHEN** the number of incorrect submissions for a code exceeds the configured maximum
- **THEN** the system invalidates that code and requires a new one

#### Scenario: Excessive code requests are refused
- **WHEN** the number of code requests for an address or a client exceeds the configured limit
- **THEN** the system refuses further requests for the configured period
