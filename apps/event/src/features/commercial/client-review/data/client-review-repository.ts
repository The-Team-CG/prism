import type { CreateClientReviewItemInput, PrismClientReviewItem } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const clientReviewRepository = {
  list: (eventId: string) => eventApiRequest<PrismClientReviewItem[]>(`/api/events/${eventId}/client-review-items`),
  issue: (eventId: string, input: CreateClientReviewItemInput) => eventApiRequest<PrismClientReviewItem>(`/api/events/${eventId}/client-review-items`, { method: "POST", body: input }),
};
