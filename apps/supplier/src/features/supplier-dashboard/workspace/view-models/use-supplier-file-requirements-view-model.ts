"use client";

import { useEffect, useMemo, useState } from "react";
import type { PrismAuthenticatedSession, PrismFileRequirementsMatrix } from "@prism/types";
import { buildQuoteByRequest, filterSelectedRequests } from "../model/supplier-workspace-rules";
import type { SupplierWorkspace } from "../model/supplier-workspace-types";
import { loadSupplierFileRequirements } from "../use-cases/supplier-workspace-actions";

export function useSupplierFileRequirementsViewModel(
  workspace: SupplierWorkspace,
  session: PrismAuthenticatedSession,
) {
  const eventIds = useMemo(() => [...new Set(
    filterSelectedRequests(workspace.quoteRequests, buildQuoteByRequest(workspace.supplierQuotes))
      .map((request) => request.eventId),
  )].sort(), [workspace.quoteRequests, workspace.supplierQuotes]);
  const eventIdsKey = JSON.stringify(eventIds);
  const [matrices, setMatrices] = useState<PrismFileRequirementsMatrix[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const currentEventIds = JSON.parse(eventIdsKey) as string[];
    setStatus("loading");
    setError(null);
    setMatrices([]);
    loadSupplierFileRequirements(session, currentEventIds)
      .then((next) => {
        if (!active) return;
        setMatrices(next);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load file requirements.");
        setStatus("error");
      });
    return () => { active = false; };
  }, [eventIdsKey, session]);

  return { matrices, status, error };
}
