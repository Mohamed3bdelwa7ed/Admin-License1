import type { DeviceStatus, LicenseStatus } from "../types";

const statusConfig: Record<LicenseStatus, { label: string; classes: string }> = {
  active: { label: "Active", classes: "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30" },
  expired: { label: "Expired", classes: "bg-gray-100 text-gray-600 border-gray-300 dark:bg-white/5 dark:text-green-100/60 dark:border-white/15" },
  revoked: { label: "Revoked", classes: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30" },
  suspended: { label: "Suspended", classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30" },
};

const deviceStatusConfig: Record<DeviceStatus, { label: string; classes: string }> = {
  active: { label: "Active", classes: "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30" },
  deactivated: { label: "Deactivated", classes: "bg-gray-100 text-gray-600 border-gray-300 dark:bg-white/5 dark:text-green-100/60 dark:border-white/15" },
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
