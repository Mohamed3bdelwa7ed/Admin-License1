import { useEffect, useState } from "react";
import { changePassword, currentAdmin, getLicenseDefaults, saveLicenseDefaults, type LicenseDefaults } from "../api";
import { Button } from "../components/Button";
import { Input } from "../components/forms";
import { useToast } from "../components/Toast";
import { Card } from "../components/ui";

export default function Settings() {
  const { push } = useToast();
  const admin = currentAdmin();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const [defaults, setDefaults] = useState<LicenseDefaults | null>(null);
  const [defaultsBusy, setDefaultsBusy] = useState(false);

  useEffect(() => {
    void getLicenseDefaults().then(setDefaults);
  }, []);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      setPwError("New password must be at least 8 characters");
      return;
    }
    if (next !== confirm) {
      setPwError("New passwords do not match");
      return;
    }
    setPwError("");
    setPwBusy(true);
    try {
      await changePassword(current, next);
      push("success", "Password changed successfully");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      push("error", "Failed to change password");
    } finally {
      setPwBusy(false);
    }
  };

  const saveDefaults = async () => {
    if (!defaults) return;
    setDefaultsBusy(true);
    try {
      await saveLicenseDefaults(defaults);
      push("success", "License defaults saved");
    } catch {
      push("error", "Failed to save defaults");
    } finally {
      setDefaultsBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card title="Admin Profile">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
            {admin?.name.charAt(0) ?? "A"}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-green-50">{admin?.name}</p>
            <p className="text-xs text-gray-500 dark:text-green-100/50">{admin?.email}</p>
            <p className="mt-0.5 text-xs text-gray-400 capitalize dark:text-green-100/40">{admin?.role}</p>
          </div>
        </div>
      </Card>

      <Card title="Change Password">
        <form className="space-y-3" onSubmit={submitPassword}>
          <Input
            label="Current Password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="New Password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <Input
              label="Confirm New Password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={pwError}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={pwBusy} disabled={!current || !next || !confirm}>
              Change Password
            </Button>
          </div>
        </form>
      </Card>

      <Card title="License Defaults">
        {defaults ? (
          <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Default Duration (months)"
                type="number"
                min={1}
                max={60}
                value={defaults.defaultDurationMonths}
                onChange={(e) =>
                  setDefaults({ ...defaults, defaultDurationMonths: Number(e.target.value) })
                }
              />
              <Input
                label="Default Maximum Devices"
                type="number"
                min={1}
                max={50}
                value={defaults.defaultMaxDevices}
                onChange={(e) =>
                  setDefaults({ ...defaults, defaultMaxDevices: Number(e.target.value) })
                }
              />
              <Input
                label="Validation Interval (hours)"
                type="number"
                min={1}
                max={168}
                value={defaults.validationIntervalHours}
                onChange={(e) =>
                  setDefaults({ ...defaults, validationIntervalHours: Number(e.target.value) })
                }
              />
              <Input
                label="Offline Grace Period (days)"
                type="number"
                min={0}
                max={90}
                value={defaults.gracePeriodDays}
                onChange={(e) =>
                  setDefaults({ ...defaults, gracePeriodDays: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => void saveDefaults()} loading={defaultsBusy}>
                Save Defaults
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-24 animate-pulse rounded-md bg-gray-100 dark:bg-white/10" />
        )}
      </Card>
    </div>
  );
}
