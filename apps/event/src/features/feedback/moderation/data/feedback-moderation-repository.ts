import type { ModerateGuestFeedbackInput, PrismGuestFeedback } from "@prism/types";
import { prismApi } from "@/lib/prism-api";

export const feedbackModerationRepository = {
  listPending(eventId: string): Promise<PrismGuestFeedback[]> {
    return prismApi.pendingGuestFeedback(eventId);
  },
  moderate(eventId: string, feedbackId: string, input: ModerateGuestFeedbackInput): Promise<PrismGuestFeedback> {
    return prismApi.moderateGuestFeedback(eventId, feedbackId, input);
  },
};
