import type { ChooseVenueScoutingPreferenceInput, PrismVenueScouting } from "@prism/types";
import { clientApiRequest } from "@/lib/prism-api";

export const venueScoutingRepository = {
  get: (eventId: string) => clientApiRequest<PrismVenueScouting>(`/events/${eventId}/venue-scouting`),
  choose: (eventId: string, input: ChooseVenueScoutingPreferenceInput) =>
    clientApiRequest<PrismVenueScouting>(`/events/${eventId}/venue-scouting/preference`, { method: "POST", body: input }),
};
