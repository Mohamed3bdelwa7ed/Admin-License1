/**
 * Real HTTP client for the License API. Same function surface as mockApi.ts,
 * so pages import `../api/index` and get whichever backend is configured:
 *   VITE_API_MODE=http  +  VITE_API_BASE_URL=http://localhost:4000  -> real API
 *   (default)                                                    -> mock data
 */

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:4000";

export interface ApiError extends Error {
  code?: string;
  status?: number;
  details?: unknown;
}

let refreshing: Promise<boolean> | null = null;

/** Attempts to exchange the refresh token for a new access token. */
async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refreshToken = sessionStorage.getItem("madar_refresh");
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${BASE}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as { accessToken: string; refreshToken: string; user: import("../types").AdminUser };
      sessionStorage.setItem("madar_access_token", json.accessToken);
      sessionStorage.setItem("madar_refresh", json.refreshToken);
      sessionStorage.setItem("madar_admin", JSON.stringify(json.user));
      return true;
    } catch {
      return false;
    } finally {
      // release lock after a beat so parallel 401s share one refresh
      setTimeout(() => (refreshing = null), 100);
    }
  })();
  return refreshing;
}

/** Clears the dead session and forces the user back to the login page. */
function forceRelogin(): void {
  sessionStorage.removeItem("madar_access_token");
  sessionStorage.removeItem("madar_refresh");
  sessionStorage.removeItem("madar_admin");
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login?expired=1";
  }
}

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const doFetch = (): Promise<Response> => {
    const token = sessionStorage.getItem("madar_access_token");
    return fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  // access token expired -> try one silent refresh, then retry the request
  if (res.status === 401 && auth && !path.startsWith("/api/v1/auth/")) {
    const ok = await tryRefresh();
    if (ok) {
      res = await doFetch();
    } else {
      forceRelogin();
      const err = new Error("Session expired — please sign in again") as ApiError;
      err.code = "UNAUTHORIZED";
      err.status = 401;
      throw err;
    }
  }

  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error((json.error as { message?: string } | undefined)?.message ?? `Request failed (${res.status})`) as ApiError;
    err.code = (json.error as { code?: string } | undefined)?.code;
    err.status = res.status;
    err.details = (json.error as { details?: unknown } | undefined)?.details;
    throw err;
  }
  return json as T;
}

// ---- session ----
const ADMIN_SESSION_KEY = "madar_admin";

export async function login(email: string, password: string): Promise<import("../types").AdminUser> {
  const res = await request<{ user: import("../types").AdminUser; accessToken: string; refreshToken: string }>(
    "POST",
    "/api/v1/auth/login",
    { email, password },
    false,
  );
  sessionStorage.setItem("madar_access_token", res.accessToken);
  sessionStorage.setItem("madar_refresh", res.refreshToken);
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(res.user));
  return res.user;
}

