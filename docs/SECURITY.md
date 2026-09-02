# Security Architecture & Threat Model

## Components and trust boundaries

```
React Admin (browser, UNTRUSTED)  ──HTTPS──▶  License API (TRUSTED)  ──▶  MongoDB Atlas (TRUSTED, network-isolated)
Madar POS (customer PC, UNTRUSTED) ──HTTPS──▶ License API
```

- The browser and Madar never see the database, secrets, or signing keys.
- Only the API holds: `MONGODB_URI`, `JWT_SECRET`, the Ed25519 **private** key.
- Secrets live only in environment variables (Render env / local `.env`, git-ignored).
- MongoDB Atlas is reachable only with the connection string; access is additionally gated by Atlas network rules.

## Authentication & session management

- Admin passwords: **bcrypt** (cost 12). No plaintext at rest; the DB stores `$2…` hashes only (verified by tests).
- Admin tokens: **JWT HS256 access tokens** (1 hour) + **refresh tokens** (7 days).
- Refresh tokens are stored **hashed (SHA-256)**; the raw token exists only in the admin's session storage.
- **Rotation**: every refresh consumes the old token (one-time use). Replaying a used refresh token fails with 401 (tested).
- Password change revokes all sessions. Login revokes previous refresh tokens (one active session per user).
- Timing attacks on login are blunted by comparing against a dummy bcrypt hash when the user does not exist.

## Client (Madar) protocol security

- **Ed25519 signatures**: every activate/validate/deactivate response is signed with the server's private key. Madar verifies with the public key from `GET /api/v1/client/public-key` (or a pinned copy).
- License-state failures (revoked/expired/suspended) are **also signed** — the POS can trust a "your license expired" verdict because it cannot be forged by an attacker on the wire.
- **Replay protection**: responses embed the client-supplied `nonce` and a `serverTime`; the client verifies the nonce matches its request and rejects reused responses. `serverTime` also bounds clock-skew decisions.
- **Offline operation**: the POS caches the last valid signed response and may operate within `gracePeriodDays` (default 14) without network. A cached response cannot be forged (signature) or extended (expiration is inside the signed payload).
- **Device binding**: `(license, deviceId)` is a unique compound index. A license's `activeSlots` counter is claimed with an **atomic conditional update** (`activeSlots < maxDevices` → `$inc`), so concurrent activations can never exceed the limit (tested with parallel requests).
- License keys: crypto-random (`MDR-XXXX-XXXX-XXXX-XXXX`, unambiguous alphabet), generated server-side; not derivable from customer data, dates, or IDs. Brute-forcing keys over the network is throttled by rate limits (default 60 req/min/IP) and the key entropy (~20 random chars ≈ 103 bits).

## Transport & headers

- HTTPS in production (Render/Cloudflare Pages terminate TLS). `x-powered-by` disabled. `trust proxy` set for correct client IPs behind the platform.
- CORS restricted to the admin frontend origins (`CORS_ORIGINS`). No credentials mode needed (bearer tokens).
- JSON body limit 64 KB.

## Rate limiting

Fixed-window per-IP limits (in-memory, per instance):
- `POST /auth/login`: 5/min (blunts password guessing)
- `/api/v1/client/*`: 60/min (blunts key brute-forcing)
429 responses include a machine-readable `error.code` and a `Retry-After` header.
Multi-instance deployments should move the counters to Redis (documented limitation).

## Audit trail

Every admin mutation writes a `LicenseEvent` (created/revoked/reactivated/renewed/device-limit/deactivated + client device_added/removed) with actor, message, and timestamp. The Activity page and `/api/v1/events` expose it. Events are append-only from the API's perspective (no update/delete endpoints).

## Threat model — PRD checklist

| # | Threat | Mitigation | Residual risk |
|---|---|---|---|
| 1 | Local DB modification (Madar SQLite) | Nothing trusts Madar's DB; validation is server-side | none from this system |
| 2 | Local license-file modification | Cached file must carry a valid Ed25519 signature; tampering = invalid | client must actually verify (contract) |
| 3 | EXE patching | Honest limit — a patched EXE can skip checks; server detects at next validation (device count, last validation timestamps) | accepted (documented in PRD) |
| 4 | API traffic interception | HTTPS + signature verification by the client | none if TLS is used |
| 5 | Replay of old activation responses | nonce echo + serverTime + signed expiration | client must enforce nonce check |
| 6 | Copying activation data to another PC | deviceId binding; copy fails validation (different deviceId) | none |
| 7 | Changing system clock | Grace period is bounded by signed `serverTime`/`issuedAt`; clock rollback only delays re-validation, never extends entitlement beyond `gracePeriodDays` from last successful server contact | bounded offline abuse |
| 8 | Same license on many devices | Atomic slot counter + unique (license, deviceId) index | none (tested under concurrency) |
| 9 | Brute-force license keys | 103-bit entropy + rate limiting + audit events | impractical |
| 10 | Admin account attacks | bcrypt-12, login rate limit, rotation, secrets server-side | use a strong unique password; Render locks down env access |

## Honest limitations

1. A determined attacker who controls the Windows machine can always patch the POS binary to skip license checks entirely. No server-side system can prevent local code modification — the goal is to make casual copying hard and provide audit evidence (lastValidation stops updating).
2. The rate limiter and audit are per-instance/in-memory — for multi-instance scaling, back them with Redis.
3. MongoDB Atlas free tier (M0) has no automatic backups — take manual snapshots or upgrade.
4. Admin password resets happen through env/DB access; there is no email-based recovery (attack surface choice).

## Key hygiene

- Regenerate keys: `npm run keygen`, set the new values in Render, restart. Old cached client signatures remain verifiable only if you keep the old public key — Madar should re-fetch `/client/public-key` on keyId mismatch (see contract).
- Never commit `.env` (git-ignored). Rotate `JWT_SECRET` to force logout-everyone if suspected leak.
