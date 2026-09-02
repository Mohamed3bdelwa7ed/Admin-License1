I want you to migrate the CURRENT License Admin backend from SQLite to MongoDB Atlas without rebuilding the project from scratch.

IMPORTANT:
This is a migration/refactoring task, NOT a new implementation.

Do NOT delete or rewrite the existing project.
Do NOT rebuild the authentication system, license system, API routes, business logic, or frontend unless a small change is strictly required for MongoDB compatibility.

==================================================

1. TARGET ARCHITECTURE
   ==================================================

Current:

React Admin
↓ HTTPS
Express API
↓
SQLite

Target:

React Admin
↓ HTTPS
Express API
↓
MongoDB Atlas

Production database must be MongoDB Atlas.

Use:

* MongoDB Atlas Free Tier
* Mongoose
* TypeScript
* Environment variable: MONGODB_URI

Example:

MONGODB_URI=mongodb+srv://...

NEVER hardcode credentials.

NEVER expose MONGODB_URI to the React frontend.

==================================================
2. FIRST: ANALYZE THE EXISTING PROJECT
======================================

Before changing anything:

1. Inspect the complete backend structure.

2. Identify:

   * SQLite initialization
   * SQLite schema/migrations
   * database connection code
   * repositories/data-access layer
   * SQL queries
   * transactions
   * authentication persistence
   * refresh token persistence
   * license persistence
   * device persistence
   * customer persistence
   * event/audit persistence
   * settings persistence
   * tests that depend on SQLite

3. Create a short migration plan based on the ACTUAL codebase.

Do not blindly replace files.

Preserve the current architecture as much as possible.

==================================================
3. PRESERVE THE EXISTING API CONTRACT
=====================================

This is extremely important.

The existing API endpoints and their request/response formats must remain unchanged unless there is a real technical reason.

The React Admin frontend should continue working without redesigning or rewriting it.

Madar POS integration must also remain unchanged.

Madar must only communicate with the License API.

Madar must NEVER connect directly to MongoDB.

Architecture boundary:

Madar POS
↓ HTTPS
License API
↓
MongoDB Atlas

React Admin
↓ HTTPS
License API
↓
MongoDB Atlas

==================================================
4. REPLACE ONLY THE DATABASE LAYER
==================================

Replace:

SQLite
better-sqlite3
SQL queries
SQLite-specific database initialization

with:

MongoDB
Mongoose
MongoDB schemas/models
MongoDB queries

Keep the existing services and business logic where possible.

Prefer this structure if compatible with the existing project:

src/
models/
repositories/
services/
routes/
middleware/
lib/
config/

Do not force a completely new architecture if the existing architecture is already good.

==================================================
5. MONGOOSE MODELS
==================

Create proper Mongoose models corresponding to the existing SQLite entities.

At minimum, preserve the current entities:

* AdminUser
* Customer
* License
* Device
* LicenseEvent
* RefreshToken
* Settings

Do NOT blindly copy the SQLite schema.

Design the MongoDB documents according to the existing domain model.

For example:

License should contain the information currently required by the application, such as:

* license ID
* customer reference
* license key hash
* status
* createdAt
* updatedAt
* expiresAt
* maxDevices
* product/business information if currently supported

Device should preserve:

* device ID/hash
* license reference
* activation information
* last validation information
* status
* timestamps

LicenseEvent should preserve the existing audit/event information.

Do not remove existing functionality.

==================================================
6. REFERENCES AND RELATIONSHIPS
===============================

Use MongoDB ObjectId references where appropriate.

For example:

Customer
↓
License
↓
Device

and:

License
↓
LicenseEvent

Do not overuse MongoDB embedding if the current domain expects independent entities.

Keep queries efficient and predictable.

==================================================
7. INDEXES
==========

Create proper MongoDB indexes for fields frequently queried.

At minimum, evaluate indexes for:

* license key hash
* customer ID
* device ID/hash
* license status
* expiration date
* event timestamps
* admin email
* refresh token hash

