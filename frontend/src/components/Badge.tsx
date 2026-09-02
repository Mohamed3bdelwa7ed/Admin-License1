import type { DeviceStatus, LicenseStatus } from "../types";

const statusConfig: Record<LicenseStatus, { label: string; classes: string }> = {
  active: { label: "Active", classes: "bg-green-50 text-green-700 border-green-200" },
  expired: { label: "Expired", classes: "bg-gray-100 text-gray-600 border-gray-300" },
  revoked: { label: "Revoked", classes: "bg-red-50 text-red-700 border-red-200" },
  suspended: { label: "Suspended", classes: "bg-amber-50 text-amber-700 border-amber-200" },
};

const deviceStatusConfig: Record<DeviceStatus, { label: string; classes: string }> = {
  active: { label: "Active", classes: "bg-green-50 text-green-700 border-green-200" },
  deactivated: { label: "Deactivated", classes: "bg-gray-100 text-gray-600 border-gray-300" },
};

export function LicenseStatusBadge({ status }: { status: LicenseStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  );
}

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const cfg = deviceStatusConfig[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  );
}
