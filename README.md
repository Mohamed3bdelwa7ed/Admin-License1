# Madar License Admin

Standalone licensing system for **Madar POS**: admin dashboard, License API, and the signed client protocol used by the POS app.

```
React Admin (Cloudflare Pages)      Madar POS (Windows)
        │ HTTPS                            │ HTTPS
        ▼                                  ▼
        ┌─────────────────────────────────────┐
        │         License API (Render)        │
        │  Express 5 + TypeScript + JWT      │
        │  Ed25519 response signing          │
        └──────────────┬──────────────────────┘
                       ▼
              MongoDB Atlas (Free Tier)
```

Boundaries (strict):
- The React admin talks ONLY to the License API.
- Madar POS talks ONLY to the License API (`/api/v1/client/*`).
- Neither ever connects to MongoDB directly.
- The Ed25519 **private** key lives only in the API's environment.

## Repos layout

```
frontend/   React 19 + TS + Vite + Tailwind (admin dashboard)
api/        Express 5 + TS + Mongoose (License API)
docs/       API.md, SECURITY.md, LICENSE_INTEGRATION_CONTRACT.md
```

---

## 1. Create the MongoDB Atlas database

1. Sign up at <https://www.mongodb.com/cloud/atlas> (free tier M0 is enough).
2. Create a cluster (any region near your users).
3. **Database Access** → create a database user (username + strong password).
4. **Network Access** → allow `0.0.0.0/0` (Render's egress IPs are dynamic) or restrict later.
5. **Connect → Drivers → Node.js** → copy the SRV string:
   `mongodb+srv://USER:PASSWORD@cluster.xxxxx.mongodb.net/`
6. Append the database name: `...mongodb.net/license_admin`

That value is your `MONGODB_URI`. Treat it like a password.

## 2. Configure the API environment

```powershell
cd api
Copy-Item .env.example .env
```

Fill in `.env` (minimum):

| Variable | Value |
|---|---|
| `MONGODB_URI` | your Atlas SRV string from step 1 |
| `JWT_SECRET` | ≥32 random chars (keygen prints one) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | bootstrap admin account |
| `LICENSE_SIGNING_PRIVATE_KEY` / `_PUBLIC_KEY` / `_KEY_ID` | from `npm run keygen` |

Generate the signing keys + secrets in one command:

```powershell
npm run keygen
# or auto-patch .env (fills only missing/weak values):
npx tsx scripts/patch-env.ts
```

## 3. Run locally

```powershell
# terminal 1 — API on http://localhost:4000
cd api
npm install
npm run seed        # optional demo data + admin bootstrap
npm run dev

# terminal 2 — admin UI on http://localhost:5173
cd frontend
npm install
npm run dev
```

Frontend `.env` (already defaults to the local API):

```
VITE_API_MODE=http
VITE_API_BASE_URL=http://localhost:4000
```

Set `VITE_API_MODE=mock` (or remove it) to run the UI on in-memory demo data without the API.

Login with the seeded admin (`ADMIN_EMAIL` / seed password — demo default `admin@madar.example` / `admin123`; **change it before going live** via Settings → Change Password).

## 4. Run the tests

```powershell
cd api
npm test
```

57 tests run against an in-memory MongoDB **replica set** (transactions tested for real; your Atlas database is never touched): auth (login/refresh rotation/logout/change-password), licenses (create/renew/revoke/reactivate/expiry/limits/search/pagination), devices + client protocol (activation, validation, deactivation, device-limit race, signed responses incl. signed errors), security (unauthorized access, rate limiting, malformed input, signature tamper detection), and database (unique indexes, TTL, cascade, indexes exist).

Live smoke test against the running server:

```powershell
cd api
npm run start         # in another terminal
npx tsx scripts/smoke-live.ts
```

## 5. Migrate old SQLite data (if any)

If a previous SQLite database exists (`data/license.db`):

```powershell
cd api
npx tsx scripts/migrate-sqlite-to-mongodb.ts path/to/license.db
```

- Idempotent (safe to re-run; skips already-migrated records).
- Preserves IDs, timestamps, license states, devices, events.
- Does NOT migrate refresh tokens (users just log in again); passwords stay bcrypt-hashed.
- Prints a SQLite-vs-MongoDB verification report.

## 6. Deploy

### Backend → Render

1. New **Web Service** → connect the repo.
2. Root directory: `api` — Render detects Node.
3. Build command: `npm install` · Start command: `npm run start`
4. Environment variables (NEVER commit these):
   - `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`,
     `LICENSE_SIGNING_PRIVATE_KEY`, `LICENSE_SIGNING_PUBLIC_KEY`, `LICENSE_SIGNING_KEY_ID`
   - `CORS_ORIGINS=https://your-pages-name.pages.dev`
   - `NODE_ENV=production` (the server refuses to boot if secrets are missing)
5. Render provides HTTPS automatically — the URL is your API base.

### Frontend → Cloudflare Pages

1. New project → connect the repo.
2. Build command: `npm run build` · Output: `frontend/dist`
3. Environment variables:
   - `VITE_API_MODE=http`
   - `VITE_API_BASE_URL=https://your-api.onrender.com`
4. After deploy, add the Pages URL to the API's `CORS_ORIGINS` on Render and redeploy the API.

Free tier notes: Render free instances sleep after inactivity (first request is slow) and Atlas M0 is more than enough for a licensing workload. The in-memory rate limiter is per-instance; fine for one Render instance.

## 7. Environment variable reference (API)

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | yes | Atlas connection string (`mongodb+srv://...`) |
| `JWT_SECRET` | prod | HS256 secret for admin access tokens (≥32 chars) |
| `ADMIN_EMAIL` `ADMIN_PASSWORD` `ADMIN_NAME` | prod | bootstrap admin (updated at every boot while password set) |
| `LICENSE_SIGNING_PRIVATE_KEY` | prod | Ed25519 private key (PKCS8 PEM) — server-side ONLY |
| `LICENSE_SIGNING_PUBLIC_KEY` | prod | Ed25519 public key (SPKI base64) |
| `LICENSE_SIGNING_KEY_ID` | prod | key id, e.g. `kid-…` (served to clients) |
| `CORS_ORIGINS` | no | comma-separated allowed origins (default localhost:5173) |
| `PORT` | no | default 4000 |
| `DEFAULT_DURATION_MONTHS` `DEFAULT_MAX_DEVICES` `VALIDATION_INTERVAL_HOURS` `GRACE_PERIOD_DAYS` | no | seed values for Settings (editable via API) |
| `RATE_LIMIT_LOGIN_PER_MINUTE` `RATE_LIMIT_CLIENT_PER_MINUTE` | no | per-IP limits (default 5 / 60) |

## 8. Hand-off to the Madar POS agent

Give the Madar team exactly two things:

1. `docs/LICENSE_INTEGRATION_CONTRACT.md` — the full client protocol.
2. The public key values: `GET /api/v1/client/public-key` (they can fetch it at runtime, or you hardcode `keyId` + base64 public key).

They need NOTHING else — not the repo, not the database, not any secrets.

## 9. Security notes

See `docs/SECURITY.md` for the threat model. Highlights: bcrypt password hashing, JWT access tokens (1h) + hashed rotating refresh tokens (7d, TTL-indexed), Ed25519-signed client responses (success AND license-state errors), per-IP rate limits on login and client endpoints, audit log of every admin action, no secrets in the frontend or Madar.
