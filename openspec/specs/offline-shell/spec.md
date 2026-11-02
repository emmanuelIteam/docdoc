# offline-shell Specification

## Purpose
TBD - created by archiving change add-pwa-support. Update Purpose after archive.
## Requirements
### Requirement: Register a root-scoped service worker

The application SHALL register `/sw.js` with the scope `/` from a script loaded by both HTML shells, and only when `navigator.serviceWorker` exists and the page is served from a secure context (HTTPS or `localhost`). Registration SHALL use the same script URL on every page so repeated loads reuse the existing registration. A registration failure SHALL be caught and SHALL NOT prevent the page's other scripts from running or surface a blocking error to the user. `GET /sw.js` SHALL return the worker script with a JavaScript content type and `Cache-Control: no-cache`.

#### Scenario: The worker is registered once and controls the scope

- **WHEN** an authenticated page loads over HTTPS and `navigator.serviceWorker.ready` resolves
- **THEN** a service worker whose script URL is `/sw.js` is active with scope `/`, and subsequent same-origin page loads are controlled by it

#### Scenario: Registration is skipped without service worker support

- **WHEN** the browser exposes no `navigator.serviceWorker`
- **THEN** the page loads normally, no registration is attempted, and no error is shown

#### Scenario: Registration failures are contained

- **WHEN** the registration promise rejects
- **THEN** the failure is caught, the page remains interactive, and no alert or blocking message is displayed

#### Scenario: The worker script is not cached by the HTTP cache

- **WHEN** the response headers of `/sw.js` are inspected
- **THEN** `Cache-Control` contains `no-cache` and the content type is a JavaScript MIME type

### Requirement: Precache the offline page and the static shell

During `install`, the service worker SHALL create a versioned cache and store `/offline.html` together with the public static assets it needs (`/style.css`, `/pwa.js`, `/app.js`, `/htmx.min.js`, `/manifest.webmanifest`, and the icons). The offline page SHALL be cached before the worker activates. A failure to cache one non-essential asset SHALL NOT abort the installation, and a missing optional asset SHALL NOT leave the worker unable to activate. The worker SHALL take control of open pages once activated, without requiring every tab of the application to be closed.

#### Scenario: The offline page is available after installation

- **WHEN** the service worker has activated
- **THEN** `/offline.html` is present in the current cache and can be served without network access

#### Scenario: A single asset failure does not break installation

- **WHEN** one of the precached static assets fails to download during `install`
- **THEN** the worker still installs and activates, and the offline page remains cached

#### Scenario: Activation claims the open pages

- **WHEN** the worker activates while application pages are open
- **THEN** those pages become controlled by the new worker without a manual reload

### Requirement: Keep navigations network-only with an offline fallback

For same-origin `GET` navigations (`request.mode === 'navigate'` with the `GET` method), the service worker SHALL attempt the network, return the server's response untouched, and SHALL NOT store that response in any cache. When the network fails, it SHALL serve the cached `/offline.html` document with status 200 and an HTML content type. When the offline page is not cached either, it SHALL return a minimal HTML response stating that docdoc is unavailable offline. Non-navigation requests SHALL never be answered with the offline page.

#### Scenario: An online navigation reflects the server's current state

- **WHEN** a page is opened or reloaded while the network is reachable
- **THEN** the document comes from the server, reflects the current session, and is not stored in Cache Storage

#### Scenario: An offline navigation shows the offline page

- **WHEN** a navigation fails because the network is unreachable and `/offline.html` is cached
- **THEN** the browser displays the offline page with a 200 status instead of the browser's network error page

#### Scenario: An offline HTML fragment does not receive the offline page

- **WHEN** an htmx fragment or API request fails offline
- **THEN** the worker lets the failure propagate and does not answer it with `/offline.html`

### Requirement: Serve only the public static allowlist from cache

For same-origin `GET` requests, the service worker SHALL intercept only the explicit static allowlist — `/style.css`, `/app.js`, `/pwa.js`, `/auth.js`, `/simplewebauthn.js`, `/htmx.min.js`, `/manifest.webmanifest`, `/offline.html`, and `/icons/*` — using a stale-while-revalidate strategy: respond with the cached copy when present and refresh it in the background, and on a cache miss fetch the response and store it only when it is successful and of basic type. Every other request, and every non-`GET` request, SHALL bypass the worker so the browser's normal network behaviour applies.

#### Scenario: A cached asset is served offline

