import type {
  AdminUser,
  Customer,
  DeviceActivation,
  License,
  LicenseEvent,
  LicenseStatus,
} from "../types";
import { customers, devices, events, licenses } from "./mockData";

/**
 * Mock API layer. Simulates the future License API (`/api/v1/...`) with
 * in-memory data and artificial latency. Every component talks ONLY to
 * this module, so swapping it for real HTTP calls later touches nothing
 * above this file.
 */

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

// ---- in-memory store (cloned so UI mutations don't leak into fixtures) ----
const db = {
  customers: structuredClone(customers),
  licenses: structuredClone(licenses),
  devices: structuredClone(devices),
  events: structuredClone(events),
};

let idCounter = 5000;
const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

// ---- helpers ----
const byDateDesc = (a: { createdAt: string }, b: { createdAt: string }) =>
  b.createdAt.localeCompare(a.createdAt);

export function computeStatus(license: License, today = new Date()): LicenseStatus {
  if (license.status === "revoked") return "revoked";
  if (license.status === "suspended") return "suspended";
  const now = today.getTime();
  if (new Date(license.startDate).getTime() > now) return "suspended";
  if (new Date(license.expirationDate).getTime() < now) return "expired";
  return "active";
}

function effectiveStatus(license: License): LicenseStatus {
  return computeStatus(license);
}

function logEvent(
  type: LicenseEvent["type"],
  license: License,
  message: string,
  adminName = "MoHashem",
) {
  db.events.unshift({
    id: nextId("e"),
    type,
    licenseId: license.id,
    customerId: license.customerId,
    adminName,
    message,
    createdAt: new Date().toISOString(),
  });
}

/** Stamps effective status + active device count onto a license. */
function enrich(l: License): License {
  return { ...l, status: effectiveStatus(l), activeDevices: activeDeviceCount(l.id) };
}

export function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function activeDeviceCount(licenseId: string): number {
  return db.devices.filter((d) => d.licenseId === licenseId && d.status === "active").length;
}

export async function devicesForLicense(licenseId: string): Promise<DeviceActivation[]> {
  await delay(100);
  return db.devices.filter((d) => d.licenseId === licenseId);
}

export async function eventsForLicense(licenseId: string): Promise<LicenseEvent[]> {
  await delay(100);
  return db.events.filter((e) => e.licenseId === licenseId).sort(byDateDesc);
}

export async function customerById(id: string): Promise<Customer | undefined> {
  await delay(100);
  return db.customers.find((c) => c.id === id);
}

export async function licenseById(id: string): Promise<License | undefined> {
  await delay(100);
  const found = db.licenses.find((l) => l.id === id);
  return found ? enrich(found) : undefined;
}

export async function licenseByKey(key: string): Promise<License | undefined> {
  await delay(100);
  const found = db.licenses.find((l) => l.licenseKey === key);
  return found ? enrich(found) : undefined;
}

// ---- auth (mock; real API issues JWT + httpOnly cookie) ----
const ADMIN: AdminUser = {
  id: "u-001",
  name: "MoHashem",
  email: "admin@madar.example",
  role: "admin",
};
const ADMIN_PASSWORD = "admin123"; // demo only

export async function login(email: string, password: string): Promise<AdminUser> {
  await delay(400);
  if (email.trim().toLowerCase() === ADMIN.email && password === ADMIN_PASSWORD) {
    sessionStorage.setItem("madar_admin", JSON.stringify(ADMIN));
    return ADMIN;
  }
  throw new Error("Invalid email or password");
}

export function logout(): void {
  sessionStorage.removeItem("madar_admin");
}

export function currentAdmin(): AdminUser | null {
  const raw = sessionStorage.getItem("madar_admin");
  try {
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

export async function changePassword(_current: string, _next: string): Promise<void> {
  await delay(500);
}

// ---- dashboard ----
export interface DashboardStats {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  revoked: number;
  activeDevices: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await delay();
  const enriched = db.licenses.map(enrich);
  return {
    total: enriched.length,
    active: enriched.filter((l) => l.status === "active").length,
    expiringSoon: enriched.filter(
      (l) => l.status === "active" && daysUntil(l.expirationDate) <= 30 && daysUntil(l.expirationDate) >= 0,
    ).length,
    expired: enriched.filter((l) => l.status === "expired").length,
    revoked: enriched.filter((l) => l.status === "revoked").length,
    activeDevices: db.devices.filter((d) => d.status === "active").length,
  };
}

export async function getRecentEvents(limit = 8): Promise<LicenseEvent[]> {
  await delay();
  return [...db.events].sort(byDateDesc).slice(0, limit);
}

export async function getExpiringLicenses(days = 30): Promise<License[]> {
  await delay();
  return db.licenses
    .map(enrich)
    .filter((l) => l.status === "active" && daysUntil(l.expirationDate) <= days)
    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));
}

// ---- licenses ----
export interface LicenseFilters {
  search?: string;
  status?: LicenseStatus | "all";
  expiringWithin?: number | null;
  page?: number;
  perPage?: number;
}

