"use client";

import { useEffect } from "react";

/** A PMCM inbox link opens its exact event-day task once the task list has rendered. */
export function useEventDayTaskTarget() {
  useEffect(() => {
    function reveal() {
      const hash = window.location.hash;
      if (!hash.startsWith("#event-day-task-")) return;
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: "start" });
    }
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
}
