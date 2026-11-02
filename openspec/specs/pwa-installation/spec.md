# pwa-installation Specification

## Purpose
TBD - created by archiving change add-pwa-support. Update Purpose after archive.
## Requirements
### Requirement: Serve an installable web app manifest

The system SHALL serve `GET /manifest.webmanifest` with the `application/manifest+json` content type and a JSON body that declares `id` `/`, `name` `docdoc — Gestion de projets perso`, `short_name` `docdoc`, a `description`, `lang` `fr`, `start_url` `/`, `scope` `/`, `display` `standalone`, `theme_color` `#2563eb`, `background_color` `#fafafa`, and icons covering at least 192×192 and 512×512 with `purpose` `any` plus a 512×512 icon with `purpose` `maskable`. The response SHALL carry `Cache-Control: no-cache` so that a manifest change shipped by a deployment is observed without waiting for a cached copy to expire.

#### Scenario: The manifest is served at the root

- **WHEN** an unauthenticated client requests `/manifest.webmanifest`
- **THEN** the response status is 200, its content type is `application/manifest+json`, and its body parses as JSON

#### Scenario: The manifest carries the installability fields

- **WHEN** the manifest JSON is read
- **THEN** it contains the required `id`, `name`, `short_name`, `start_url`, `scope`, `display`, `theme_color`, `background_color`, `lang`, and `icons` fields with the values above

#### Scenario: The start URL stays inside the scope

- **WHEN** `start_url` is resolved against the document URL
- **THEN** the result is the origin's `/` path, which lies within the declared `scope` `/`, and `display` is `standalone`

#### Scenario: The manifest is revalidated on every request

- **WHEN** the response headers of `/manifest.webmanifest` are inspected
- **THEN** `Cache-Control` contains `no-cache` and does not authorize a positive `max-age`

### Requirement: Provide application icons

The system SHALL serve PNG icons at `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`, `/icons/apple-touch-icon-180.png`, and `/icons/favicon-32.png`, each returning status 200 with an `image/png` content type and intrinsic dimensions equal to the size in its name. The maskable icon SHALL keep its essential glyph inside the central 80 % safe zone so that any platform mask preserves it. Every icon URL declared in the manifest SHALL resolve to one of these existing files.

#### Scenario: Declared icons resolve with the declared dimensions

- **WHEN** each icon URL declared in the manifest is requested
- **THEN** the response is 200 `image/png` and the PNG header dimensions equal the declared `sizes` value

#### Scenario: The maskable icon keeps a safe zone

- **WHEN** the 512×512 maskable icon is inspected
- **THEN** its glyph is fully contained in the central 80 % square, leaving the outer border usable as mask bleed

#### Scenario: The Apple touch icon is available

- **WHEN** `/icons/apple-touch-icon-180.png` is requested
- **THEN** it returns a 180×180 PNG image

### Requirement: Declare installability metadata in every document

Every HTML document produced by the application's shells — the authenticated shell rendered by `renderShell` and the access pages rendered by `authShell` — SHALL include exactly one `<link rel="manifest" href="/manifest.webmanifest">`, one `<meta name="theme-color" content="#2563eb">`, one `<link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png">`, one `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">`, one `<meta name="mobile-web-app-capable" content="yes">`, one `<meta name="apple-mobile-web-app-capable" content="yes">`, and one `<meta name="apple-mobile-web-app-title" content="docdoc">` in its `<head>`. Both shells SHALL obtain these tags from a single shared definition so that no page can omit or duplicate them.

#### Scenario: The authenticated shell declares the manifest

- **WHEN** an authenticated page such as `/administration` is rendered
- **THEN** its `<head>` contains the manifest link, the theme color, the Apple touch icon link, and the Apple mobile web app meta tags exactly once

#### Scenario: The access pages declare the manifest

- **WHEN** a visitor without a session receives `/` (the access page)
- **THEN** its `<head>` contains the same installability tags, so the application can be installed before the first sign-in

#### Scenario: No document duplicates the tags

- **WHEN** any rendered document is parsed
- **THEN** each installability tag appears exactly once in its `<head>`

### Requirement: Offer the native install prompt

The application SHALL present an install control in the authenticated shell only after the browser fires `beforeinstallprompt`. The control SHALL be hidden until that event and SHALL be labelled `Installer l'application`. When activated, it SHALL call the captured event's `prompt()` exactly once, await the user's choice, and hide itself when the choice is `accepted`; when the choice is `dismissed`, the control SHALL remain available for a later attempt. On `appinstalled`, the control SHALL be removed for the rest of the session. The install script SHALL be a progressive enhancement: when it fails to load or the event never fires, pages SHALL remain fully usable and no empty or dead control SHALL be displayed.

#### Scenario: The control is hidden until the browser offers installation

- **WHEN** a page loads and `beforeinstallprompt` has not fired
- **THEN** no install control is visible

#### Scenario: The control triggers the native prompt

- **WHEN** the browser has fired `beforeinstallprompt` and the user activates the control
- **THEN** the captured event's `prompt()` is called exactly once

#### Scenario: Accepting the prompt hides the control

- **WHEN** the user accepts the native install prompt
- **THEN** the install control disappears and the application is installed

#### Scenario: Dismissing the prompt keeps the control available

- **WHEN** the user dismisses the native install prompt
- **THEN** the install control remains available for another attempt

#### Scenario: Installing hides the control

- **WHEN** the `appinstalled` event fires
- **THEN** the install control is removed and does not reappear during the session

#### Scenario: Pages work when the install script is unavailable

- **WHEN** `/pwa.js` fails to load or the browser never fires `beforeinstallprompt`
- **THEN** the pages render and their other scripts run as before, with no visible error

### Requirement: Explain installation on iOS

When the browser fires no `beforeinstallprompt`, the application SHALL detect iOS Safari (including iPadOS in desktop mode) and, when the application is not already running standalone, activating the install control SHALL reveal instructions to use the Share menu then `Sur l'écran d'accueil`. When the browser offers neither the native prompt nor the iOS path, the install control SHALL be absent rather than inert.

#### Scenario: iOS shows the Share-menu instructions

- **WHEN** the page runs in iOS Safari outside standalone mode and the user activates the install control
- **THEN** instructions naming `Partager` and `Sur l'écran d'accueil` are revealed

#### Scenario: An unsupported browser shows no control

- **WHEN** the browser supports neither `beforeinstallprompt` nor the iOS path
- **THEN** no install control is displayed

### Requirement: Respect the installed state

The install control SHALL be absent when the application already runs as an installed app, detected through the `display-mode: standalone` media query or `navigator.standalone`. Running installed SHALL NOT alter the layout, the authentication flow, or the availability of the application's routes.

#### Scenario: Standalone mode hides the control

- **WHEN** the page is displayed with `display-mode: standalone` and the install control would otherwise be available
- **THEN** no install control is rendered or revealed

#### Scenario: The installed application opens on the application

- **WHEN** the installed application is launched
- **THEN** it opens `start_url` `/` inside the installed window, where the normal session or access page is served

