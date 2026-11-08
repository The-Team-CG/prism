import type { DecideCoordinatorReplacementInput, PrismCoordinatorReplacementRecommendation } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

const path = (eventId: string) => `/api/events/${eventId}/coordinator-replacements`;

export const coordinatorReplacementRepository = {
  list: (eventId: string) => eventApiRequest<PrismCoordinatorReplacementRecommendation[]>(path(eventId)),
  decide: (eventId: string, id: string, input: DecideCoordinatorReplacementInput) =>
    eventApiRequest<PrismCoordinatorReplacementRecommendation>(`${path(eventId)}/${id}/decision`, { method: "POST", body: input }),
};
