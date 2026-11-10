import type { ResolveVenueConfirmationInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const venueConfirmationsRepository = {
  list: (eventId: string) => eventApi.lifecycle.venueConfirmations(eventId),
  resolve: (eventId: string, taskId: string, input: ResolveVenueConfirmationInput) =>
    eventApi.lifecycle.resolveVenueConfirmation(eventId, taskId, input),
};
