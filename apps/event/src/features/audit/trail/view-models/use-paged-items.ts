"use client";

import { useState } from "react";

/** Client-side paging over an already-loaded list; returns to the first page whenever the list changes. */
export function usePagedItems<T>(items: readonly T[], pageSize: number) {
  const [page, setPage] = useState(0);
  const [source, setSource] = useState(items);
  if (source !== items) {
    setSource(items);
    setPage(0);
  }
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const start = current * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    page: current,
    pageCount,
    rangeLabel: items.length === 0 ? "0" : `${start + 1}–${Math.min(start + pageSize, items.length)} of ${items.length}`,
    previous: () => setPage(Math.max(0, current - 1)),
    next: () => setPage(Math.min(pageCount - 1, current + 1)),
  };
}

export type PagedItems<T> = ReturnType<typeof usePagedItems<T>>;
