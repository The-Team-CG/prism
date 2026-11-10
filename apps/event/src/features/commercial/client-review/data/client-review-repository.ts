import type { CreateClientReviewItemInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const clientReviewRepository = {
  list: (eventId: string) => eventApi.commercial.clientReviewItems(eventId),
  issue: (eventId: string, input: CreateClientReviewItemInput) => eventApi.commercial.issueClientReviewItem(eventId, input),
};