- **WHEN** `/style.css` is requested while offline and already cached
- **THEN** the response comes from Cache Storage and the page keeps its styling

#### Scenario: A missing asset is fetched and stored

- **WHEN** a whitelisted asset is requested, absent from the cache, and the network returns it successfully
- **THEN** the response is returned and a copy is stored for later offline use

#### Scenario: An unlisted path bypasses the worker

- **WHEN** `/domaine/mon-projet` or `/auth/passkeys` is requested
- **THEN** the worker does not answer from a cache and the request reaches the server as usual

#### Scenario: A non-GET request is never intercepted

- **WHEN** a form or htmx mutation posts to any route
- **THEN** the worker lets the request pass through untouched and stores nothing

### Requirement: Never cache personal or authenticated responses

The service worker SHALL store only responses for the static allowlist and the offline page. It SHALL NOT store any document returned by a navigation, any response from `/auth/*`, `/api/*`, `/domaine/*`, `/administration`, `/logout`, or any response that could contain account data (email, domains, themes, outline). Cache keys SHALL remain the public static URLs, and clearing site data via the browser SHALL leave no personal content behind in Cache Storage.

#### Scenario: Authenticated pages never enter Cache Storage

- **WHEN** an authenticated user navigates through the application and Cache Storage is inspected
- **THEN** every cached request URL is one of the allowlisted static URLs or `/offline.html`, and no response body contains the account email or domain names

#### Scenario: Logging out leaves no personal content in the cache

- **WHEN** the user signs out and the caches are inspected
- **THEN** no cached entry contains data from the signed-out session

#### Scenario: Access pages are not cached as documents

- **WHEN** the access page `/` is loaded and Cache Storage is inspected
- **THEN** that HTML document is not present, because navigations are never stored

### Requirement: Version caches and remove outdated ones

The service worker's cache name SHALL embed an explicit version constant kept next to the worker's source. On `activate`, the worker SHALL delete every cache whose name carries the application cache prefix but is not the current version, while keeping the current cache intact. Changing a precached static asset SHALL require bumping the version constant, and the repository documentation SHALL state that requirement.

#### Scenario: A new version removes the previous cache

- **WHEN** a worker with a newer cache version activates
- **THEN** the previous `docdoc-static-*` cache is deleted and the current one remains

#### Scenario: The current cache survives activation

- **WHEN** the worker activates with an already current cache
- **THEN** that cache and its entries are preserved

#### Scenario: Unrelated caches are not touched

- **WHEN** the worker activates
- **THEN** caches whose names do not carry the application prefix are left untouched

### Requirement: Deliver updates without interrupting the user

`/sw.js` and `/manifest.webmanifest` SHALL be served with `Cache-Control: no-cache` so a deployment's new worker is discovered on the next navigation. When a new worker takes control of a page that was already controlled, the application SHALL display a non-blocking notice offering to reload; the reload SHALL happen only when the user activates it. On the first installation of the worker (no previous controller), no update notice SHALL be displayed, and no page SHALL be reloaded automatically while the user is editing a title or a form.

#### Scenario: The first installation shows no update notice

- **WHEN** the service worker is installed for the first time and claims the page
- **THEN** no "new version" notice is displayed

#### Scenario: An updated worker offers a reload

- **WHEN** a new worker version takes control of an already controlled page
- **THEN** a non-blocking notice offers to reload, and the page does not reload by itself

#### Scenario: Activating the notice applies the new version

- **WHEN** the user activates the reload action of the update notice
- **THEN** the page reloads and is served by the new worker's cache version

#### Scenario: Editing is not interrupted

- **WHEN** the user is editing a title or a form while a new worker activates
- **THEN** the current input keeps its value and focus until the user chooses to reload

### Requirement: Explain the offline state

The cached offline page SHALL be a self-contained French document styled without network access, SHALL state that docdoc requires a connection to load the user's projects, SHALL offer a `Réessayer` action that reloads the current URL, and SHALL NOT display any cached account data, fake login form, or stale project content.

#### Scenario: The offline page explains the situation

- **WHEN** `/offline.html` is displayed
- **THEN** it states in French that a connection is required, shows the application's name, and displays no project, domain, email, or theme data

#### Scenario: Retrying reloads the requested page

- **WHEN** the user activates `Réessayer` on the offline page
- **THEN** the browser reloads the originally requested URL and, if the connection is back, the server's page replaces the offline page

