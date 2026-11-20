"use client";

import { useEffect, useState } from "react";

/** True on a phone-sized screen (below the shell's tablet breakpoint), so panels can open from the bottom there. */
export function useCompactScreen(query = "(max-width: 767px)"): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const media = typeof window.matchMedia === "function" ? window.matchMedia(query) : null;
    if (!media) return;
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return compact;
}
