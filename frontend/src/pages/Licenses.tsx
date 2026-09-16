import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { listLicenses, deleteLicense, type LicenseListResult } from "../api";
import { LicenseStatusBadge } from "../components/Badge";
import { Button } from "../components/Button";
import { Select } from "../components/forms";
import { ConfirmDialog } from "../components/Modal";
import { Pagination, Table, type Column } from "../components/Table";
import { useToast } from "../components/Toast";
import { PageHeader } from "../components/ui";
import type { License } from "../types";
import { formatDate } from "../utils/format";
import CreateLicenseModal from "./CreateLicenseModal";

export default function Licenses() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { push } = useToast();
  const [result, setResult] = useState<LicenseListResult | null>(null);
  const [loading, setLoading] = useState(true);
  // deep-linkable filters: /licenses?search=Acme and /licenses?expiring=30
  // (used by Customers "View Licenses" and the dashboard expiring card)
  const [search, setSearch] = useState(() => params.get("search") ?? "");
  const [status, setStatus] = useState<"all" | License["status"]>("all");
  const [expiring, setExpiring] = useState<"any" | "30">(() => (params.get("expiring") === "30" ? "30" : "any"));
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<License | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [nonce, setNonce] = useState(0);

  // re-apply URL filters when navigating here with different params
  useEffect(() => {
    setSearch(params.get("search") ?? "");
    setExpiring(params.get("expiring") === "30" ? "30" : "any");
    setPage(1);
  }, [params]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      void listLicenses({
        search,
        status,
        expiringWithin: expiring === "30" ? 30 : null,
        page,
        perPage: 8,
      }).then((r) => {
        setResult(r);
        setLoading(false);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [search, status, expiring, page, nonce]);

  const onSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLicense(deleteTarget.id);
      push("success", "License permanently deleted — its key will no longer work");
      setDeleteTarget(null);
      // step back if we just emptied the page, otherwise refetch in place
      if (result && result.items.length <= 1 && page > 1) setPage(page - 1);
      else setNonce((n) => n + 1);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Failed to delete license");
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<Column<License>[]>(
    () => [
      {
        key: "key",
        header: "License Key",
        render: (l) => (
          <Link
            to={`/licenses/${l.id}`}
            className="font-mono text-xs font-medium text-primary-600 hover:underline"
          >
            {l.licenseKey}
          </Link>
        ),
      },
      {
        key: "customer",
        header: "Customer",
        render: (l) => (
          <div>
            <p className="font-medium text-gray-800 dark:text-green-50">{l.customerName}</p>
            <p className="text-xs text-gray-400 dark:text-green-100/40">{l.customerCompany}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (l) => <LicenseStatusBadge status={l.status} />,
      },
      {
        key: "expiration",
        header: "Expiration",
        render: (l) => formatDate(l.expirationDate),
      },
      {
        key: "devices",
        header: "Devices",
        render: (l) => (
          <span className="text-gray-700 dark:text-green-100/85">
            {l.activeDevices} / {l.maxDevices}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        headerClassName: "text-right",
        className: "text-right whitespace-nowrap",
        render: (l) => (
          <span className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => void navigate(`/licenses/${l.id}`)}>
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void navigate(`/licenses/${l.id}?renew=1`)}
            >
              Renew
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              onClick={() => setDeleteTarget(l)}
            >
              Delete
            </Button>
          </span>
        ),
      },
    ],
    [navigate],
  );

  return (
    <div>
      <PageHeader
        title="Licenses"
        subtitle={`${result?.total ?? 0} licenses total`}
        actions={
          <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
            Create License
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 dark:text-green-100/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search key, customer, company..."
            className="h-9.5 w-72 rounded-md border border-gray-300 bg-white pr-3 pl-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-green-50 dark:placeholder:text-green-100/30 dark:focus:border-primary-400 dark:focus:ring-primary-500/20"
          />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }} className="w-40">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
          <option value="suspended">Suspended</option>
        </Select>
        <Select value={expiring} onChange={(e) => { setExpiring(e.target.value as typeof expiring); setPage(1); }} className="w-44">
          <option value="any">Any expiration</option>
          <option value="30">Expiring in 30 days</option>
        </Select>
      </div>

      <Table
        columns={columns}
        rows={result?.items ?? []}
        rowKey={(l) => l.id}
        loading={loading}
        emptyMessage="No licenses found"
        emptyHint="Try adjusting your search or filters, or create a new license."
      />

      {result && result.totalPages > 1 && (
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          perPage={result.perPage}
          onChange={setPage}
        />
      )}

      <CreateLicenseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setPage(1)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void doDelete()}
        title="Delete License Permanently"
        message={
          deleteTarget
            ? `Permanently delete license ${deleteTarget.licenseKey} (${deleteTarget.customerName})? Its key will stop working immediately on all devices, and its devices and history will be removed. This cannot be undone — unlike Revoke, a deleted license can never be reactivated.`
            : ""
        }
        confirmLabel="Delete Permanently"
        danger
        loading={deleting}
      />
    </div>
  );
}
