import type { DecideClientReviewItemInput, PrismClientReviewItem } from "@prism/types";
import { clientApiRequest } from "@/lib/prism-api";

export const clientReviewRepository = {
  list(eventId: string) {
    return clientApiRequest<PrismClientReviewItem[]>(`/events/${eventId}/client-review-items`);
  },

  decide(eventId: string, itemId: string, input: DecideClientReviewItemInput) {
    return clientApiRequest(`/events/${eventId}/client-review-items/${itemId}/decisions`, {
      method: "POST",
      body: input,
    });
  },
};
