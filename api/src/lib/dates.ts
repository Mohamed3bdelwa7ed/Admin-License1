import { createHash, randomUUID } from "node:crypto";

export function uuid(): string {
  return randomUUID();
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Serializes a Date (or string) to an ISO string for API DTOs. */
export function iso(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return nowISO();
  return value instanceof Date ? value.toISOString() : String(value);
}

/** License dates are stored as YYYY-MM-DD strings (contract format). */

export function effectiveStatusOf(
  license: Pick<LicenseLike, "status" | "expiresAt">,
  now = new Date(),
): "active" | "expired" | "revoked" | "suspended" {
  if (license.status === "revoked" || license.status === "suspended") return license.status;
  if (endOfDay(license.expiresAt).getTime() < now.getTime()) return "expired";
  return "active";
}

export interface LicenseLike {
  status: string;
  expiresAt: string;
}

export function endOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

export function daysUntil(dateStr: string): number {
  return Math.ceil((endOfDay(dateStr).getTime() - Date.now()) / 86_400_000);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addMonthsStr(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
