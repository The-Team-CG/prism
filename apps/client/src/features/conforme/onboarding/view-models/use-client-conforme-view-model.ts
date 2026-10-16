"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrismConformeExecution } from "@prism/types";
import { storedClientAccessToken } from "@/lib/prism-api";
import { clientConformeRepository } from "../data/client-conforme-repository";
import { initialClientConformeReviewState, reduceClientConformeReviewState } from "../model/client-conforme-review-state";

export function useClientConformeViewModel() {
  const router = useRouter();
  const [executions, setExecutions] = useState<PrismConformeExecution[]>([]);
  const [reviewState, dispatchReviewState] = useReducer(reduceClientConformeReviewState, initialClientConformeReviewState);
  const [busy, setBusy] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storedClientAccessToken()) {
      router.replace("/sign-in?next=/conforme");
      return;
    }
    let active = true;
    clientConformeRepository.load()
      .then((snapshot) => { if (active) { setExecutions(snapshot.executions); dispatchReviewState({ type: "select-execution", executionId: snapshot.executions[0]?.id ?? null }); setError(null); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load this conforme."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [router]);

  const execution = executions.find((candidate) => candidate.id === reviewState.selectedExecutionId) ?? null;

  async function sign() {
    if (!execution || !reviewState.consentAccepted || signing) return;
    setSigning(true);
    setError(null);
    try {
      const updated = await clientConformeRepository.sign(execution);
      setExecutions((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      dispatchReviewState({ type: "set-consent", accepted: false });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to record your acknowledgment.");
    } finally {
      setSigning(false);
    }
  }

  return {
    executions,
    execution,
    selectedExecutionId: reviewState.selectedExecutionId,
    setSelectedExecutionId: (executionId: string) => dispatchReviewState({ type: "select-execution", executionId }),
    busy,
    signing,
    consentAccepted: reviewState.consentAccepted,
    error,
    setConsentAccepted: (accepted: boolean) => dispatchReviewState({ type: "set-consent", accepted }),
    sign,
  };
}
