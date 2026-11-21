"use client";

import { useEffect, useState } from "react";

const WORK_TARGET = "#supplier-work-";

/** The link a card's title carries, so a new tab or a shared link opens the same request or booking. */
export function supplierWorkTargetHash(id: string) {
  return `${WORK_TARGET}${encodeURIComponent(id)}`;
}

/**
 * The request or booking a work link names (`#supplier-work-<id>`), opened in its side panel when the page loads or
 * the link changes. Opening and closing the panel keeps the address in step, so refresh and back reopen it.
 */
export function useSupplierWorkTarget(ids: string[]) {
  const [openId, setOpenId] = useState<string | null>(null);
  const key = ids.join("|");
  useEffect(() => {
    function reveal() {
      const hash = window.location.hash;
      if (!hash.startsWith(WORK_TARGET)) return;
      const id = decodeURIComponent(hash.slice(WORK_TARGET.length));
      if (key.split("|").includes(id)) setOpenId(id);
    }
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [key]);
  function open(id: string | null) {
    setOpenId(id);
    const url = `${window.location.pathname}${window.location.search}${id ? supplierWorkTargetHash(id) : ""}`;
    window.history.replaceState(null, "", url);
  }
  return { openId, open };
}
