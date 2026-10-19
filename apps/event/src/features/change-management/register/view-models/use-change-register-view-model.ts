"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RecordEventDecisionInput, PrismAddendum, PrismAddendumConformeExecution, PrismEventFreezeException, RequestFreezeExceptionInput } from "@prism/types";
import { changeRegisterRepository } from "../data/change-register-repository";
import { unusedApprovedExceptions } from "../model/change-register-rules";
import { countersignAddendumConformeUseCase, decideFreezeExceptionUseCase, freezeScopeUseCase, issueAddendumConformeUseCase, recordEventDecisionUseCase, requestFreezeExceptionUseCase } from "../use-cases/change-register-use-cases";

export function useChangeRegisterViewModel(eventId: string, options: { frozen: boolean }) {
  const [addenda, setAddenda] = useState<PrismAddendum[]>([]);
  const [exceptions, setExceptions] = useState<PrismEventFreezeException[]>([]);
  const [conformes, setConformes] = useState<PrismAddendumConformeExecution[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestVersion = useRef(0);

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    setStatus("loading");
    setError(null);
    try {
      const next = await changeRegisterRepository.load(eventId);
      if (requestVersion.current !== version) return;
      setAddenda(next.addenda);
      setExceptions(next.exceptions);
      setConformes(next.conformes ?? []);
      setStatus("ready");
    } catch (cause) {
      if (requestVersion.current !== version) return;
      setError(cause instanceof Error ? cause.message : "Unable to load the risk and change register.");
      setStatus("error");
    }
  }, [eventId]);

  useEffect(() => {
    void reload();
    return () => { requestVersion.current += 1; };
  }, [reload]);

  // Mutations surface their own validation or API error and then refresh the register so the view matches the server.
  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The change could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [reload]);

  return {
    status,
    error,
    busy,
    addenda,
    exceptions,
    reload,
    freezeScope: (reason: string, deadline?: string) => run(() => freezeScopeUseCase(eventId, { reason, deadline })),
    requestException: (draft: RequestFreezeExceptionInput) => run(() => requestFreezeExceptionUseCase(eventId, draft)),
    approveException: (exceptionId: string) => run(() => decideFreezeExceptionUseCase(eventId, exceptionId, { decision: "approve" })),
    rejectException: (exceptionId: string, decisionNote: string) => run(() => decideFreezeExceptionUseCase(eventId, exceptionId, { decision: "reject", decisionNote })),
    approvedExceptions: unusedApprovedExceptions(exceptions),
    recordDecision: (draft: RecordEventDecisionInput) => run(() => recordEventDecisionUseCase(eventId, draft, { frozen: options.frozen })),
    conformes,
    issueAddendumConforme: (addendumId: string, draft: { documentVersion: number; documentContent: string }) => run(() => issueAddendumConformeUseCase(eventId, addendumId, draft)),
    countersignAddendumConforme: (conforme: PrismAddendumConformeExecution) => run(() => countersignAddendumConformeUseCase(eventId, conforme)),
  };
}
