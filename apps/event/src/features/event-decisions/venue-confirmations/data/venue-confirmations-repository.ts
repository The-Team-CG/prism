import type { PrismVenueConfirmationTask, ResolveVenueConfirmationInput } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const venueConfirmationsRepository = {
  list: (eventId: string) => eventApiRequest<PrismVenueConfirmationTask[]>(`/api/events/${eventId}/decisions/venue-confirmations`),
  resolve: (eventId: string, taskId: string, input: ResolveVenueConfirmationInput) =>
    eventApiRequest<PrismVenueConfirmationTask>(`/api/events/${eventId}/decisions/venue-confirmations/${taskId}/resolve`, { method: "POST", body: input }),
};
