# License Admin Web — Build Specification

You are responsible for building a standalone web-based License Administration system for my Madar POS application.

## IMPORTANT ARCHITECTURE

This project MUST be completely independent from the Madar POS application.

Do NOT modify the Madar source code.

Do NOT access Madar's SQLite database.

Do NOT put the License Database inside the frontend.

Do NOT put private secrets in the frontend.

The architecture must be:

```text
                    ┌─────────────────────────┐
                    │   License Admin Web     │
                    │                         │
                    │ React + TypeScript      │
                    └────────────┬────────────┘
                                 │
                              HTTPS
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      License API        │
                    │                         │
                    │ Authentication          │
                    │ License Logic            │
                    │ Signing                  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    License Database     │
                    └─────────────────────────┘
                                 ▲
                                 │
                              HTTPS
                                 │
                    ┌─────────────────────────┐
                    │       Madar POS         │
                    │     License Client      │
                    └─────────────────────────┘
```

The Web Admin is only an administration client.

---

# Phase 1 — Analyze Before Coding

Do NOT immediately start implementing.

First inspect the project/workspace and provide:

1. Recommended frontend stack.
2. Recommended backend/API stack.
3. Recommended database.
4. Authentication architecture.
5. License architecture.
6. Device-binding architecture.
7. Cryptographic signing architecture.
8. Deployment architecture.
9. Free/low-cost hosting options.
10. Folder/project structure.
11. Security threat model.
12. API contract.

Then implement the approved architecture.

---

# Recommended Frontend

Use:

* React
* TypeScript
* Vite
* Modern CSS or Tailwind CSS
* React Router if routing is required

The UI should be a professional responsive admin dashboard.

It should work well on:

* Desktop
* Laptop
* Tablet

The primary language should be English initially, but structure the UI so Arabic/RTL can be added later without rewriting the application.

---

# Backend

Create a separate License API.

Choose a suitable backend technology based on the existing project requirements.

The API must be independent from the React frontend.

The frontend communicates ONLY through the API.

The browser must NEVER connect directly to the database.

---

# Database

Design a relational database for the licensing system.

Possible entities:

```text
AdminUser
Customer
License
DeviceActivation
LicenseEvent
```

Do not blindly follow these names if a better schema is appropriate.

The schema should support:

* license creation
* expiration
* revocation
* renewal
* device binding
* device deactivation
* activation history
* audit history
* customer information

Add appropriate:

* primary keys
* foreign keys
* indexes
* unique constraints
* timestamps

---

# License Management

The Admin dashboard must support:

## Create License

Admin can enter:

* Customer name
* Company/store name
* License duration
* Start date
* Expiration date
* Maximum devices
* Notes

The server generates the License Key.

The License Key must be generated securely.

Do NOT create predictable keys based on:

* customer name
* date
* database ID
* sequential numbers

---

# License List

Create a searchable and filterable licenses table.

Display useful information such as:

* License
* Customer
* Status
* Created
* Start date
* Expiration
* Maximum devices
* Active devices

Statuses should clearly distinguish:

* Active
* Expired
* Revoked
* Suspended if supported

Add:

* search
* status filter
* expiration filter
* pagination

---

# License Details

Clicking a license should open a detailed page.

Display:

### License Information

* License ID
* License Key
* Customer
* Status
* Start date
* Expiration
* Maximum devices
* Created date

### Devices

Display:

* Device ID
* Activation date
* Last validation
* Device status
* Deactivation option

### History

Display events such as:

* License created
* Activated
* Device added
* Device removed
* License renewed
* License revoked
* License reactivated

---

# License Actions

The admin must be able to:

* Create license
* Revoke license
* Reactivate license
* Extend expiration
* Change device limit
* Deactivate a device
* View activation history

Dangerous actions must require confirmation.

Example:

"Are you sure you want to revoke this license?"

---

# Device Management

A license can have multiple device activations depending on its device limit.

Example:

```text
License
  ├── Device A
  ├── Device B
  └── Device C
```

If maximum devices = 2:

```text
Device A → active
Device B → active
Device C → activation rejected
```

The server must enforce the limit.

Do NOT rely on the frontend for security.

---

# Admin Authentication

The Admin Web App must be protected.

Implement:

* login
* secure password hashing
* authentication
* authorization
* session/token expiration
* logout

Never store plaintext passwords.

Never put admin credentials inside React.

Never put database credentials inside React.

Never put private signing keys inside React.

---

# Cryptographic Signing

The License API must be able to sign license/activation responses.

Use asymmetric cryptography.

The architecture must be:

```text
License API
    │
    └── PRIVATE KEY 🔐
          │
          │ signs
          ▼
     License Response
          │
          ▼
       Madar
          │
          └── PUBLIC KEY 🔓
                 │
                 └── verifies signature
```

The private signing key must NEVER be:

* inside React
* inside JavaScript bundles
* inside Madar
* committed to Git
* returned through an API

Use environment variables or a secure secret-management mechanism for server-side secrets.

---

# API Design

Create a versioned API.

