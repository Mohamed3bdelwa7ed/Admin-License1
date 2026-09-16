/**
 * API entry point. Chooses the real HTTP backend or the in-memory mock.
 * Configure with .env in the frontend:
 *   VITE_API_MODE=http
 *   VITE_API_BASE_URL=http://localhost:4000
 */
import * as httpApi from "./httpApi";
import * as mockApi from "./mockApi";

export const mode = (import.meta.env.VITE_API_MODE as string | undefined) === "http" ? "http" : "mock";

const backend = mode === "http" ? httpApi : mockApi;

export const login = backend.login;
export const logout = backend.logout;
export const currentAdmin = backend.currentAdmin;
export const changePassword = backend.changePassword;
export const getDashboardStats = backend.getDashboardStats;
export const getRecentEvents = backend.getRecentEvents;
export const getExpiringLicenses = backend.getExpiringLicenses;
export const listLicenses = backend.listLicenses;
export const getLicense = backend.getLicense;
export const createLicense = backend.createLicense;
export const revokeLicense = backend.revokeLicense;
export const reactivateLicense = backend.reactivateLicense;
export const renewLicense = backend.renewLicense;
export const setMaxDevices = backend.setMaxDevices;
export const deleteLicense = backend.deleteLicense;
export const deactivateDevice = backend.deactivateDevice;
export const devicesForLicense = backend.devicesForLicense;
export const eventsForLicense = backend.eventsForLicense;
export const listCustomers = backend.listCustomers;
export const licensesForCustomer = backend.licensesForCustomer;
export const listDevices = backend.listDevices;
export const listActivity = backend.listActivity;
export const getLicenseDefaults = backend.getLicenseDefaults;
export const saveLicenseDefaults = backend.saveLicenseDefaults;
export const daysUntil = backend.daysUntil;
export const activeDeviceCount = backend.activeDeviceCount;
export const customerById = backend.customerById;
export const licenseById = backend.licenseById;
export const licenseByKey = backend.licenseByKey;

export type LicenseListResult = Awaited<ReturnType<typeof listLicenses>>;
export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;
export type CreateLicenseInput = Parameters<typeof createLicense>[0];
export type { LicenseDefaults } from "./httpApi";
export type { ActivityRow } from "./mockApi";
export type { CustomerRow } from "./mockApi";
export type { DeviceRow } from "./mockApi";
