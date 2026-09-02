# License API — Complete Reference

Base URL: `https://<api-host>` (local dev: `http://localhost:4000`)

All request/response bodies are JSON (`Content-Type: application/json`).

## Error format (every endpoint)

```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human readable message",
    "details": [ ... ]          // optional (e.g. zod validation issues)
  }
}
```

Common codes: `INVALID_INPUT` 400 · `UNAUTHORIZED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `RATE_LIMITED` 429 (with `Retry-After` header) · license-specific: `LICENSE_NOT_FOUND` 404, `LICENSE_REVOKED` / `LICENSE_EXPIRED` / `LICENSE_SUSPENDED` 403, `DEVICE_LIMIT_REACHED` / `DEVICE_NOT_ACTIVATED` / `DEACTIVATED_DEVICE` 403.

## Authentication

Admin endpoints require `Authorization: Bearer <accessToken>` (JWT, HS256, 1h TTL).
Client (Madar) endpoints are public but rate limited and return **Ed25519-signed** payloads.

Status semantics: stored status is `active | revoked | suspended`; **effective status** additionally derives `expired` when `now > expiresAt` (end of day, UTC). "status" below means effective status.

---

## Health

### `GET /health`
Public. Reports API + database state (no sensitive data).

```
200 {"status":"ok","api":true,"database":"connected"}
503 {"status":"degraded","api":true,"database":"disconnected"}
```

---

## Auth (admin)

### `POST /api/v1/auth/login`
Rate limited (default 5/min per IP). Body: `{ "email": "...", "password": "..." }`

`200` →
```json
{
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "admin" },
  "accessToken": "eyJ...",
  "refreshToken": "uuid.hex"
}
```
`401 INVALID_CREDENTIALS` on bad email/password.

### `POST /api/v1/auth/refresh`
Body: `{ "refreshToken": "..." }` — **rotation**: the old token is consumed; each refresh token works exactly once.

`200` → same shape as login. `401` if unknown/expired/replayed.

### `POST /api/v1/auth/logout`
Body: `{ "refreshToken": "..." }` → `204`. Revokes that refresh token.

### `GET /api/v1/auth/me`
Auth required → `200` current user object.

### `POST /api/v1/auth/change-password`
Auth required. Body: `{ "currentPassword": "...", "newPassword": "min8chars" }` → `204`.
Revokes all sessions (log in again).

---

## Licenses (admin)

### `GET /api/v1/licenses`
Query: `search` (key/customer/company), `status` (`all|active|expired|revoked|suspended`), `expiringWithin` (days), `page`, `perPage` (1–50, default 8).

`200` →
```json
{
  "items": [ { "id": "uuid", "licenseKey": "MDR-XXXX-…", "customerId": "uuid",
    "customerName": "…", "customerCompany": "…", "customerEmail": "…",
    "status": "active", "startDate": "2026-01-01", "expirationDate": "2027-01-01",
    "maxDevices": 2, "activeDevices": 1, "notes": "", "createdAt": "ISO",
    "updatedAt": "ISO", "revokedAt": null, "revokedReason": null } ],
  "total": 42, "page": 1, "perPage": 8, "totalPages": 6
}
```

### `POST /api/v1/licenses`
Body:
```json
{ "customerName": "…", "company": "…", "email": "…", "phone": "…",
  "startDate": "YYYY-MM-DD", "expirationDate": "YYYY-MM-DD",
  "maxDevices": 2, "notes": "…" }
```
Customer is found-or-created by email. The license key is generated server-side (crypto random, `MDR-XXXX-XXXX-XXXX-XXXX`).

`201` → `{ "license": {…}, "customerCreated": true }`
`400` when expiration ≤ start, maxDevices out of 1–50, etc.

### `GET /api/v1/licenses/{id}`
`200` license object (see above) · `404 LICENSE_NOT_FOUND`.

### `POST /api/v1/licenses/{id}/revoke`
Body: `{ "reason": "…" }` → `200` license (status `revoked`). `400` if already revoked.

### `POST /api/v1/licenses/{id}/reactivate`
→ `200` license (status `active`; derived expiry still applies). `400` if not revoked.

### `POST /api/v1/licenses/{id}/renew`
Body: `{ "expirationDate": "YYYY-MM-DD" }` — must be after current expiration → `200` license. Expired licenses become active again if the new date is in the future.

### `POST /api/v1/licenses/{id}/device-limit`
Body: `{ "maxDevices": 5 }` — cannot go below current active device count → `200` license.

### `GET /api/v1/licenses/{id}/devices`
→ `{ "items": [ device… ] }` where device =
```json
{ "id": "uuid", "licenseId": "uuid", "deviceId": "HW-FINGERPRINT",
  "deviceName": "ALNOOR-CASHIER-01", "activatedAt": "ISO",
  "lastValidation": "ISO|null", "status": "active|deactivated", "deactivatedAt": "ISO|null" }
