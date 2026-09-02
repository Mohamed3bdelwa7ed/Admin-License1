Build a simple and clean **License Admin Web UI** for the Madar POS licensing system.

## Goal

Create a professional admin dashboard for managing Madar licenses.

Keep the design **simple, clean, and practical**.

Do not over-design it.

## Tech

Use:

* React
* TypeScript
* Vite
* Tailwind CSS

Keep the frontend independent from Madar POS.

---

## Layout

Use a simple layout:

```text
┌──────────────────────────────────────────────┐
│ Madar License                    Admin       │
├────────────┬─────────────────────────────────┤
│ Dashboard  │                                 │
│ Licenses   │          Main Content            │
│ Customers  │                                 │
│ Devices    │                                 │
│ Activity   │                                 │
│ Settings   │                                 │
│            │                                 │
│ Logout     │                                 │
└────────────┴─────────────────────────────────┘
```

Desktop-first, responsive on smaller screens.

---

## Dashboard

Show simple statistic cards:

* Total Licenses
* Active Licenses
* Expiring Soon
* Revoked Licenses
* Active Devices

Below them show:

### Recent Activity

Simple list/table of recent events.

### Expiring Licenses

Simple table showing:

* Customer
* License
* Expiration
* Status

---

## Licenses Page

Create a simple table.

Columns:

* License Key
* Customer
* Status
* Expiration
* Devices
* Actions

Add:

* Search
* Status filter
* Create License button

Actions:

* View
* Renew
* Revoke

Use simple status badges:

* Active
* Expired
* Revoked

---

## Create License

Simple form:

### Customer

* Customer Name
* Store/Company Name
* Email
* Phone

### License

* Start Date
* Expiration Date
* Maximum Devices
* Notes

Button:

**Create License**

After successful creation, show the generated license key with a **Copy** button.

---

## License Details

Show:

* License Key
* Customer
* Status
* Start Date
* Expiration Date
* Maximum Devices
* Active Devices

Then show an activated devices table:

* Device ID
* Activated Date
* Last Validation
* Status
* Deactivate

Also show a simple license activity/history list.

---

## Customers

Simple searchable table:

* Customer
* Company
* Licenses
* Devices
* Status
* Actions

---

## Devices

Simple searchable table:

* Device ID
* Customer
* License
* Activated
* Last Validation
* Status
* Actions

---

## Activity

Simple activity table:

* Event
* License
* Customer
* Date
* Admin

---

## Settings

Keep it minimal:

* Admin Profile
* Change Password
* License Defaults

Do not expose secrets or private keys.

---

## Login

Create a simple login screen:

Madar License

Email

Password

Sign In

Clean centered layout.

---

## Design

Use:

* White/light background
* Dark text
* One primary blue color
* Gray borders
* Small rounded corners
* Simple shadows
* Clear typography
* Simple icons

Avoid:

* gradients
* glassmorphism
* excessive animations
* huge cards
* unnecessary charts
* complicated visual effects

The UI should feel like a **small professional SaaS admin panel**.

---

## Important

For this task, focus on the **frontend UI and user experience**.

Do not build the License API unless explicitly requested.

Do not connect directly to a database.

Use mock data initially so all screens can be demonstrated.

Create reusable components for:

* Sidebar
* Header
* Cards
* Tables
* Status badges
* Forms
* Modals
* Toast notifications
* Loading states
* Empty states

Make the design consistent across every page.

After implementation, run the application and verify that all navigation and screens work correctly.
