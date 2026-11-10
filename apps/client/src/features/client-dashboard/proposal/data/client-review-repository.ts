import type { DecideClientReviewItemInput } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export const clientReviewRepository = {
  list(eventId: string) {
    return clientApi.commercial.clientReviewItems(eventId);
  },

  decide(eventId: string, itemId: string, input: DecideClientReviewItemInput) {
    return clientApi.commercial.decideClientReviewItem(eventId, itemId, input);
  },
};
