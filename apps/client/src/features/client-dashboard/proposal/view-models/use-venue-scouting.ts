"use client";

import { useCallback, useEffect, useState } from "react";
import { chooseVenueScoutingPreferenceSchema, parseContract, type PrismVenueScouting } from "@prism/types";
import { venueScoutingRepository } from "../data/venue-scouting-repository";

export function useVenueScouting(eventId: string) {
  const [scouting, setScouting] = useState<PrismVenueScouting | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setScouting(await venueScoutingRepository.get(eventId)); setError(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load venue options."); }
  }, [eventId]);
  useEffect(() => { setScouting(null); void load(); }, [load]);

  async function choose(optionId: string, note: string) {
    setBusy(true);
    setError(null);
    try { setScouting(await venueScoutingRepository.choose(eventId, parseContract(chooseVenueScoutingPreferenceSchema, { optionId, note }, "Venue preference"))); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save your venue preference."); }
    finally { setBusy(false); }
  }

  return { options: scouting?.options ?? [], preferredOptionId: scouting?.preferredOptionId ?? null, busy, error, choose };
}
