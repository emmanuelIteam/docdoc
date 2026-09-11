## 1. Google OIDC Configuration

- [ ] 1.1 Create a Google Cloud OAuth 2.0 Client ID (Web application) and record the client id and client secret
- [ ] 1.2 Add the authorized redirect URI (e.g. `https://<host>/auth/google/callback`) in the Google Cloud Console
- [ ] 1.3 Define the environment variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `SESSION_SECRET`, `GOOGLE_ALLOWED_EMAIL`) and document them (add a `.env.example` and note the config in the Readme)

## 2. Dependencies & Session Setup

- [ ] 2.1 Add `express-session` and `openid-client` to `package.json`
- [ ] 2.2 Configure `express-session` (secret, cookie `httpOnly`/`sameSite=lax`/`secure` in prod, `maxAge`, in-memory store) on the app
- [ ] 2.3 Load the OIDC/config from the environment at startup and fail fast with a clear message if a required variable is missing

## 3. OIDC Login / Callback / Logout Routes

- [ ] 3.1 `GET /auth/google`: discover the Google issuer, build the authorization URL (code + PKCE verifier/challenge + `state` + `nonce`), stash the verifier/state/nonce in the session, and redirect to Google
- [ ] 3.2 `GET /auth/google/callback`: exchange the code, validate `state` and `nonce`, verify the ID token (issuer, audience, signature, expiry)
- [ ] 3.3 On the callback, check the verified email against `GOOGLE_ALLOWED_EMAIL`; on success create the session user and redirect to `/`; on a non-allowed account destroy the session and return an authorization error
- [ ] 3.4 `POST /logout`: destroy the session and redirect to `/`

## 4. Route Protection

- [ ] 4.1 Add a `requireAuth` middleware that checks `req.session.user`
- [ ] 4.2 Gate the page routes (`GET /`, `/outline-fragment`): render the sign-in page when unauthenticated
- [ ] 4.3 Gate all `/api/*` routes: return `401` JSON when unauthenticated (do not expose outline data)

## 5. Session State & UI

- [ ] 5.1 Add `GET /api/me` returning the authenticated user (email, name) or `401` when unauthenticated
- [ ] 5.2 Render the authenticated email plus a "Déconnexion" control in the page header; render a "Se connecter avec Google" button on the sign-in page
- [ ] 5.3 Add the matching styles/behavior in `public/style.css` and `public/app.js` (auth banner / sign-in button)

## 6. Verification

- [ ] 6.1 Start the server and confirm unauthenticated users are blocked from `/` and `/api/*`
- [ ] 6.2 Sign in with the allowed Google account and confirm the outliner loads
- [ ] 6.3 Confirm a Google account that is not on the allowlist is rejected
- [ ] 6.4 Confirm sign-out destroys the session and re-blocks access
- [ ] 6.5 Confirm the session persists across reloads and expires after the idle timeout
