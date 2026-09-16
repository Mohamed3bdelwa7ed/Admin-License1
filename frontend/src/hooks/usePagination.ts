import { useMemo, useState } from "react";

/**
 * Client-side pagination over an already-fetched row list.
 * Used by pages whose backend endpoint returns all items at once
 * (customers, devices, activity). Server-paginated pages (licenses)
 * keep using the API's own page/totalPages instead.
 */
export function usePagination<T>(rows: T[], perPage = 8) {
  const [page, setPage] = useState(1);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const items = useMemo(
    () => rows.slice((safePage - 1) * perPage, safePage * perPage),
    [rows, safePage, perPage],
  );

  return { page: safePage, setPage, total, totalPages, perPage, items };
}
