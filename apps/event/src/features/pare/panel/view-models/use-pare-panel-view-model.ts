"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PAREApprovalRecord } from "@prism/types";
import { useEventOpsCommands } from "@/features/event-ops";
import { createPareRepository } from "../data/pare-repository";
import { selectEventPareApprovals } from "../model/pare-panel-rules";

export function useParePanelViewModel({
  eventId,
  onWithdraw,
}: {
  eventId: string;
  onWithdraw: (requestId: string) => Promise<void>;
}) {
  const commands = useEventOpsCommands();
  const repository = useMemo(() => createPareRepository(commands), [commands]);
  const [approvals, setApprovals] = useState<PAREApprovalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventApprovals = useMemo(
    () => selectEventPareApprovals(approvals, eventId),
    [approvals, eventId],
  );

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      setApprovals(await repository.listPending());
    } catch {
      // PARE is asynchronous and may not have produced a record yet.
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void fetchApprovals();
  }, [fetchApprovals]);

  const handleWithdraw = useCallback(async (requestId: string) => {
    setWithdrawingId(requestId);
    setError(null);
    try {
      await onWithdraw(requestId);
      await new Promise((resolve) => setTimeout(resolve, 800));
      await fetchApprovals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdraw failed");
    } finally {
      setWithdrawingId(null);
    }
  }, [fetchApprovals, onWithdraw]);

  const handleApprove = useCallback(async (id: string) => {
    setActionBusy(true);
    setError(null);
    try {
      const updated = await repository.approve(id);
      setApprovals((previous) => previous.map((approval) => (approval.id === id ? updated : approval)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActionBusy(false);
    }
  }, [repository]);

  const handleReject = useCallback(async (id: string) => {
    setActionBusy(true);
    setError(null);
    try {
      const updated = await repository.reject(id);
      setApprovals((previous) => previous.map((approval) => (approval.id === id ? updated : approval)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setActionBusy(false);
    }
  }, [repository]);

  return {
    approvals,
    eventApprovals,
    loading,
    actionBusy,
    withdrawingId,
    error,
    status: loading || actionBusy || Boolean(withdrawingId) ? ("loading" as const) : error ? ("error" as const) : ("idle" as const),
    fetchApprovals,
    handleWithdraw,
    handleApprove,
    handleReject,
  };
}
