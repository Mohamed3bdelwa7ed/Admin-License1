export type LicenseStatus = "active" | "expired" | "revoked" | "suspended";
export type DeviceStatus = "active" | "deactivated";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "viewer";
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  createdAt: string;
}

export interface DeviceActivation {
  id: string;
  licenseId: string;
  deviceId: string;
  deviceName: string;
  activatedAt: string;
  lastValidation: string | null;
  status: DeviceStatus;
}

export interface License {
  id: string;
  licenseKey: string;
  customerId: string;
  customerName: string;
  customerCompany: string;
  status: LicenseStatus;
  startDate: string;
  expirationDate: string;
  maxDevices: number;
  notes: string;
  createdAt: string;
  revokedAt: string | null;
  /** number of currently active devices (maintained by the API) */
  activeDevices: number;
}

export type LicenseEventType =
  | "license_created"
  | "license_activated"
  | "device_added"
  | "device_removed"
  | "device_deactivated"
  | "license_renewed"
  | "license_revoked"
  | "license_reactivated"
  | "license_validated";

export interface LicenseEvent {
  id: string;
  type: LicenseEventType;
  licenseId: string;
  customerId: string;
  adminName: string;
  message: string;
  createdAt: string;
}