Use unique indexes where the existing SQLite constraints require uniqueness.

Do not create unnecessary indexes.

==================================================
8. TRANSACTIONS / ATOMIC OPERATIONS
===================================

Inspect every SQLite transaction.

For example:

* license activation
* device registration
* device limit enforcement
* revoke/reactivate
* refresh token rotation
* license updates

Determine whether each operation requires MongoDB transactions or can safely be implemented as atomic MongoDB operations.

Do NOT blindly replace:

BEGIN
COMMIT
ROLLBACK

with unrelated code.

Preserve the original business guarantees.

If a race condition is possible during device activation, protect the operation properly.

Example:

Two requests must NOT be able to activate two devices simultaneously when maxDevices = 1.

==================================================
9. AUTHENTICATION
=================

Keep the current authentication architecture.

Continue using:

* bcrypt/bcryptjs for password hashing
* JWT access tokens
* refresh tokens
* refresh token rotation if already implemented
* hashed refresh tokens in the database

Do not store raw refresh tokens unnecessarily.

Migrate the persistence layer only.

==================================================
10. LICENSE SECURITY
====================

Do NOT weaken the existing license security.

Keep:

* secure random license generation
* license key hashing
* Ed25519 signing
* private signing key server-side only
* public key endpoint if already implemented
* device binding
* expiration
* revoke/reactivate
* validation
* nonce/replay protection if already implemented

The MongoDB migration must NOT move the Ed25519 private key into:

* React
* Madar
* MongoDB documents

Keep the private key in server-side environment/secret storage.

==================================================
11. CLIENT API
==============

Preserve the existing client endpoints.

Especially:

POST /api/v1/client/activate
POST /api/v1/client/validate
POST /api/v1/client/deactivate
GET  /api/v1/client/public-key

Do not change their response structure just because the database changed.

Madar should not know whether the API uses:

SQLite
MongoDB
PostgreSQL
or another database.

The API contract is the abstraction boundary.

==================================================
12. CONFIGURATION
=================

Add/update environment configuration.

Use:

MONGODB_URI=

Example:

MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/license_admin

Do not commit:

.env
.env.local
real credentials
MongoDB passwords
JWT secrets
Ed25519 private keys

Update:

.env.example

with placeholders only.

Example:

MONGODB_URI=
JWT_SECRET=
JWT_REFRESH_SECRET=
ED25519_PRIVATE_KEY=

==================================================
13. DATABASE CONNECTION
=======================

Create a clean MongoDB connection module.

Requirements:

* connect during backend startup
* fail clearly if MONGODB_URI is missing
* handle connection errors
* handle graceful shutdown
* avoid opening a new MongoDB connection for every request
* reuse the Mongoose connection
* configure appropriate connection behavior for production

The server should not start as if the database is healthy when the database connection has critically failed.

==================================================
14. REMOVE SQLITE PRODUCTION DEPENDENCY
=======================================

After migration:

Search the entire backend for:

* better-sqlite3
* sqlite
* sqlite3
* SQL queries
* SQLite-specific syntax
* SQLite database file paths
* SQLite migrations

Remove them from the PRODUCTION backend.

Do not leave the application silently creating a local SQLite database.

If SQLite is useful for isolated legacy tests, it may remain ONLY if there is a clear reason and it is completely separated from production.

Prefer MongoDB-based tests where practical.

==================================================
15. DATA MIGRATION
==================

If the current project contains an existing SQLite database with useful data:

DO NOT simply delete it.

Create a migration/import script if needed.

Example:

scripts/migrate-sqlite-to-mongodb.ts

The script should:

1. Read existing SQLite data.
2. Transform it into the MongoDB document structure.
3. Preserve IDs/references where safely possible.
4. Preserve timestamps.
5. Preserve license states.
6. Preserve customers.
7. Preserve devices.
8. Preserve license events.
9. Preserve refresh token records only if appropriate.
10. Validate migrated counts.

The script must be safe to run more than once or clearly prevent duplicate imports.

IMPORTANT:

