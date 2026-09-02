import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listCustomers, type CustomerRow } from "../api";
import { Button } from "../components/Button";
import { Table, type Column } from "../components/Table";
import { PageHeader } from "../components/ui";

export default function Customers() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      void listCustomers(search).then((r) => {
        setRows(r);
        setLoading(false);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const columns: Column<CustomerRow>[] = [
    {
      key: "customer",
      header: "Customer",
      render: (c) => (
        <div>
          <p className="font-medium text-gray-800">{c.name}</p>
          <p className="text-xs text-gray-400">{c.company || "—"}</p>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      render: (c) => c.company || "—",
    },
    {
      key: "licenses",
      header: "Licenses",
      render: (c) => (
        <span className="text-gray-700">
          {c.activeLicenses} active
          <span className="text-gray-400"> / {c.licenseCount} total</span>
        </span>
      ),
    },
    { key: "devices", header: "Devices", render: (c) => <span className="text-gray-700">{c.deviceCount}</span> },
    {
      key: "status",
      header: "Status",
      render: (c) =>
        c.activeLicenses > 0 ? (
          <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            Inactive
          </span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      headerClassName: "text-right",
      className: "text-right",
      render: (c) => (
        <Link to={`/licenses?search=${encodeURIComponent(c.name)}`}>
          <Button variant="ghost" size="sm">
            View Licenses
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${rows.length} customers`} />

      <div className="mb-4">
        <div className="relative">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, email..."
            className="h-9.5 w-72 rounded-md border border-gray-300 bg-white pr-3 pl-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
          />
        </div>
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        loading={loading}
        emptyMessage="No customers found"
        emptyHint="Customers are created automatically when you create their first license."
      />
    </div>
  );
}
