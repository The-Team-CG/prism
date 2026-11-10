import type { CreateVenueScoutingOptionInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const venueScoutingRepository = {
  get: (eventId: string) => eventApi.commercial.venueScouting(eventId),
  add: (eventId: string, input: CreateVenueScoutingOptionInput) => eventApi.commercial.addVenueScoutingOption(eventId, input),
  withdraw: (eventId: string, optionId: string) => eventApi.commercial.withdrawVenueScoutingOption(eventId, optionId),
  publish: (eventId: string) => eventApi.commercial.publishVenueScouting(eventId),
};