Do not migrate secrets in plaintext if they should be hashed.

After migration, provide a verification report such as:

SQLite:
Customers: X
Licenses: X
Devices: X
Events: X

MongoDB:
Customers: X
Licenses: X
Devices: X
Events: X

==================================================
16. TESTS
=========

Do NOT delete the existing tests.

Update them to work with MongoDB.

Test at minimum:

AUTH:

* login
* invalid password
* refresh token
* refresh token rotation
* logout/revocation

LICENSES:

* create license
* retrieve license
* renew license
* revoke license
* reactivate license
* expiration

DEVICES:

* activate first device
* reject activation when maxDevices is reached
* deactivate device
* validate device
* prevent unauthorized device activation

CLIENT API:

* activate
* validate
* deactivate
* public key

SECURITY:

* invalid license
* revoked license
* expired license
* invalid signature
* invalid nonce/replay
* unauthorized admin access
* rate limiting where already implemented

DATABASE:

* MongoDB connection
* unique constraints
* indexes
* repository operations

Use a proper test database or isolated MongoDB test environment.

Do NOT run destructive tests against the production MongoDB database.

==================================================
17. HEALTH CHECK
================

If the project already has a health endpoint, update it to report database health correctly.

For example:

GET /health

should distinguish between:

API is running
Database is connected

Do not expose sensitive MongoDB information.

==================================================
18. DEPLOYMENT TARGET
=====================

The intended deployment is:

Frontend:
React + TypeScript + Vite
→ Cloudflare Pages

Backend:
Node.js + Express
→ Render

Database:
MongoDB Atlas Free Tier

The backend must work correctly using:

MONGODB_URI

from Render environment variables.

Do not store MongoDB credentials in GitHub.

==================================================
19. DOCUMENTATION
=================

Update the documentation.

README must explain:

1. How to create MongoDB Atlas database.
2. How to obtain MONGODB_URI.
3. How to configure .env.
4. How to run locally.
5. How to run tests.
6. How to run migration if an old SQLite DB exists.
7. How to deploy backend to Render.
8. Which environment variables are required.

Add/update:

SECURITY.md

and:

LICENSE_INTEGRATION_CONTRACT.md

Do not document SQLite as the production database anymore.

==================================================
20. IMPORTANT: DO NOT BREAK EXISTING FUNCTIONALITY
==================================================

Before finishing:

Run the existing test suite.

Build the backend.

Start the server locally.

Verify:

* login works
* admin dashboard APIs work
* license creation works
* license listing works
* license details work
* device activation works
* device management works
* license validation works
* license revoke/reactivate works
* customer management works
* activity/events work
* client API works
* Ed25519 signing still works

If the frontend exists, run it and verify it can communicate with the migrated API.

==================================================
21. DO NOT TOUCH MADAR
======================

This migration is ONLY for the License Admin project.

DO NOT modify the Madar POS project.

Do not change Madar's database.

Do not change Madar's POS logic.

Do not change Madar's SQLite database.

The only thing that must remain compatible is the HTTPS License API contract.

==================================================
22. FINAL REQUIREMENT
=====================

Do the migration incrementally.

First analyze the current implementation.

Then:

1. Add Mongoose.
2. Add MongoDB connection.
3. Add MongoDB models.
4. Replace repositories/data-access implementations.
5. Preserve services/business logic.
6. Update tests.
7. Add migration script if existing SQLite data needs to be preserved.
8. Remove SQLite from production.
9. Update environment configuration.
10. Update documentation.
11. Run all tests.
12. Run build.
13. Perform a final audit for SQLite references.

At the end, report:

* Files changed
* Files added
* Files removed
* SQLite dependencies removed
* MongoDB/Mongoose dependencies added
* MongoDB collections/models created
* Indexes created
* Migration script status
* Tests passed
* Build result
* Any remaining SQLite references
* Any risks or TODOs

DO NOT rebuild the project from scratch.

Migrate the existing implementation while preserving the current API, business logic, security model, frontend, and Madar integration contract.
