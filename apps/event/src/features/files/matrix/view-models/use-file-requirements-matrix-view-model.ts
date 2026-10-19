"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismFileRequirementsMatrix } from "@prism/types";
import { loadFileRequirementsMatrix } from "../use-cases/load-file-requirements-matrix";

export type FileRequirementsMatrixStatus = "idle" | "loading" | "success" | "error";

export function useFileRequirementsMatrixViewModel(eventId?: string) {
  const [matrix, setMatrix] = useState<PrismFileRequirementsMatrix | null>(null);
  const [status, setStatus] = useState<FileRequirementsMatrixStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isCurrent: () => boolean) => {
    if (!eventId) return;
    setStatus("loading");
    setError(null);
    try {
      const next = await loadFileRequirementsMatrix(eventId);
      if (!isCurrent()) return;
      setMatrix(next);
      setStatus("success");
    } catch (err) {
      if (!isCurrent()) return;
      setMatrix(null);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unable to load file requirements.");
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      setMatrix(null);
      setStatus("idle");
      setError(null);
      return;
    }

    let alive = true;
    void load(() => alive);
    return () => {
      alive = false;
    };
  }, [eventId, load]);

  const reload = useCallback(() => load(() => true), [load]);

  return { matrix, status, error, reload };
}
