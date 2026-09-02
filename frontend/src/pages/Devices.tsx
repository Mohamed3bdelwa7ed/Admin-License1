import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listDevices, type DeviceRow } from "../api";
import { DeviceStatusBadge } from "../components/Badge";
import { Button } from "../components/Button";
import { Select } from "../components/forms";
import { Table, type Column } from "../components/Table";
import { PageHeader } from "../components/ui";
import { formatDateTime } from "../utils/format";

export default function Devices() {
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "deactivated">("all");

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      void listDevices(search, status).then((r) => {
        setRows(r);
        setLoading(false);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [search, status]);

  const columns: Column<DeviceRow>[] = [
    {
      key: "deviceId",
      header: "Device ID",
      render: (d) => (
        <div>
          <p className="font-mono text-xs font-medium text-gray-800">{d.deviceId}</p>
          <p className="text-xs text-gray-400">{d.deviceName}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (d) => (
        <div>
          <p className="font-medium text-gray-800">{d.customerName}</p>
          <p className="text-xs text-gray-400">{d.customerCompany}</p>
        </div>
      ),
    },
    {
      key: "license",
      header: "License",
      render: (d) => (
        <Link to={`/licenses/${d.licenseId}`} className="font-mono text-xs text-primary-600 hover:underline">
          {d.licenseKey}
        </Link>
      ),
    },
    { key: "activated", header: "Activated", render: (d) => formatDateTime(d.activatedAt) },
    { key: "lastValidation", header: "Last Validation", render: (d) => formatDateTime(d.lastValidation) },
    { key: "status", header: "Status", render: (d) => <DeviceStatusBadge status={d.status} /> },
    {
      key: "actions",
      header: "Actions",
      headerClassName: "text-right",
      className: "text-right",
      render: (d) => (
        <Link to={`/licenses/${d.licenseId}`}>
          <Button variant="ghost" size="sm">
            View License
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Devices" subtitle={`${rows.length} device activations`} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search device, customer, license..."
            className="h-9.5 w-72 rounded-md border border-gray-300 bg-white pr-3 pl-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-40">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
        </Select>
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(d) => d.id}
        loading={loading}
        emptyMessage="No devices found"
        emptyHint="Devices appear here after the Madar POS client activates a license."
      />
    </div>
  );
}
