"use client";

import { useEffect, useState } from "react";
import type { PrismFileRequirementsMatrix } from "@prism/types";
import { loadFileRequirementsMatrix } from "../use-cases/load-file-requirements-matrix";

export type FileRequirementsMatrixStatus = "idle" | "loading" | "success" | "error";

export function useFileRequirementsMatrixViewModel(eventId?: string) {
  const [matrix, setMatrix] = useState<PrismFileRequirementsMatrix | null>(null);
  const [status, setStatus] = useState<FileRequirementsMatrixStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setMatrix(null);
      setStatus("idle");
      setError(null);
      return;
    }

    let alive = true;
    setStatus("loading");
    setError(null);
    loadFileRequirementsMatrix(eventId)
      .then((next) => {
        if (!alive) return;
        setMatrix(next);
        setStatus("success");
      })
      .catch((err) => {
        if (!alive) return;
        setMatrix(null);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Unable to load file requirements.");
      });

    return () => {
      alive = false;
    };
  }, [eventId]);

  return { matrix, status, error };
}
