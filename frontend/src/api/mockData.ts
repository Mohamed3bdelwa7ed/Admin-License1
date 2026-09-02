import type {
  Customer,
  DeviceActivation,
  License,
  LicenseEvent,
} from "../types";

export const customers: Customer[] = [
  { id: "c-001", name: "Omar Haddad", company: "Al Noor Store", email: "omar@alnoor.example", phone: "+963 991 111 222", createdAt: "2026-05-14T09:00:00Z" },
  { id: "c-002", name: "Layla Kassem", company: "Bloom Supermarket", email: "layla@bloom.example", phone: "+963 992 333 444", createdAt: "2026-06-02T11:30:00Z" },
  { id: "c-003", name: "Fadi Zaher", company: "Zaher Electronics", email: "fadi@zaher.example", phone: "+963 993 555 666", createdAt: "2026-06-18T14:15:00Z" },
  { id: "c-004", name: "Rania Saeed", company: "Saeed Pharma", email: "rania@saeed.example", phone: "+963 994 777 888", createdAt: "2026-07-01T10:45:00Z" },
  { id: "c-005", name: "Mahmoud Ali", company: "Ali Textiles", email: "mahmoud@alitextiles.example", phone: "+963 995 999 000", createdAt: "2026-07-22T08:20:00Z" },
  { id: "c-006", name: "Sara Nasser", company: "Nasser Foods", email: "sara@nasser.example", phone: "+963 996 121 212", createdAt: "2026-08-05T13:00:00Z" },
];

type LicenseFixture = Omit<License, "activeDevices">;

const licenseFixtures: LicenseFixture[] = [
  { id: "l-1001", licenseKey: "MDR7-K4PZ-9WQX-2F8A-3NVT", customerId: "c-001", customerName: "Omar Haddad", customerCompany: "Al Noor Store", status: "active", startDate: "2026-05-14", expirationDate: "2027-05-14", maxDevices: 2, notes: "Main branch license", createdAt: "2026-05-14T09:12:00Z", revokedAt: null },
  { id: "l-1002", licenseKey: "MDR3-T8YC-Q2KM-7XR4-D9LB", customerId: "c-002", customerName: "Layla Kassem", customerCompany: "Bloom Supermarket", status: "active", startDate: "2026-06-02", expirationDate: "2026-09-10", maxDevices: 3, notes: "Trial converted to annual", createdAt: "2026-06-02T11:45:00Z", revokedAt: null },
  { id: "l-1003", licenseKey: "MDR9-B5ND-E6HU-1QS8-Z4PK", customerId: "c-003", customerName: "Fadi Zaher", customerCompany: "Zaher Electronics", status: "active", startDate: "2026-06-18", expirationDate: "2026-09-08", maxDevices: 1, notes: "", createdAt: "2026-06-18T14:30:00Z", revokedAt: null },
  { id: "l-1004", licenseKey: "MDR1-J7WF-H3ZT-C5AY-U8MQ", customerId: "c-004", customerName: "Rania Saeed", customerCompany: "Saeed Pharma", status: "active", startDate: "2026-07-01", expirationDate: "2027-07-01", maxDevices: 5, notes: "HQ + 4 branches", createdAt: "2026-07-01T10:55:00Z", revokedAt: null },
  { id: "l-1005", licenseKey: "MDR4-P2VK-X8DR-G6NS-T3HW", customerId: "c-005", customerName: "Mahmoud Ali", customerCompany: "Ali Textiles", status: "expired", startDate: "2025-07-22", expirationDate: "2026-07-22", maxDevices: 2, notes: "Awaiting renewal payment", createdAt: "2025-07-22T08:35:00Z", revokedAt: null },
  { id: "l-1006", licenseKey: "MDR6-N9QZ-S4TU-B7EK-M2JC", customerId: "c-006", customerName: "Sara Nasser", customerCompany: "Nasser Foods", status: "revoked", startDate: "2026-08-05", expirationDate: "2027-08-05", maxDevices: 1, notes: "Chargeback dispute", createdAt: "2026-08-05T13:20:00Z", revokedAt: "2026-08-20T16:00:00Z" },
  { id: "l-1007", licenseKey: "MDR8-D3XR-W1FY-K9CQ-V5LB", customerId: "c-001", customerName: "Omar Haddad", customerCompany: "Al Noor Store", status: "active", startDate: "2026-08-12", expirationDate: "2026-09-15", maxDevices: 1, notes: "Second branch (temporary)", createdAt: "2026-08-12T09:05:00Z", revokedAt: null },
  { id: "l-1008", licenseKey: "MDR2-G6HT-A4QN-J8WD-R7ZS", customerId: "c-002", customerName: "Layla Kassem", customerCompany: "Bloom Supermarket", status: "active", startDate: "2026-08-18", expirationDate: "2027-08-18", maxDevices: 2, notes: "", createdAt: "2026-08-18T15:40:00Z", revokedAt: null },
  { id: "l-1009", licenseKey: "MDR5-Z9KC-M2FV-T6XP-H4DN", customerId: "c-003", customerName: "Fadi Zaher", customerCompany: "Zaher Electronics", status: "active", startDate: "2026-08-25", expirationDate: "2026-09-20", maxDevices: 2, notes: "Seasonal promotion license", createdAt: "2026-08-25T10:10:00Z", revokedAt: null },
  { id: "l-1010", licenseKey: "MDR0-Q7YB-R3JW-E5MK-X8TF", customerId: "c-004", customerName: "Rania Saeed", customerCompany: "Saeed Pharma", status: "expired", startDate: "2025-08-01", expirationDate: "2026-08-01", maxDevices: 1, notes: "Old test license", createdAt: "2025-08-01T12:00:00Z", revokedAt: null },
];

