# CORS Fix — Frontend Blocked by Cross-Origin Policy

## Symptom

The browser console on `https://admin-licensev2.jamm7498.workers.dev` showed:

> blocked by CORS policy: Response to preflight request doesn't pass access control check

The frontend (Cloudflare Workers) and the backend API (Render) are on
different origins, so every cross-origin `fetch` first sends an `OPTIONS`
preflight. The API did not answer that preflight correctly, so the browser
refused to send the real request.

## Root causes (all in `api/`)

1. **Frontend origin not allowlisted.** `api/src/server.ts` passed
   `cors({ origin: deps.corsOrigins, credentials: false })`, and the only
   configured origin was `http://localhost:5173`. The production frontend
   `https://admin-licensev2.jamm7498.workers.dev` was never listed, so its
   preflights got no `Access-Control-Allow-Origin` header.
2. **No explicit preflight handling.** There was no `app.options(...)`
   handler and no `methods` / `allowedHeaders` / `maxAge` configuration, so
   preflights carrying `Authorization` or `Content-Type: application/json`
   could fail the access-control check.
3. **Credentials disabled.** `credentials: false` means the API never sent
   `Access-Control-Allow-Credentials: true`, so any frontend request using
   cookies or credentialed headers was rejected by the browser.

## What was changed

### 1. `api/src/server.ts` — real CORS policy

- `credentials: true` — the API now returns
  `Access-Control-Allow-Credentials: true` (required for cookies /
  credentialed requests; harmless for the Bearer-token flow).
- Origin allowlist is echoed back (never `*`, which is forbidden together
  with credentials). Requests with **no** `Origin` header (curl, Postman,
  server-to-server, health checks) are still allowed.
- Both sides are trailing-slash normalised, so
  `https://admin-licensev2.jamm7498.workers.dev/` matches too.
- Explicit preflight support:
  - `methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
  - `allowedHeaders: Content-Type, Authorization, X-Requested-With`
  - `exposedHeaders: Retry-After` (so the frontend can read rate-limit retries)
  - `maxAge: 86400` (browsers cache the preflight for 24 h)
  - `optionsSuccessStatus: 204`
  - `app.options(/.*/, cors(corsOptions))` guarantees every path answers
    `OPTIONS`. (A RegExp is used because Express 5 no longer accepts the
    `"*"` route string.)

### 2. `api/src/config.ts` — frontend URL via environment variable

- New supported variable **`FRONTEND_URL`** (single URL — the natural thing
  to set on Render/Cloudflare hosts), merged with the existing
  **`CORS_ORIGINS`** (comma-separated list). Either one works; values are
  trimmed, trailing slashes stripped, and deduplicated.
- New defaults when neither variable is set now include **both** the local
  dev server and the production frontend, so production works even if the
  env var is forgotten:
  - `http://localhost:5173`
  - `https://admin-licensev2.jamm7498.workers.dev`

### 3. `api/.env.example` — documented

Updated with the production origin in `CORS_ORIGINS`, the new
`FRONTEND_URL` alias, and a comment explaining the browser error you get
when the frontend origin is missing.

## How to configure (production)

On the backend host (e.g. Render → Environment), set **one** of:

```bash
# Option A — single URL (recommended, simplest)
FRONTEND_URL=https://admin-licensev2.jamm7498.workers.dev

# Option B — list (use when several frontends call the API)
CORS_ORIGINS=https://admin-licensev2.jamm7498.workers.dev,http://localhost:5173
```

Then **redeploy / restart** the API (env vars are read at startup).

## How it was verified

- `tsc --noEmit` — typecheck passes.
- Live `supertest` checks against `createApp()`:
  - `OPTIONS /api/v1/auth/login` from the Workers origin → **204**,
    `Access-Control-Allow-Origin` echoes the frontend,
    `Access-Control-Allow-Credentials: true`,
    `Access-Control-Allow-Methods` includes all verbs,
    `Access-Control-Allow-Headers` includes `Content-Type, Authorization`.
  - `GET /health` from the Workers origin → same `Allow-Origin` +
    credentials headers present.
  - `OPTIONS` from `https://evil.example` → **no** `Allow-Origin` echo
    (still correctly rejected).
  - Request with **no** `Origin` header → still served (existing tests and
    health checks keep working; empty allowlist does not lock out
    non-browser clients).
  - `OPTIONS` from `http://localhost:5173` → 204 (local dev unaffected).
- Env resolution checks: `FRONTEND_URL`-only, `CORS_ORIGINS`-only, and
  neither-set (defaults) all resolve to the expected allowlist.

## If the error comes back

1. Open DevTools → Network → the failed `OPTIONS` request → check the
   `Origin` request header value character-for-character against the
   allowlist (scheme `https`, host, no trailing slash issues — the server
   normalises trailing slashes, but a wrong subdomain or `http` vs `https`
   will still fail).
2. Confirm the backend env var is set **and the service was redeployed**
   after setting it.
3. Confirm the response carries `access-control-allow-origin: <your origin>`
   **and** `access-control-allow-credentials: true`.