export function logout(): void {
  const refreshToken = sessionStorage.getItem("madar_refresh");
  if (refreshToken) {
    void request("POST", "/api/v1/auth/logout", { refreshToken }).catch(() => undefined);
  }
  sessionStorage.removeItem("madar_access_token");
  sessionStorage.removeItem("madar_refresh");
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function currentAdmin(): import("../types").AdminUser | null {
  // a stored user means nothing without a live token pair
  const token = sessionStorage.getItem("madar_access_token");
  const refresh = sessionStorage.getItem("madar_refresh");
  if (!token || !refresh) {
    sessionStorage.removeItem("madar_admin");
    return null;
  }
  const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
  try {
    return raw ? (JSON.parse(raw) as import("../types").AdminUser) : null;
  } catch {
    return null;
  }
}

export async function changePassword(current: string, next: string): Promise<void> {
  await request("POST", "/api/v1/auth/change-password", { currentPassword: current, newPassword: next });
}

// ---- mapping helpers (API DTO -> frontend types) ----
interface ApiLicense {
  id: string;
  licenseKey: string;
  customerId: string;
  customerName: string;
  customerCompany: string;
  status: import("../types").LicenseStatus;
  startDate: string;
  expirationDate: string;
  maxDevices: number;
  notes: string;
  createdAt: string;
  activeDevices: number;
  revokedAt: string | null;
}

function toLicense(l: ApiLicense): import("../types").License {
  return {
    id: l.id,
    licenseKey: l.licenseKey,
    customerId: l.customerId,
    customerName: l.customerName,
    customerCompany: l.customerCompany,
    status: l.status,
    startDate: l.startDate,
    expirationDate: l.expirationDate,
    maxDevices: l.maxDevices,
    notes: l.notes,
    createdAt: l.createdAt,
    revokedAt: l.revokedAt ?? null,
    activeDevices: l.activeDevices ?? 0,
  };
}

// ---- dashboard ----
export async function getDashboardStats(): Promise<{
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  revoked: number;
  activeDevices: number;
}> {
  return request("GET", "/api/v1/stats");
}

export async function getRecentEvents(limit = 8): Promise<import("../types").LicenseEvent[]> {
  const res = await request<{ items: ApiEvent[] }>("GET", `/api/v1/events?limit=${limit}`);
  return res.items.map(toEvent);
}

export async function getExpiringLicenses(days = 30): Promise<import("../types").License[]> {
  const res = await request<{ items: ApiLicense[] }>("GET", `/api/v1/licenses?expiringWithin=${days}&perPage=50`);
  return res.items.map(toLicense);
}

// ---- licenses ----
export async function listLicenses(filters: {
  search?: string;
  status?: import("../types").LicenseStatus | "all";
  expiringWithin?: number | null;
  page?: number;
  perPage?: number;
} = {}): Promise<{ items: import("../types").License[]; total: number; page: number; perPage: number; totalPages: number }> {
  const { search = "", status = "all", expiringWithin = null, page = 1, perPage = 8 } = filters;
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage), status });
  if (search) params.set("search", search);
  if (expiringWithin != null) params.set("expiringWithin", String(expiringWithin));
  const res = await request<{ items: ApiLicense[]; total: number; page: number; perPage: number; totalPages: number }>(
    "GET",
    `/api/v1/licenses?${params.toString()}`,
  );
  return { ...res, items: res.items.map(toLicense) };
}

export async function getLicense(id: string): Promise<import("../types").License | null> {
  try {
    const l = await request<ApiLicense>("GET", `/api/v1/licenses/${id}`);
    return toLicense(l);
  } catch (e) {
    if ((e as ApiError).status === 404) return null;
    throw e;
  }
}

export async function createLicense(input: {
  customerName: string;
  company: string;
  email: string;
  phone: string;
  startDate: string;
  expirationDate: string;
  maxDevices: number;
  notes: string;
}): Promise<{ license: import("../types").License; customerCreated: boolean }> {
  const res = await request<{ license: ApiLicense; customerCreated: boolean }>("POST", "/api/v1/licenses", input);
  return { license: toLicense(res.license), customerCreated: res.customerCreated };
}

export async function revokeLicense(id: string, reason = ""): Promise<import("../types").License> {
  const l = await request<ApiLicense>("POST", `/api/v1/licenses/${id}/revoke`, { reason });
  return toLicense(l);
}

export async function reactivateLicense(id: string): Promise<import("../types").License> {
  const l = await request<ApiLicense>("POST", `/api/v1/licenses/${id}/reactivate`, {});
  return toLicense(l);
}

export async function renewLicense(id: string, newExpiration: string): Promise<import("../types").License> {
  const l = await request<ApiLicense>("POST", `/api/v1/licenses/${id}/renew`, { expirationDate: newExpiration });
  return toLicense(l);
}

export async function setMaxDevices(id: string, maxDevices: number): Promise<import("../types").License> {
  const l = await request<ApiLicense>("POST", `/api/v1/licenses/${id}/device-limit`, { maxDevices });
  return toLicense(l);
}

// ---- devices ----
interface ApiDevice {
  id: string;
  licenseId: string;
  deviceId: string;
  deviceName: string;
  activatedAt: string;
  lastValidation: string | null;
  status: import("../types").DeviceStatus;
}

function toDevice(d: ApiDevice, licenseId: string): import("../types").DeviceActivation {
  return { ...d, licenseId };
}

export async function getLicenseDevices(licenseId: string): Promise<import("../types").DeviceActivation[]> {
  const res = await request<{ items: ApiDevice[] }>("GET", `/api/v1/licenses/${licenseId}/devices`);
  return res.items.map((d) => toDevice(d, licenseId));
}

// mock-parity helpers (used by LicenseDetails page)
export function devicesForLicense(licenseId: string): Promise<import("../types").DeviceActivation[]> {
  return getLicenseDevices(licenseId);
}

