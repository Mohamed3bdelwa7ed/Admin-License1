# Madar POS — License Client Integration Contract

> This document is the ONLY thing the Madar POS team needs to implement license activation, validation, and deactivation. It is self-contained: no access to the License Admin codebase, database, or secrets is required.
>
> The License API is versioned (`/api/v1`). Breaking changes ship as `/api/v2` with ≥6 months overlap.

## 1. Overview

Madar is offline-first: sales NEVER require a network connection. Licensing requires the network only for (a) first activation and (b) periodic re-validation. All server answers are cryptographically signed (Ed25519) so they can be cached and trusted offline.

```
Madar POS ──HTTPS──▶ License API ──▶ MongoDB (never you)
Madar POS ◀── signed JSON response
Madar verifies with the PUBLIC key (safe to embed).
```

Configuration (store in your app settings, user-editable):

- `LicenseApiBaseUrl` — e.g. `https://your-api.onrender.com` (no trailing slash). NEVER hardcode localhost in production builds.

## 2. Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/client/public-key` | fetch verification key |
| POST | `/api/v1/client/activate` | bind this PC to a license |
| POST | `/api/v1/client/validate` | periodic re-validation |
| POST | `/api/v1/client/deactivate` | free the device slot (e.g. before moving to new hardware) |

Content-Type: `application/json`. All responses (success AND license-state failure) carry the `error` object on failure or a signed envelope on success. Rate limit: 60 requests/min/IP → HTTP 429 with `Retry-After` header; back off and retry later.

## 3. Device ID requirements

`deviceId` = a stable hardware fingerprint of the machine, e.g. hashed combination of (motherboard/SMBIOS UUID + primary disk serial + Windows MachineGuid). Rules:

