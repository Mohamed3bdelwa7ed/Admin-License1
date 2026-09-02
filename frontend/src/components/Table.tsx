import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  emptyHint?: string;
  loading?: boolean;
}

export function Table<T>({ columns, rows, rowKey, emptyMessage = "Nothing here yet", emptyHint, loading }: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-160 text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/80">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-semibold tracking-wide text-gray-500 uppercase ${col.headerClassName ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3.5">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <p className="text-sm font-medium text-gray-500">{emptyMessage}</p>
                {emptyHint && <p className="mt-1 text-xs text-gray-400">{emptyHint}</p>}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="transition-colors hover:bg-gray-50/70">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-gray-700 ${col.className ?? ""}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, perPage, onChange }: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-gray-500">
        Showing <span className="font-medium text-gray-700">{from}–{to}</span> of{" "}
        <span className="font-medium text-gray-700">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="h-8 cursor-pointer rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="h-8 cursor-pointer rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
