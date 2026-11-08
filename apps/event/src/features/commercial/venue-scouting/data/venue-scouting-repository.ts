import type { CreateVenueScoutingOptionInput, PrismVenueScouting, PrismVenueScoutingOption } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

const path = (eventId: string) => `/api/events/${eventId}/venue-scouting`;

export const venueScoutingRepository = {
  get: (eventId: string) => eventApiRequest<PrismVenueScouting>(path(eventId)),
  add: (eventId: string, input: CreateVenueScoutingOptionInput) => eventApiRequest<PrismVenueScoutingOption>(`${path(eventId)}/options`, { method: "POST", body: input }),
  withdraw: (eventId: string, optionId: string) => eventApiRequest<PrismVenueScoutingOption>(`${path(eventId)}/options/${optionId}/withdraw`, { method: "POST" }),
  publish: (eventId: string) => eventApiRequest<PrismVenueScouting>(`${path(eventId)}/publish`, { method: "POST" }),
};