export interface LicenseListResult {
  items: License[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function listLicenses(filters: LicenseFilters = {}): Promise<LicenseListResult> {
  await delay();
  const { search = "", status = "all", expiringWithin = null, page = 1, perPage = 8 } = filters;
  const q = search.trim().toLowerCase();

  let rows = db.licenses.map(enrich);

  if (q) {
    rows = rows.filter(
      (l) =>
        l.licenseKey.toLowerCase().includes(q) ||
        l.customerName.toLowerCase().includes(q) ||
        l.customerCompany.toLowerCase().includes(q),
    );
  }
  if (status !== "all") rows = rows.filter((l) => l.status === status);
  if (expiringWithin != null) {
    rows = rows.filter(
      (l) =>
        l.status === "active" &&
        daysUntil(l.expirationDate) <= expiringWithin &&
        daysUntil(l.expirationDate) >= 0,
    );
  }

  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const items = rows.slice((safePage - 1) * perPage, safePage * perPage);
  return { items, total, page: safePage, perPage, totalPages };
}

export async function getLicense(id: string): Promise<License | null> {
  await delay();
  const found = db.licenses.find((l) => l.id === id);
  return found ? enrich(found) : null;
}

export interface CreateLicenseInput {
  customerName: string;
  company: string;
  email: string;
  phone: string;
  startDate: string;
  expirationDate: string;
  maxDevices: number;
  notes: string;
}

/** Generates a secure-looking random key, server-side in the real API. */
function generateLicenseKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () => {
    let b = "";
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    for (const byte of bytes) b += alphabet[byte % alphabet.length];
    return b;
  };
  return `MDR-${block()}-${block()}-${block()}-${block()}`;
}

export interface CreateLicenseResult {
  license: License;
  customerCreated: boolean;
}

export async function createLicense(input: CreateLicenseInput): Promise<CreateLicenseResult> {
  await delay(500);

  // validation (mirrors future API rules)
  if (!input.customerName.trim()) throw new Error("Customer name is required");
  if (!input.expirationDate) throw new Error("Expiration date is required");
  if (input.startDate && input.expirationDate < input.startDate)
    throw new Error("Expiration date must be after start date");
  if (!Number.isInteger(input.maxDevices) || input.maxDevices < 1 || input.maxDevices > 50)
    throw new Error("Maximum devices must be between 1 and 50");

  // find or create customer by email
  let customer = db.customers.find(
    (c) => c.email.toLowerCase() === input.email.trim().toLowerCase(),
  );
  let customerCreated = false;
  if (!customer) {
    customer = {
      id: nextId("c"),
      name: input.customerName.trim(),
      company: input.company.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      createdAt: new Date().toISOString(),
    };
    db.customers.push(customer);
    customerCreated = true;
  }

  const license: License = {
    id: nextId("l"),
    licenseKey: generateLicenseKey(),
    customerId: customer.id,
    customerName: customer.name,
    customerCompany: customer.company,
    status: "active",
    startDate: input.startDate || new Date().toISOString().slice(0, 10),
    expirationDate: input.expirationDate,
    maxDevices: input.maxDevices,
    notes: input.notes.trim(),
    createdAt: new Date().toISOString(),
    revokedAt: null,
    activeDevices: 0,
  };
  db.licenses.unshift(license);
  logEvent("license_created", license, `License created for ${customer.company || customer.name}`);
  return { license, customerCreated };
}

export async function revokeLicense(id: string, reason = ""): Promise<License> {
  await delay();
  const license = db.licenses.find((l) => l.id === id);
  if (!license) throw new Error("License not found");
  if (license.status === "revoked") throw new Error("License is already revoked");
  license.status = "revoked";
  license.revokedAt = new Date().toISOString();
  logEvent("license_revoked", license, `License revoked${reason ? `: ${reason}` : ""}`);
  return enrich(license);
}

export async function reactivateLicense(id: string): Promise<License> {
  await delay();
  const license = db.licenses.find((l) => l.id === id);
  if (!license) throw new Error("License not found");
  if (license.status !== "revoked") throw new Error("Only revoked licenses can be reactivated");
  license.status = "active";
  license.revokedAt = null;
  logEvent("license_reactivated", license, "License reactivated");
  return enrich(license);
}

export async function renewLicense(id: string, newExpiration: string): Promise<License> {
  await delay();
  const license = db.licenses.find((l) => l.id === id);
  if (!license) throw new Error("License not found");
  if (newExpiration <= license.expirationDate)
    throw new Error("New expiration must be after the current expiration");
  license.expirationDate = newExpiration;
  if (license.status === "expired") license.status = "active";
  logEvent("license_renewed", license, `License extended to ${newExpiration}`);
  return enrich(license);
}

export async function setMaxDevices(id: string, maxDevices: number): Promise<License> {
  await delay();
  const license = db.licenses.find((l) => l.id === id);
  if (!license) throw new Error("License not found");
  if (!Number.isInteger(maxDevices) || maxDevices < 1 || maxDevices > 50)
    throw new Error("Maximum devices must be between 1 and 50");
  const activeCount = activeDeviceCount(license.id);
  if (maxDevices < activeCount)
    throw new Error(`Cannot set limit below current active devices (${activeCount})`);
  license.maxDevices = maxDevices;
  logEvent("license_renewed", license, `Device limit changed to ${maxDevices}`);
  return enrich(license);
}

export async function deactivateDevice(licenseId: string, deviceId: string): Promise<void> {
  await delay();
  const device = db.devices.find((d) => d.licenseId === licenseId && d.id === deviceId);
  if (!device) throw new Error("Device not found");
  if (device.status === "deactivated") throw new Error("Device is already deactivated");
  device.status = "deactivated";
  const license = db.licenses.find((l) => l.id === licenseId);
  if (license)
    logEvent("device_deactivated", license, `Device ${device.deviceName || device.deviceId} deactivated`);
}

// ---- customers ----
export interface CustomerRow extends Customer {
  licenseCount: number;
  activeLicenses: number;
  deviceCount: number;
}

export async function listCustomers(search = ""): Promise<CustomerRow[]> {
  await delay();
  const q = search.trim().toLowerCase();
  return db.customers
    .filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    )
    .map((c) => {
      const custLicenses = db.licenses.filter((l) => l.customerId === c.id);
      const licenseIds = new Set(custLicenses.map((l) => l.id));
      return {
        ...c,
        licenseCount: custLicenses.length,
        activeLicenses: custLicenses.filter((l) => effectiveStatus(l) === "active").length,
        deviceCount: db.devices.filter(
          (d) => licenseIds.has(d.licenseId) && d.status === "active",
        ).length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function licensesForCustomer(customerId: string): Promise<License[]> {
  await delay();
  return db.licenses
    .filter((l) => l.customerId === customerId)
    .map(enrich)
    .sort(byDateDesc);
}

// ---- devices ----
export interface DeviceRow extends DeviceActivation {
  customerName: string;
  customerCompany: string;
  licenseKey: string;
  licenseStatus: LicenseStatus;
}

export async function listDevices(search = "", status: "all" | "active" | "deactivated" = "all"): Promise<DeviceRow[]> {
  await delay();
  const q = search.trim().toLowerCase();
  return db.devices
    .filter((d) => {
      if (status !== "all" && d.status !== status) return false;
      if (!q) return true;
      const license = db.licenses.find((l) => l.id === d.licenseId);
      return (
        d.deviceId.toLowerCase().includes(q) ||
        (d.deviceName ?? "").toLowerCase().includes(q) ||
        (license?.customerName ?? "").toLowerCase().includes(q) ||
        (license?.customerCompany ?? "").toLowerCase().includes(q) ||
        (license?.licenseKey ?? "").toLowerCase().includes(q)
      );
    })
    .map((d) => {
      const license = db.licenses.find((l) => l.id === d.licenseId)!;
      return {
        ...d,
        customerName: license.customerName,
        customerCompany: license.customerCompany,
        licenseKey: license.licenseKey,
        licenseStatus: effectiveStatus(license),
      };
    })
    .sort((a, b) => b.activatedAt.localeCompare(a.activatedAt));
}

// ---- activity ----
export interface ActivityRow extends LicenseEvent {
  licenseKey: string;
  customerName: string;
}

export async function listActivity(search = "", limit = 100): Promise<ActivityRow[]> {
  await delay();
  const q = search.trim().toLowerCase();
  return db.events
    .filter((e) => {
      if (!q) return true;
      const license = db.licenses.find((l) => l.id === e.licenseId);
      return (
        e.message.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        e.adminName.toLowerCase().includes(q) ||
        (license?.licenseKey ?? "").toLowerCase().includes(q) ||
        (license?.customerName ?? "").toLowerCase().includes(q)
      );
    })
    .sort(byDateDesc)
    .slice(0, limit)
    .map((e) => {
      const license = db.licenses.find((l) => l.id === e.licenseId);
      return {
        ...e,
        licenseKey: license?.licenseKey ?? "—",
        customerName: license?.customerName ?? "—",
      };
    });
}

// ---- settings ----
export interface LicenseDefaults {
  defaultDurationMonths: number;
  defaultMaxDevices: number;
  validationIntervalHours: number;
  gracePeriodDays: number;
}

let licenseDefaults: LicenseDefaults = {
  defaultDurationMonths: 12,
  defaultMaxDevices: 2,
  validationIntervalHours: 24,
  gracePeriodDays: 14,
};

export async function getLicenseDefaults(): Promise<LicenseDefaults> {
  await delay(200);
  return { ...licenseDefaults };
}

export async function saveLicenseDefaults(next: LicenseDefaults): Promise<void> {
  await delay(400);
  licenseDefaults = { ...next };
}
