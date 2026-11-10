import type { ChooseVenueScoutingPreferenceInput } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export const venueScoutingRepository = {
  get: (eventId: string) => clientApi.commercial.venueScouting(eventId),
  choose: (eventId: string, input: ChooseVenueScoutingPreferenceInput) => clientApi.commercial.chooseVenueScoutingPreference(eventId, input),
};
