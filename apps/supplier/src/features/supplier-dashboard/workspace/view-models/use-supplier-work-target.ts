"use client";

import { useEffect } from "react";

/** A home work link opens its exact request or booking without losing other records. */
export function useSupplierWorkTarget() {
  useEffect(() => {
    function reveal() {
      const target = document.getElementById(window.location.hash.slice(1));
      if (target instanceof HTMLDetailsElement) {
        target.open = true;
        target.scrollIntoView({ block: "start" });
      }
    }
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
}