export async function licenseById(id: string): Promise<import("../types").License | undefined> {
  const found = await getLicense(id);
  return found ?? undefined;
}

export async function licenseByKey(key: string): Promise<import("../types").License | undefined> {
  const res = await listLicenses({ search: key, perPage: 1 });
  return res.items[0]?.licenseKey === key ? res.items[0] : undefined;
}

export async function customerById(id: string): Promise<import("../types").Customer | undefined> {
  try {
    return await request<import("../types").Customer>("GET", `/api/v1/customers/${id}`);
  } catch {
    return undefined;
  }
}

export async function deactivateDevice(licenseId: string, deviceRowId: string): Promise<void> {
  await request("DELETE", `/api/v1/licenses/${licenseId}/devices/${deviceRowId}`);
}

export async function listDevices(
  search = "",
  status: "all" | "active" | "deactivated" = "all",
): Promise<(import("../types").DeviceActivation & { customerName: string; customerCompany: string; licenseKey: string; licenseStatus: import("../types").LicenseStatus })[]> {
  const params = new URLSearchParams({ status });
  if (search) params.set("search", search);
  const res = await request<{
    items: (ApiDevice & {
      customerName: string;
      customerCompany: string;
      licenseKey: string;
      licenseId: string;
      licenseStatus: import("../types").LicenseStatus;
    })[];
  }>("GET", `/api/v1/devices?${params.toString()}`);
  return res.items.map((d) => ({
    ...toDevice(d, d.licenseId),
    customerName: d.customerName,
    customerCompany: d.customerCompany,
    licenseKey: d.licenseKey,
    licenseStatus: d.licenseStatus,
  }));
}

export function activeDeviceCount(licenseId: string): number {
  void licenseId;
  return 0; // not used in http mode — listLicenses returns activeDevices in the DTO
}

// ---- events / activity ----
interface ApiEvent {
  id: string;
  type: import("../types").LicenseEventType;
  licenseId: string | null;
  customerId: string | null;
  actor: string;
  message: string;
  createdAt: string;
  licenseKey: string | null;
  customerName: string | null;
}

function toEvent(e: ApiEvent): import("../types").LicenseEvent {
  return {
    id: e.id,
    type: e.type,
    licenseId: e.licenseId ?? "",
    customerId: e.customerId ?? "",
    adminName: e.actor,
    message: e.message,
    createdAt: e.createdAt,
  };
}

export function eventsForLicense(licenseId: string): Promise<import("../types").LicenseEvent[]> {
  return request<{ items: ApiEvent[] }>("GET", `/api/v1/licenses/${licenseId}/events`).then((r) => r.items.map(toEvent));
}

export async function listActivity(search = "", limit = 100): Promise<(import("../types").LicenseEvent & { licenseKey: string; customerName: string })[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (search) params.set("search", search);
  const res = await request<{ items: ApiEvent[] }>("GET", `/api/v1/events?${params.toString()}`);
  return res.items.map((e) => ({ ...toEvent(e), licenseKey: e.licenseKey ?? "—", customerName: e.customerName ?? "—" }));
}

// ---- customers ----
export async function listCustomers(search = ""): Promise<(import("../types").Customer & { licenseCount: number; activeLicenses: number; deviceCount: number })[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await request<{ items: (import("../types").Customer & { licenseCount: number; activeLicenses: number; deviceCount: number })[] }>(
    "GET",
    `/api/v1/customers${params}`,
  );
  return res.items;
}

export async function licensesForCustomer(customerId: string): Promise<import("../types").License[]> {
  const res = await request<{ licenses: ApiLicense[] }>("GET", `/api/v1/customers/${customerId}`);
  return res.licenses.map(toLicense);
}

// ---- settings ----
export interface LicenseDefaults {
  defaultDurationMonths: number;
  defaultMaxDevices: number;
  validationIntervalHours: number;
  gracePeriodDays: number;
}

export async function getLicenseDefaults(): Promise<LicenseDefaults> {
  return request("GET", "/api/v1/settings/license-defaults");
}

export async function saveLicenseDefaults(defaults: LicenseDefaults): Promise<void> {
  await request("PUT", "/api/v1/settings/license-defaults", defaults);
}

// ---- helpers kept for parity ----
export function daysUntil(dateStr: string): number {
  const diff = new Date(`${dateStr}T23:59:59.999Z`).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}
