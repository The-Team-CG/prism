"use client";

import { useCallback, useEffect, useState } from "react";
import { createVenueScoutingOptionSchema, parseContract, VENUE_SCOUTING_MIN_OPTIONS, type CreateVenueScoutingOptionInput, type PrismVenueScouting } from "@prism/types";
import { venueScoutingRepository } from "../data/venue-scouting-repository";

export function useVenueScoutingPanel(eventId: string) {
  const [scouting, setScouting] = useState<PrismVenueScouting | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setScouting(await venueScoutingRepository.get(eventId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load venue scouting."); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try { await action(); await load(); return true; }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save venue scouting."); return false; }
    finally { setBusy(false); }
  }

  const options = scouting?.options ?? [];
  const drafts = options.filter((option) => option.status === "draft").length;
  return {
    options,
    busy,
    error,
    canPublish: drafts > 0 && options.length >= VENUE_SCOUTING_MIN_OPTIONS,
    add: (input: CreateVenueScoutingOptionInput) => run(() => venueScoutingRepository.add(eventId, parseContract(createVenueScoutingOptionSchema, input, "Venue option"))),
    withdraw: (optionId: string) => run(() => venueScoutingRepository.withdraw(eventId, optionId)),
    publish: () => run(() => venueScoutingRepository.publish(eventId)),
  };
}
