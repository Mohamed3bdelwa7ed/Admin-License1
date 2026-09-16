import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listActivity, type ActivityRow } from "../api";
import { Pagination, Table, type Column } from "../components/Table";
import { PageHeader } from "../components/ui";
import { usePagination } from "../hooks/usePagination";
import { formatDateTime, relativeTime } from "../utils/format";

const typeLabels: Record<ActivityRow["type"], string> = {
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

export default function Activity() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { page, setPage, total, totalPages, perPage, items } = usePagination(rows, 10);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      void listActivity(search).then((r) => {
        setRows(r);
        setLoading(false);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const columns: Column<ActivityRow>[] = [
    {
      key: "event",
      header: "Event",
      render: (e) => (
        <div>
          <p className="font-medium text-gray-800 dark:text-green-50">{typeLabels[e.type] ?? e.type}</p>
          <p className="text-xs text-gray-400 dark:text-green-100/40">{e.message}</p>
        </div>
      ),
    },
    {
      key: "license",
      header: "License",
      render: (e) => (
        <Link to={`/licenses/${e.licenseId}`} className="font-mono text-xs text-primary-600 hover:underline">
          {e.licenseKey}
        </Link>
      ),
    },
    { key: "customer", header: "Customer", render: (e) => <span className="text-gray-700 dark:text-green-100/85">{e.customerName}</span> },
    {
      key: "date",
      header: "Date",
      render: (e) => (
        <div>
          <p className="text-gray-700 dark:text-green-100/85">{formatDateTime(e.createdAt)}</p>
          <p className="text-xs text-gray-400 dark:text-green-100/40">{relativeTime(e.createdAt)}</p>
        </div>
      ),
    },
    { key: "admin", header: "Admin", render: (e) => <span className="text-gray-700 dark:text-green-100/85">{e.adminName}</span> },
  ];

  return (
    <div>
      <PageHeader title="Activity" subtitle={total > 0 ? `${total} events` : "License and device event log"} />

      <div className="mb-4">
        <div className="relative">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 dark:text-green-100/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search events, customers, admins..."
            className="h-9.5 w-72 rounded-md border border-gray-300 bg-white pr-3 pl-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-green-50 dark:placeholder:text-green-100/30 dark:focus:border-primary-400 dark:focus:ring-primary-500/20"
          />
        </div>
      </div>

      <Table
        columns={columns}
        rows={items}
        rowKey={(e) => e.id}
        loading={loading}
        emptyMessage="No activity found"
        emptyHint="Events are recorded automatically as licenses and devices change."
      />

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={total} perPage={perPage} onChange={setPage} />
      )}
    </div>
  );
}
