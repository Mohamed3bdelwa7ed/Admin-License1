import { Check, Copy, Plus } from "lucide-react";
import { useState } from "react";
import { createLicense, type CreateLicenseInput } from "../api";
import { Button } from "../components/Button";
import { Input, Textarea } from "../components/forms";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import type { License } from "../types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export default function CreateLicenseModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState<CreateLicenseInput>({
    customerName: "",
    company: "",
    email: "",
    phone: "",
    startDate: todayISO(),
    expirationDate: addMonths(todayISO(), 12),
    maxDevices: 2,
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<License | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof CreateLicenseInput>(key: K, value: CreateLicenseInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.customerName.trim()) e.customerName = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Invalid email";
    if (!form.expirationDate) e.expirationDate = "Required";
    else if (form.startDate && form.expirationDate < form.startDate)
      e.expirationDate = "Must be after start date";
    if (form.maxDevices < 1 || form.maxDevices > 50) e.maxDevices = "Between 1 and 50";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await createLicense(form);
      setCreated(result.license);
      onCreated();
      push("success", "License created successfully");
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Failed to create license");
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    onClose();
    setTimeout(() => {
      setCreated(null);
      setCopied(false);
      setErrors({});
      setForm({
        customerName: "",
        company: "",
        email: "",
        phone: "",
        startDate: todayISO(),
        expirationDate: addMonths(todayISO(), 12),
        maxDevices: 2,
        notes: "",
      });
    }, 200);
  };

  const copyKey = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.licenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      push("error", "Could not copy — please select the key manually");
    }
  };

  if (created) {
    return (
      <Modal
        open={open}
        onClose={resetAndClose}
        title="License Created"
        widthClass="max-w-md"
        footer={
          <Button variant="secondary" onClick={resetAndClose}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-green-600">
            <Check size={22} />
          </div>
          <p className="text-sm text-gray-500">
            License for <span className="font-medium text-gray-800">{created.customerCompany || created.customerName}</span>{" "}
            was created. Provide this key to the customer:
          </p>
          <div className="w-full rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-center">
            <p className="font-mono text-lg font-semibold tracking-wide text-gray-900 select-all">
              {created.licenseKey}
            </p>
          </div>
          <p className="text-xs text-gray-400">
            This key is shown once here. Copy it now — it is displayed in full only on the license details page for admins.
          </p>
          <Button icon={copied ? <Check size={15} /> : <Copy size={15} />} onClick={() => void copyKey()} className="w-full">
            {copied ? "Copied!" : "Copy License Key"}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Create License"
      widthClass="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={resetAndClose} disabled={submitting}>
            Cancel
          </Button>
          <Button icon={<Plus size={15} />} loading={submitting} onClick={() => void onSubmit()}>
            Create License
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
      >
        <fieldset>
          <legend className="mb-2.5 text-sm font-semibold text-gray-900">Customer</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Customer Name"
              value={form.customerName}
              onChange={(e) => set("customerName", e.target.value)}
              error={errors.customerName}
              placeholder="Omar Haddad"
            />
            <Input
              label="Store / Company Name"
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
              placeholder="Al Noor Store"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              error={errors.email}
              placeholder="omar@alnoor.example"
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+963 991 111 222"
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2.5 text-sm font-semibold text-gray-900">License</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Start Date"
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
            <Input
              label="Expiration Date"
              type="date"
              value={form.expirationDate}
              onChange={(e) => set("expirationDate", e.target.value)}
              error={errors.expirationDate}
            />
            <Input
              label="Maximum Devices"
              type="number"
              min={1}
              max={50}
              value={form.maxDevices}
              onChange={(e) => set("maxDevices", Number(e.target.value))}
              error={errors.maxDevices}
            />
          </div>
          <Textarea
            label="Notes"
            className="mt-3"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Optional internal notes..."
          />
        </fieldset>
        <p className="text-xs text-gray-400">
          The license key is generated securely by the server and will be shown once after creation.
        </p>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
