import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Copy,
  History,
  MonitorSmartphone,
  Pencil,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  deactivateDevice,
  devicesForLicense,
  eventsForLicense,
  getLicense,
  reactivateLicense,
  renewLicense,
  revokeLicense,
  setMaxDevices,
} from "../api";
import { DeviceStatusBadge, LicenseStatusBadge } from "../components/Badge";
import { Button } from "../components/Button";
import { Input } from "../components/forms";
import { ConfirmDialog, Modal } from "../components/Modal";
import { Table, type Column } from "../components/Table";
import { useToast } from "../components/Toast";
import { Card, Spinner } from "../components/ui";
import type { DeviceActivation, License, LicenseEvent } from "../types";
import { formatDate, formatDateTime, relativeTime } from "../utils/format";

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

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export default function LicenseDetails() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { push } = useToast();

  const [license, setLicense] = useState<License | null>(null);
  const [devices, setDevices] = useState<DeviceActivation[]>([]);
  const [events, setEvents] = useState<LicenseEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [newExpiration, setNewExpiration] = useState("");
  const [limitOpen, setLimitOpen] = useState(false);
  const [newMaxDevices, setNewMaxDevices] = useState("");
  const [deviceToDeactivate, setDeviceToDeactivate] = useState<DeviceActivation | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const l = await getLicense(id);
    if (!l) {
      push("error", "License not found");
      navigate("/licenses", { replace: true });
      return;
    }
    setLicense(l);
    setDevices(await devicesForLicense(l.id));
    setEvents(await eventsForLicense(l.id));
    setLoading(false);
  }, [id, navigate, push]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // auto-open renew dialog via ?renew=1 (from Licenses table action)
  useEffect(() => {
    if (license && params.get("renew")) {
      setNewExpiration(addMonths(license.expirationDate, 12));
      setRenewOpen(true);
      setParams({}, { replace: true });
    }
  }, [license, params, setParams]);

  if (loading || !license) {
    return <Spinner label="Loading license..." />;
  }

  const activeCount = license.activeDevices;

  const doRevoke = async () => {
    setBusy(true);
    try {
      await revokeLicense(license.id);
      push("success", "License revoked");
      setRevokeOpen(false);
      await refresh();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Failed to revoke license");
    } finally {
      setBusy(false);
    }
  };

  const doReactivate = async () => {
    setBusy(true);
    try {
      await reactivateLicense(license.id);
      push("success", "License reactivated");
      await refresh();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Failed to reactivate license");
    } finally {
      setBusy(false);
    }
  };

  const doRenew = async () => {
    setBusy(true);
    try {
      await renewLicense(license.id, newExpiration);
      push("success", "License extended");
      setRenewOpen(false);
      await refresh();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Failed to extend license");
    } finally {
      setBusy(false);
    }
  };

  const doLimit = async () => {
    setBusy(true);
    try {
      await setMaxDevices(license.id, Number(newMaxDevices));
      push("success", "Device limit updated");
      setLimitOpen(false);
      await refresh();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Failed to update device limit");
    } finally {
      setBusy(false);
    }
  };

  const doDeactivateDevice = async () => {
    if (!deviceToDeactivate) return;
    setBusy(true);
    try {
      await deactivateDevice(license.id, deviceToDeactivate.id);
      push("success", "Device deactivated");
      setDeviceToDeactivate(null);
      await refresh();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Failed to deactivate device");
    } finally {
      setBusy(false);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(license.licenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      push("error", "Could not copy");
    }
  };

  const deviceColumns: Column<DeviceActivation>[] = [
    {
      key: "deviceId",
      header: "Device ID",
      render: (d) => (
        <div>
          <p className="font-mono text-xs font-medium text-gray-800 dark:text-green-50">{d.deviceId}</p>
          <p className="text-xs text-gray-400 dark:text-green-100/40">{d.deviceName}</p>
        </div>
      ),
    },
    { key: "activatedAt", header: "Activated Date", render: (d) => formatDateTime(d.activatedAt) },
    { key: "lastValidation", header: "Last Validation", render: (d) => formatDateTime(d.lastValidation) },
    { key: "status", header: "Status", render: (d) => <DeviceStatusBadge status={d.status} /> },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (d) =>
        d.status === "active" ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
            onClick={() => setDeviceToDeactivate(d)}
          >
            Deactivate
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => navigate("/licenses")}
            className="mb-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-green-100/50 dark:hover:text-green-100"
          >
            <ArrowLeft size={13} /> Back to licenses
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-lg font-semibold tracking-tight text-gray-900 dark:text-green-50">{license.licenseKey}</h1>
            <LicenseStatusBadge status={license.status} />
            <Button variant="ghost" size="sm" icon={copied ? <CheckCircle2 size={13} /> : <Copy size={13} />} onClick={() => void copyKey()}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-green-100/50">
            {license.customerName} · {license.customerCompany}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {license.status === "revoked" ? (
            <Button icon={<RotateCcw size={15} />} loading={busy} onClick={() => void doReactivate()}>
              Reactivate
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                icon={<History size={15} />}
                onClick={() => {
                  setNewExpiration(addMonths(license.expirationDate, 12));
                  setRenewOpen(true);
                }}
              >
                Renew
              </Button>
              <Button
                variant="secondary"
                icon={<Pencil size={15} />}
                onClick={() => {
                  setNewMaxDevices(String(license.maxDevices));
                  setLimitOpen(true);
                }}
              >
                Device Limit
              </Button>
              <Button variant="danger" icon={<Ban size={15} />} onClick={() => setRevokeOpen(true)}>
                Revoke
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="License Information">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-1">
            {[
              ["License ID", license.id],
              ["Customer", license.customerName],
              ["Company", license.customerCompany || "—"],
              ["Start Date", formatDate(license.startDate)],
              ["Expiration Date", formatDate(license.expirationDate)],
              ["Maximum Devices", String(license.maxDevices)],
              ["Active Devices", `${activeCount} of ${license.maxDevices}`],
              ["Created", formatDate(license.createdAt)],
              ...(license.revokedAt ? [["Revoked", formatDateTime(license.revokedAt)] as [string, string]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-green-100/50">{label}</dt>
                <dd className="text-right text-sm font-medium text-gray-800 dark:text-green-100/90">{value}</dd>
              </div>
            ))}
          </dl>
          {license.notes && (
            <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-green-100/10 dark:bg-white/5">
              <p className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-green-100/50">Notes</p>
              <p className="mt-1 text-sm text-gray-700 dark:text-green-100/85">{license.notes}</p>
            </div>
          )}
        </Card>

        <div className="xl:col-span-2">
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-green-50">
                <MonitorSmartphone size={15} className="text-gray-400 dark:text-green-100/40" /> Activated Devices ({devices.length})
              </h2>
              <span className="text-xs text-gray-400 dark:text-green-100/40">
                {activeCount} active of {license.maxDevices} allowed
              </span>
            </div>
            <Table
              columns={deviceColumns}
              rows={devices}
              rowKey={(d) => d.id}
              emptyMessage="No devices activated"
              emptyHint="Devices appear here after the Madar POS client activates this license."
            />
          </div>

          <Card title="History">
            {events.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400 dark:text-green-100/40">No history recorded</p>
            ) : (
              <ul className="space-y-1">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-gray-50 dark:hover:bg-white/5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
                      <ShieldCheck size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-gray-800 dark:text-green-100/90">
                        <span className="font-medium">{eventLabels[e.type] ?? e.type}</span> — {e.message}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-green-100/40">
                        {e.adminName} · {formatDateTime(e.createdAt)} ({relativeTime(e.createdAt)})
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        onConfirm={() => void doRevoke()}
        title="Revoke License"
        message={`Are you sure you want to revoke this license? ${license.customerName} will no longer be able to activate or validate devices using ${license.licenseKey}. This action is logged in the audit history.`}
        confirmLabel="Revoke License"
        danger
        loading={busy}
      />

      <Modal
        open={renewOpen}
        onClose={() => setRenewOpen(false)}
        title="Extend License"
        widthClass="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenewOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void doRenew()} loading={busy} disabled={!newExpiration || newExpiration <= license.expirationDate}>
              Extend
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-green-100/70">
            Current expiration: <span className="font-medium text-gray-900 dark:text-green-50">{formatDate(license.expirationDate)}</span>
          </p>
          <Input
            label="New Expiration Date"
            type="date"
            value={newExpiration}
            min={license.expirationDate}
            onChange={(e) => setNewExpiration(e.target.value)}
          />
          <p className="text-xs text-gray-400 dark:text-green-100/40">
            The new date must be after the current expiration. If the license is expired, extending it will set it back to active.
          </p>
        </div>
      </Modal>

      <Modal
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        title="Change Device Limit"
        widthClass="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLimitOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void doLimit()} loading={busy} disabled={!newMaxDevices}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Maximum Devices"
            type="number"
            min={1}
            max={50}
            value={newMaxDevices}
            onChange={(e) => setNewMaxDevices(e.target.value)}
          />
          <p className="text-xs text-gray-400 dark:text-green-100/40">
            Currently {activeCount} active device(s). The limit cannot be set below the number of active devices.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={deviceToDeactivate !== null}
        onClose={() => setDeviceToDeactivate(null)}
        onConfirm={() => void doDeactivateDevice()}
        title="Deactivate Device"
        message={
          deviceToDeactivate
            ? `Are you sure you want to deactivate device ${deviceToDeactivate.deviceName || deviceToDeactivate.deviceId}? The Madar POS client on this device will fail validation until it re-activates.`
            : ""
        }
        confirmLabel="Deactivate"
        danger
        loading={busy}
      />
    </div>
  );
}
