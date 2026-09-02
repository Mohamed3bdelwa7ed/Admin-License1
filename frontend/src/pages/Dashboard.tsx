import { AlertTriangle, CheckCircle2, CreditCard, MonitorSmartphone, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  daysUntil,
  getDashboardStats,
  getExpiringLicenses,
  getRecentEvents,
  type DashboardStats,
} from "../api";
import { LicenseStatusBadge } from "../components/Badge";
import { Card, StatCard } from "../components/ui";
import type { License, LicenseEvent } from "../types";
import { daysLabel, formatDate, relativeTime } from "../utils/format";

const eventLabels: Record<LicenseEvent["type"], string> = {
  license_created: "License created",
  license_activated: "License activated",
  device_added: "Device added",
  device_removed: "Device removed",
  device_deactivated: "Device deactivated",
  license_renewed: "License renewed",
  license_revoked: "License revoked",
  license_reactivated: "License reactivated",
  license_validated: "License validated",
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<LicenseEvent[]>([]);
  const [expiring, setExpiring] = useState<License[]>([]);

  useEffect(() => {
    void (async () => {
      const [s, e, x] = await Promise.all([
        getDashboardStats(),
        getRecentEvents(8),
        getExpiringLicenses(30),
      ]);
      setStats(s);
      setEvents(e);
      setExpiring(x);
    })();
  }, []);

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Licenses" value={stats?.total ?? "—"} icon={<CreditCard size={17} />} />
        <StatCard
          label="Active Licenses"
          value={stats?.active ?? "—"}
          icon={<CheckCircle2 size={17} />}
          tone="success"
        />
        <StatCard
          label="Expiring Soon"
          value={stats?.expiringSoon ?? "—"}
          icon={<AlertTriangle size={17} />}
          tone="warning"
        />
        <StatCard
          label="Revoked Licenses"
          value={stats?.revoked ?? "—"}
          icon={<XCircle size={17} />}
          tone="danger"
        />
        <StatCard
          label="Active Devices"
          value={stats?.activeDevices ?? "—"}
          icon={<MonitorSmartphone size={17} />}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title="Expiring Licenses (next 30 days)">
            {expiring.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No licenses expiring in the next 30 days</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">License</th>
                      <th className="px-3 py-2">Expiration</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {expiring.map((l) => {
                      const days = daysUntil(l.expirationDate);
                      return (
                        <tr key={l.id} className="hover:bg-gray-50/70">
                          <td className="px-3 py-2.5">
                            <Link to={`/licenses/${l.id}`} className="font-medium text-primary-600 hover:underline">
                              {l.customerCompany || l.customerName}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{l.licenseKey}</td>
                          <td className="px-3 py-2.5">
                            <span className="text-gray-700">{formatDate(l.expirationDate)}</span>
                            <span
                              className={`ml-2 text-xs font-medium ${days <= 7 ? "text-red-600" : "text-amber-600"}`}
                            >
                              {daysLabel(days)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <LicenseStatusBadge status={l.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card title="Recent Activity">
          {events.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No activity yet</p>
          ) : (
            <ul className="space-y-1">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-gray-50">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                    <CheckCircle2 size={13} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug text-gray-800">
                      <span className="font-medium">{eventLabels[e.type] ?? e.type}</span> — {e.message}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {e.adminName} · {relativeTime(e.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
