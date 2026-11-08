"use client";

import { useCallback, useEffect, useState } from "react";
import { decideCoordinatorReplacementSchema, parseContract, type DecideCoordinatorReplacementInput, type PrismCoordinatorReplacementRecommendation } from "@prism/types";
import { coordinatorReplacementRepository } from "../data/coordinator-replacement-repository";

export function useCoordinatorReplacements(eventId: string) {
  const [items, setItems] = useState<PrismCoordinatorReplacementRecommendation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems(await coordinatorReplacementRepository.list(eventId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load replacement recommendations."); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, input: DecideCoordinatorReplacementInput) {
    setBusyId(id);
    setError(null);
    try {
      await coordinatorReplacementRepository.decide(eventId, id, parseContract(decideCoordinatorReplacementSchema, input, "Replacement decision"));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the decision.");
    } finally {
      setBusyId(null);
    }
  }

  return { items, busyId, error, decide };
}
