"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PrismApprovalRequest } from "@prism/types";
import { selectPendingApprovals } from "@/features/pmcm-kit/model/pmcm-dashboard-selectors";

type LoadApprovalRequests = () => Promise<PrismApprovalRequest[]>;

export function usePmcmApprovalRequests({
  loadApprovalRequests,
  onError,
}: {
  loadApprovalRequests: LoadApprovalRequests;
  onError?: (error: unknown) => void;
}) {
  const [approvalRequests, setApprovalRequests] = useState<PrismApprovalRequest[]>([]);

  const refresh = useCallback(async () => {
    const next = await loadApprovalRequests();
    setApprovalRequests(next);
    return next;
  }, [loadApprovalRequests]);

  useEffect(() => {
    let cancelled = false;
    loadApprovalRequests()
      .then((next) => {
        if (!cancelled) setApprovalRequests(next);
      })
      .catch((error) => {
        if (!cancelled) onError?.(error);
      });

    return () => {
      cancelled = true;
    };
  }, [loadApprovalRequests, onError]);

  const pendingApprovals = useMemo(() => selectPendingApprovals(approvalRequests), [approvalRequests]);

  return {
    approvalRequests,
    pendingApprovals,
    refresh,
  };
}
