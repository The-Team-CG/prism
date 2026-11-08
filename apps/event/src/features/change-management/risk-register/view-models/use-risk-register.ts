"use client";

import { useCallback, useEffect, useState } from "react";
import { createEventRiskSchema, parseContract, updateEventRiskSchema, type CreateEventRiskInput, type PrismEventRisk, type UpdateEventRiskInput } from "@prism/types";
import { riskRegisterRepository } from "../data/risk-register-repository";

export function useRiskRegister(eventId: string) {
  const [risks, setRisks] = useState<PrismEventRisk[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRisks(await riskRegisterRepository.list(eventId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load the risk register."); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try { await action(); await load(); return true; }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the risk."); return false; }
    finally { setBusy(false); }
  }

  return {
    risks,
    busy,
    error,
    loadStandard: () => run(() => riskRegisterRepository.loadStandard(eventId)),
    create: (input: CreateEventRiskInput) => run(() => riskRegisterRepository.create(eventId, parseContract(createEventRiskSchema, input, "Risk"))),
    update: (riskId: string, input: UpdateEventRiskInput) => run(() => riskRegisterRepository.update(eventId, riskId, parseContract(updateEventRiskSchema, input, "Risk update"))),
  };
}