export const devices: DeviceActivation[] = [
  { id: "d-5001", licenseId: "l-1001", deviceId: "A7F3-9K2M-XQ81", deviceName: "ALNOOR-CASHIER-01", activatedAt: "2026-05-14T10:02:00Z", lastValidation: "2026-08-30T08:41:00Z", status: "active" },
  { id: "d-5002", licenseId: "l-1001", deviceId: "B2E8-4L7P-ZT35", deviceName: "ALNOOR-CASHIER-02", activatedAt: "2026-05-20T14:18:00Z", lastValidation: "2026-08-30T08:45:00Z", status: "active" },
  { id: "d-5003", licenseId: "l-1002", deviceId: "C9D4-1N6R-YW02", deviceName: "BLOOM-POS-1", activatedAt: "2026-06-02T12:15:00Z", lastValidation: "2026-08-29T19:03:00Z", status: "active" },
  { id: "d-5004", licenseId: "l-1002", deviceId: "D5T1-8Q3V-KU77", deviceName: "BLOOM-POS-2", activatedAt: "2026-06-10T09:40:00Z", lastValidation: "2026-08-29T19:05:00Z", status: "active" },
  { id: "d-5005", licenseId: "l-1002", deviceId: "E3R7-2M9W-XD10", deviceName: "BLOOM-WAREHOUSE", activatedAt: "2026-06-21T16:22:00Z", lastValidation: "2026-08-20T11:11:00Z", status: "deactivated" },
  { id: "d-5006", licenseId: "l-1003", deviceId: "F8W2-5P4N-QZ64", deviceName: "ZAHER-DESKTOP", activatedAt: "2026-06-18T15:01:00Z", lastValidation: "2026-08-30T07:58:00Z", status: "active" },
  { id: "d-5007", licenseId: "l-1004", deviceId: "G4K9-7X2B-NE29", deviceName: "SAEED-HQ-POS", activatedAt: "2026-07-01T11:30:00Z", lastValidation: "2026-08-30T09:12:00Z", status: "active" },
  { id: "d-5008", licenseId: "l-1004", deviceId: "H6M3-9D8F-QA55", deviceName: "SAEED-BRANCH-1", activatedAt: "2026-07-03T10:05:00Z", lastValidation: "2026-08-30T09:14:00Z", status: "active" },
  { id: "d-5009", licenseId: "l-1004", deviceId: "J1N7-4R2T-WB88", deviceName: "SAEED-BRANCH-2", activatedAt: "2026-07-05T13:44:00Z", lastValidation: "2026-08-29T17:36:00Z", status: "active" },
  { id: "d-5010", licenseId: "l-1005", deviceId: "K9Q4-2W6Y-VC31", deviceName: "ALI-TEXTILE-01", activatedAt: "2025-07-22T09:00:00Z", lastValidation: "2026-07-22T06:00:00Z", status: "active" },
  { id: "d-5011", licenseId: "l-1006", deviceId: "L2B8-7F5H-XM73", deviceName: "NASSER-POS-1", activatedAt: "2026-08-05T13:45:00Z", lastValidation: "2026-08-19T23:59:00Z", status: "deactivated" },
  { id: "d-5012", licenseId: "l-1007", deviceId: "M5V3-1K9D-ZR42", deviceName: "ALNOOR-CASHIER-03", activatedAt: "2026-08-12T09:30:00Z", lastValidation: "2026-08-30T08:50:00Z", status: "active" },
  { id: "d-5013", licenseId: "l-1008", deviceId: "N7X6-3P4Q-YK18", deviceName: "BLOOM-POS-3", activatedAt: "2026-08-18T16:05:00Z", lastValidation: "2026-08-30T07:20:00Z", status: "active" },
  { id: "d-5014", licenseId: "l-1009", deviceId: "P3D9-8M2S-WF61", deviceName: "ZAHER-LAPTOP", activatedAt: "2026-08-25T10:35:00Z", lastValidation: "2026-08-30T06:15:00Z", status: "active" },
  { id: "d-5015", licenseId: "l-1010", deviceId: "Q6F2-5H8N-XT94", deviceName: "SAEED-TEST-PC", activatedAt: "2025-08-01T12:30:00Z", lastValidation: "2026-08-01T04:00:00Z", status: "active" },
];