```

### `DELETE /api/v1/licenses/{id}/devices/{deviceRowId}`
Admin-initiated deactivation → `204`. Frees a device slot. `404 DEVICE_NOT_FOUND`, `400` if already deactivated.

### `GET /api/v1/licenses/{id}/events`
→ `{ "items": [ event… ], "total": n }` — audit history for the license.

---

## Customers (admin)

### `GET /api/v1/customers?search=…`
→ `{ "items": [ { "id": "uuid", "name": "…", "company": "…", "email": "…", "phone": "…",
"createdAt": "ISO", "licenseCount": 3, "activeLicenses": 2, "deviceCount": 4 } ] }`

### `GET /api/v1/customers/{id}`
→ customer object + `"licenses": [ license… ]`

---

## Devices (admin)

### `GET /api/v1/devices?search=…&status=all|active|deactivated`
→ `{ "items": [ device + `"customerName"`, `"customerCompany"`, `"licenseKey"`, `"licenseId"`, `"licenseStatus"` ] }`

---

## Events / activity (admin)

### `GET /api/v1/events?search=…&limit=100&offset=0`
→ `{ "items": [ { "id": "uuid", "type": "license_created", "licenseId": "uuid|null",
"customerId": "uuid|null", "actor": "MoHashem", "message": "…",
"createdAt": "ISO", "licenseKey": "MDR-…|null", "customerName": "…|null" } ], "total": n }`

Event types: `license_created`, `license_revoked`, `license_reactivated`, `license_renewed`, `device_limit_changed`, `device_added`, `device_removed`, `device_deactivated`.

---

## Dashboard stats (admin)

### `GET /api/v1/stats`
→ `{ "total": 10, "active": 7, "expiringSoon": 2, "expired": 2, "revoked": 1, "activeDevices": 9 }`
(`expiringSoon` = active, expiring within 30 days)

---

## Settings (admin)

### `GET /api/v1/settings/license-defaults`
### `PUT /api/v1/settings/license-defaults`
Body/`200`:
```json
{ "defaultDurationMonths": 12, "defaultMaxDevices": 2,
  "validationIntervalHours": 24, "gracePeriodDays": 14 }
```
These values are returned inside every signed client payload — Madar should honor them.

---

## Client API (Madar POS)

Public, rate limited (default 60/min per IP). **All successful responses AND license-state failures (revoked/expired/suspended) are signed** — see `LICENSE_INTEGRATION_CONTRACT.md` for the signature algorithm. `deviceId` is your hardware fingerprint (8–128 chars, `[A-Za-z0-9._-]`). `nonce` must be unique per request (8–128 chars) — echo it and verify it in the response to block replays.

### `GET /api/v1/client/public-key`
```json
{ "keyId": "kid-…", "algorithm": "ed25519", "publicKey": "base64(SPKI DER)" }
```

### `POST /api/v1/client/activate`
Body: `{ "licenseKey": "MDR-…", "deviceId": "…", "deviceName": "…", "nonce": "…" }`

`200` → signed `payload.type = "activation"`, `payload.status = "active"`.
Idempotent for an already-active device (updates lastValidation). Enforces `maxDevices` server-side with an atomic slot counter — concurrent requests can never exceed the limit. `deviceLimitReached: true` means the license is now full.
Failures: `404 LICENSE_NOT_FOUND` · `403 DEVICE_LIMIT_REACHED` / `DEACTIVATED_DEVICE` / signed `LICENSE_REVOKED` / `LICENSE_EXPIRED` / `LICENSE_SUSPENDED`.

### `POST /api/v1/client/validate`
Body: `{ "licenseKey": "…", "deviceId": "…", "nonce": "…" }`

`200` → signed `payload.type = "validation"`. Updates `lastValidation`.
`403 DEVICE_NOT_ACTIVATED` (device never activated) · `403 DEACTIVATED_DEVICE` · signed license-state errors.

### `POST /api/v1/client/deactivate`
Body: `{ "licenseKey": "…", "deviceId": "…", "nonce": "…" }`

`200` → signed `payload.status = "deactivated"`. Frees the device slot. Also `403 DEVICE_NOT_ACTIVATED` if the device is unknown.

### Signed payload (activation/validation success)

```json
{
  "keyId": "kid-…",
  "algorithm": "ed25519",
  "payload": {
    "type": "activation", "licenseKey": "MDR-…", "deviceId": "…", "nonce": "…",
    "status": "active", "startDate": "2026-01-01", "expirationDate": "2027-01-01",
    "maxDevices": 2, "deviceLimitReached": false,
    "validationIntervalHours": 24, "gracePeriodDays": 14,
    "serverTime": "ISO", "issuedAt": "ISO"
  },
  "signature": "base64"
}
```

### Signed error payload (license-state failures, HTTP 403)

```json
{
  "keyId": "kid-…", "algorithm": "ed25519",
  "payload": { "type": "error", "licenseKey": "…", "deviceId": "…", "nonce": "…",
    "status": "revoked", "reason": "LICENSE_REVOKED", "message": "…",
    "serverTime": "ISO" },
  "signature": "base64",
  "error": { "code": "LICENSE_REVOKED", "message": "…" }
}
```

## Versioning

All endpoints are under `/api/v1`. Breaking changes will ship as `/api/v2` — `v1` remains available. The client contract (see LICENSE_INTEGRATION_CONTRACT.md) pins the exact payload shapes.