- 8–128 characters, allowed: `A–Z a–z 0–9 . _ -`
- MUST be identical across restarts on the same machine (choose stable sources; do NOT include volatile values like MAC of a USB adapter).
- MUST differ between machines (that's the point).
- Recommendation: `SHA256(smbiosUUID + "|" + diskSerial)` hex, uppercase, first 32 chars.

`deviceName` (activate only): a friendly name for the admin UI, e.g. `ALNOOR-CASHIER-01` (max 200 chars, optional).

`nonce` (all POSTs): a random value unique per request, 8–128 chars (e.g. GUID or crypto-random hex). You will echo-check it in the response (see §7).

## 4. Activation request

```
POST /api/v1/client/activate
{
  "licenseKey": "MDR-XXXX-XXXX-XXXX-XXXX",   // exactly as given to the customer
  "deviceId":   "A1B2C3D4E5F6...",
  "deviceName": "MADAR-PC-01",
  "nonce":      "9f2c1a..."                    // fresh random per request
}
```

Responses:

| HTTP | Meaning | Body |
|---|---|---|
| 200 | Activated (or already active — idempotent) | signed envelope, §6 |
| 400 | Malformed input (`INVALID_INPUT`) | plain error |
| 403 | License state bad | **signed** error envelope, §6.2 |
| 403 | `DEVICE_LIMIT_REACHED` | plain error — admin must raise the limit or deactivate another device |
| 403 | `DEACTIVATED_DEVICE` | plain error — an admin deactivated this device; contact the vendor |
| 404 | `LICENSE_NOT_FOUND` | plain error — key typo or revoked deletion |
| 429 | Rate limited | plain error + `Retry-After` |

On 200: verify the signature (§7), then **cache the whole envelope** (§8). If `payload.deviceLimitReached` is true the license is now full — you may warn the customer.

## 5. Validation & deactivation requests

```
POST /api/v1/client/validate    { "licenseKey": "...", "deviceId": "...", "nonce": "..." }
POST /api/v1/client/deactivate  { "licenseKey": "...", "deviceId": "...", "nonce": "..." }
```

`validate` — statuses:

| HTTP | Meaning |
|---|---|
| 200 | License OK — signed envelope, refresh your cache |
| 403 `DEVICE_NOT_ACTIVATED` | this PC never activated (or DB was reset) — run activate |
| 403 `DEACTIVATED_DEVICE` | admin deactivated this device |
| 403 signed `LICENSE_EXPIRED`/`LICENSE_REVOKED`/`LICENSE_SUSPENDED` | see §9 |
| 404 `LICENSE_NOT_FOUND` | key no longer exists |

`deactivate` — call when the customer moves hardware or uninstalls. On 200 you may delete the local license cache. After deactivation, `validate` returns `DEACTIVATED_DEVICE` until a new activation.

## 6. Response envelopes

### 6.1 Success (activate/validate/deactivate)

```json
{
  "keyId": "kid-9f2c...",
  "algorithm": "ed25519",
  "payload": {
    "type": "activation",            // "activation" | "validation" | "deactivation"
    "licenseKey": "MDR-XXXX-XXXX-XXXX-XXXX",
    "deviceId": "A1B2C3D4E5F6...",
    "nonce": "9f2c1a...",             // == the nonce YOU sent
    "status": "active",              // "active" (activate/validate) | "deactivated" (deactivate)
    "startDate": "2026-01-01",        // YYYY-MM-DD
    "expirationDate": "2027-01-01",   // YYYY-MM-DD — entitlement boundary
    "maxDevices": 2,
    "deviceLimitReached": false,      // true when this license is now full
    "validationIntervalHours": 24,    // re-validate at least this often (see §8)
    "gracePeriodDays": 14,            // offline allowance after last successful validation
    "serverTime": "2026-09-02T10:00:00.000Z",
    "issuedAt":   "2026-09-02T10:00:00.000Z"
  },
  "signature": "base64(...)"
}
```

### 6.2 License-state failure (HTTP 403, still signed)

```json
{
  "keyId": "kid-9f2c...",
  "algorithm": "ed25519",
  "payload": {
    "type": "error",
    "licenseKey": "...", "deviceId": "...", "nonce": "...",
    "status": "revoked",              // "expired" | "revoked" | "suspended"
    "reason": "LICENSE_REVOKED",      // same as error.code
    "message": "License has been revoked",
    "serverTime": "2026-09-02T10:00:00.000Z"
  },
  "signature": "base64(...)",
  "error": { "code": "LICENSE_REVOKED", "message": "License has been revoked" }
}
```

## 7. Signature verification (MUST implement)

1. `GET /api/v1/client/public-key` →
   `{ "keyId": "kid-9f2c...", "algorithm": "ed25519", "publicKey": "base64..." }`
   `publicKey` = **base64-encoded SPKI DER** of an Ed25519 public key.
2. Serialize `payload` (the JSON object from the response, parsed) using **canonical JSON**:
   - recursively sort object keys (byte-wise ascending, e.g. in .NET `StringComparer.Ordinal`),
   - no whitespace, standard JSON escaping, UTF-8.
   - Numbers as integers (no `.0`), strings quoted with `"`; no BOM.
   - Example: `{"a":{"c":2,"d":3},"b":1}`
3. Verify Ed25519: `signature` is base64; check it over the UTF-8 bytes of the canonical JSON with the public key.
4. Accept only if: signature valid **AND** `payload.nonce` == the nonce you sent **AND** `keyId` matches the key you hold. On `keyId` mismatch → re-fetch `/client/public-key` once (key rotation support), then retry verification.
5. .NET: .NET 8+ has Ed25519 in `System.Security.Cryptography` (`ImportFromSpkiBase64`); on older frameworks use BouncyCastle (`Ed25519Signer`), or libsodium. If your stack differs, any standard Ed25519 implementation works.

**Never skip signature verification.** An unsigned or invalid envelope must be treated as "no response" (fall back to cache/grace rules), never as success or failure.

## 8. Offline behavior & policy (the rules that keep sales working)

Local cache = the last VERIFIED envelope (store it where? your choice, e.g. file in ProgramData + integrity is provided by the signature itself).

Decision procedure at POS startup and before each business day:

1. **Have cached envelope? No** → require activation (network needed once).
2. Cached and verified:
   - Compute `lastValidationLocal` = time of the last successful `/validate` (or activation) — store this alongside the cache.
   - If `now < expirationDate` AND `now - lastValidationLocal <= validationIntervalHours + gracePeriodDays` → **fully operational, offline is fine**.
   - If past `expirationDate` → OUT OF LICENSE (show renewal screen; block POS features per your product policy).
   - If inside the window → keep selling; retry validation in the background whenever a connection exists.
   - If beyond the window (`> interval + grace`) → OUT OF COMPLIANCE: require online validation before continuing (network needed). This is the anti-clock-rollback bound: rollback only extends offline time up to `gracePeriodDays` measured from the last real server contact.
3. Use `payload.serverTime` (not the local clock) for all entitlement math when online; when offline, use monotonic time since the last validation if available (Windows QueryPerformanceCounter / .NET `Stopwatch`), else accept the residual clock risk.

Suggested UX: warn the customer when `expirationDate` is within 30 days; warn when offline for > `validationIntervalHours`.

## 9. Error codes — machine-readable

| code | HTTP | You should |
|---|---|---|
| `INVALID_INPUT` | 400 | fix your request format |
| `LICENSE_NOT_FOUND` | 404 | key is wrong/never existed — ask the customer to re-check |
| `LICENSE_EXPIRED` | 403 signed | show "renew license" screen; stop validating as success |
| `LICENSE_REVOKED` | 403 signed | show "license revoked, contact vendor" |
| `LICENSE_SUSPENDED` | 403 signed | show "license suspended, contact vendor" |
| `DEVICE_LIMIT_REACHED` | 403 | show "device limit reached ({max} devices) — deactivate one or contact vendor" |
| `DEVICE_NOT_ACTIVATED` | 403 | run activation first |
| `DEACTIVATED_DEVICE` | 403 | "this device was deactivated by the vendor" |
| `RATE_LIMITED` | 429 | honor `Retry-After` header, then retry |
| `UNAUTHORIZED` | 401 | programming error — client endpoints need no auth |

## 10. Revocation & device-reset behavior (summary)

- Revoked license: activate/validate return signed `LICENSE_REVOKED` 403. A reactivation by the vendor returns everything to normal on the next validate.
- Admin device deactivation (`DEACTIVATED_DEVICE`): your slot is freed only by an explicit admin action or your own `/deactivate` call.
- Device reset (new PC): old PC runs `/deactivate` (if still operational) OR the vendor deactivates the old device row in the admin UI; then activate on the new PC. If the limit is reached, activation fails with `DEVICE_LIMIT_REACHED` until a slot frees.

## 11. Versioning policy

- Endpoints are pinned under `/api/v1`. Additive changes (new optional fields in `payload`) may occur — ignore unknown fields.
- Breaking changes → `/api/v2`, both versions run in parallel ≥6 months, announced via a `X-License-API-Deprecation` response header on v1.

## 12. Test values (dev environment)

`http://localhost:4000` serves the same protocol. A seeded admin (see the License Admin README) can create test licenses for you. The public key changes between server restarts only if keys are not configured — pin `keyId` handling per §7 step 4.

---

**Checklist for the Madar agent** — implement in this order:

1. Configurable `LicenseApiBaseUrl` + licenseKey entry screen (paste XXXX-XXXX-…, accept with/without `MDR-` prefix? No — the key includes it, treat the full string as-is).
2. Stable `deviceId` fingerprint (§3).
3. Activation flow + signature/nonce/keyId verification (§4, §7).
4. Secure cache + offline policy (§8).
5. Background validation timer (`validationIntervalHours`).
6. Deactivation flow + device-reset UX (§10).
7. Treat all failure codes per §9.