/** Licenses with the derived activeDevices count (computed from devices). */
export const licenses: License[] = licenseFixtures.map((l) => ({
  ...l,
  activeDevices: 0, // replaced below after devices are defined
}));
for (const l of licenses) {
  l.activeDevices = devices.filter((d) => d.licenseId === l.id && d.status === "active").length;
}

export const events: LicenseEvent[] = [
  { id: "e-9001", type: "device_added", licenseId: "l-1009", customerId: "c-003", adminName: "System", message: "Device ZAHER-LAPTOP activated", createdAt: "2026-08-25T10:35:00Z" },
  { id: "e-9002", type: "license_created", licenseId: "l-1009", customerId: "c-003", adminName: "MoHashem", message: "License created for Zaher Electronics", createdAt: "2026-08-25T10:10:00Z" },
  { id: "e-9003", type: "device_added", licenseId: "l-1008", customerId: "c-002", adminName: "System", message: "Device BLOOM-POS-3 activated", createdAt: "2026-08-18T16:05:00Z" },
  { id: "e-9004", type: "license_created", licenseId: "l-1008", customerId: "c-002", adminName: "MoHashem", message: "License created for Bloom Supermarket", createdAt: "2026-08-18T15:40:00Z" },
  { id: "e-9005", type: "license_revoked", licenseId: "l-1006", customerId: "c-006", adminName: "MoHashem", message: "License revoked: chargeback dispute", createdAt: "2026-08-20T16:00:00Z" },
  { id: "e-9006", type: "device_deactivated", licenseId: "l-1006", customerId: "c-006", adminName: "MoHashem", message: "Device NASSER-POS-1 deactivated", createdAt: "2026-08-20T16:01:00Z" },
  { id: "e-9007", type: "device_removed", licenseId: "l-1002", customerId: "c-002", adminName: "MoHashem", message: "Device BLOOM-WAREHOUSE deactivated by admin", createdAt: "2026-08-20T11:11:00Z" },
  { id: "e-9008", type: "device_added", licenseId: "l-1007", customerId: "c-001", adminName: "System", message: "Device ALNOOR-CASHIER-03 activated", createdAt: "2026-08-12T09:30:00Z" },
  { id: "e-9009", type: "license_created", licenseId: "l-1007", customerId: "c-001", adminName: "MoHashem", message: "License created for Al Noor Store (second branch)", createdAt: "2026-08-12T09:05:00Z" },
  { id: "e-9010", type: "license_validated", licenseId: "l-1004", customerId: "c-004", adminName: "System", message: "Periodic validation succeeded (3 devices)", createdAt: "2026-08-11T09:00:00Z" },
  { id: "e-9011", type: "device_added", licenseId: "l-1004", customerId: "c-004", adminName: "System", message: "Device SAEED-BRANCH-2 activated", createdAt: "2026-07-05T13:44:00Z" },
  { id: "e-9012", type: "license_renewed", licenseId: "l-1002", customerId: "c-002", adminName: "MoHashem", message: "License extended to 2026-09-10", createdAt: "2026-06-30T09:00:00Z" },
  { id: "e-9013", type: "license_created", licenseId: "l-1006", customerId: "c-006", adminName: "MoHashem", message: "License created for Nasser Foods", createdAt: "2026-08-05T13:20:00Z" },
  { id: "e-9014", type: "license_created", licenseId: "l-1004", customerId: "c-004", adminName: "MoHashem", message: "License created for Saeed Pharma", createdAt: "2026-07-01T10:55:00Z" },
  { id: "e-9015", type: "license_activated", licenseId: "l-1001", customerId: "c-001", adminName: "System", message: "First activation for ALNOOR-CASHIER-01", createdAt: "2026-05-14T10:02:00Z" },
];
