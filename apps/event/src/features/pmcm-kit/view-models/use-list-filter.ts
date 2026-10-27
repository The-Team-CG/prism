"use client";

import { useCallback, useEffect, useState } from "react";

/** Keep a list filter in its URL so browser Back restores the same set of records. */
export function useListFilter(key: string, initialValue = "") {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const restore = () => setValue(new URLSearchParams(window.location.search).get(key) ?? initialValue);
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [key, initialValue]);

  const update = useCallback((next: string) => {
    setValue(next);
    const url = new URL(window.location.href);
    if (next && next !== initialValue) url.searchParams.set(key, next);
    else url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url);
  }, [key, initialValue]);

  return [value, update] as const;
}