Example:

```text
/api/v1/auth/login

/api/v1/licenses
/api/v1/licenses/{id}
/api/v1/licenses/{id}/revoke
/api/v1/licenses/{id}/reactivate
/api/v1/licenses/{id}/renew
/api/v1/licenses/{id}/devices
/api/v1/licenses/{id}/devices/{deviceId}
/api/v1/licenses/{id}/activations
```

For the Madar client, define separate endpoints for:

```text
POST /api/v1/client/activate
POST /api/v1/client/validate
POST /api/v1/client/deactivate
```

The exact API design may be improved if necessary.

Document every endpoint.

For each endpoint document:

* HTTP method
* URL
* authentication requirement
* request body
* response body
* status codes
* error format

---

# Security Requirements

Assume the customer controls their Windows PC.

The system must be designed with this threat model.

Consider:

1. Local database modification.
2. Local license-file modification.
3. EXE patching.
4. API traffic interception.
5. Replay of old activation responses.
6. Copying activation data to another PC.
7. Changing system clock.
8. Reusing the same license on multiple devices.
9. Brute-force license keys.
10. Admin account attacks.

Use:

* HTTPS
* server-side validation
* rate limiting
* signed responses
* secure random license keys
* authentication
* authorization
* audit logs
* timestamps
* expiration
* device activation records

Be honest about limitations.

A Windows client cannot be made mathematically impossible to crack.

---

# Offline Madar Support

Madar is an offline-first POS application.

The License system must NOT require an Internet connection for every sale.

The license protocol should support:

* initial online activation
* locally cached activation
* offline operation
* configurable validation/grace period
* periodic online validation

The exact policy must be clearly defined in the API contract.

---

# Admin Dashboard UI

Build a clean professional dashboard.

Suggested navigation:

```text
Dashboard
Licenses
Customers
Devices
License Events
Settings
```

Dashboard KPIs:

* Total licenses
* Active licenses
* Expired licenses
* Revoked licenses
* Active devices

Add useful recent activity.

Do not over-design the dashboard.

Focus on functionality and reliability.

---

# License Key UX

When creating a license:

1. Generate the key server-side.
2. Display it once clearly.
3. Allow copying it.
4. Do not expose unnecessary secrets.
5. Make it easy for the admin to give the key to the customer.

Example UI:

```text
License Created

License Key

XXXX-XXXX-XXXX-XXXX-XXXX

[ Copy License Key ]
```

The actual key format must be generated securely by the backend.

---

# Deployment

I currently have a very limited budget.

Design the application so that:

* frontend can be deployed as a static web application
* backend can be deployed independently
* database can be hosted independently
* configuration uses environment variables
* localhost URLs are not hard-coded
* production HTTPS is supported

Do not assume I already have a paid VPS.

Document free/low-cost deployment options.

---

# Project Structure

Prefer a clean monorepo such as:

```text
license-system/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── ...
│
├── api/
│   ├── src/
│   ├── tests/
│   └── ...
│
├── database/
│   └── migrations/
│
├── docs/
│   ├── API.md
│   ├── SECURITY.md
│   └── LICENSE_INTEGRATION_CONTRACT.md
│
├── .env.example
└── README.md
```

You may modify the structure if your technical recommendation is better.

---

# Testing

Create tests for:

### License

* Create license
* Duplicate license prevention
* Expiration
* Revocation
* Reactivation
* Renewal
* Device limits

### Activation

* Valid license
* Invalid license
* Expired license
* Revoked license
* Device limit reached
* Existing device
* New device

### Security

* Unauthorized API access
* Invalid authentication
* Rate limiting
* Invalid license requests
* Invalid signatures
* Replay attempts where applicable

### Admin

* Login
* Logout
* Unauthorized pages
* License management
* Dangerous-action confirmation

---

# Documentation

Create:

## README.md

Explain:

* project architecture
* setup
* development
* environment variables
* database setup
* running frontend
* running API
* testing
* deployment

## API.md

Complete API documentation.

## SECURITY.md

Explain the security architecture and threat model.

## LICENSE_INTEGRATION_CONTRACT.md

This is extremely important.

This document will be consumed by a DIFFERENT AGENT working on Madar POS.

It must define exactly:

1. Activation request.
2. Activation response.
3. Validation request.
4. Validation response.
5. Device ID requirements.
6. License status values.
7. Expiration behavior.
8. Offline/grace behavior.
9. Signature format.
10. Public-key verification.
11. Error codes.
12. Revocation behavior.
13. Device reset behavior.
14. API base URL configuration.
15. Versioning policy.

The Madar Agent must be able to implement the License Client without reading this project's internal implementation.

---

# Final Rule

Keep these three components independent:

```text
License Admin Web
        ↓
    License API
        ↓
 License Database
```

and:

```text
Madar POS
    ↓
License API
```

Madar must NEVER access the License Database directly.

License Admin must NEVER access Madar's database.

The only integration boundary is the documented HTTPS API.

Before making major architectural decisions, explain them and document them.

Do not modify the Madar project.
