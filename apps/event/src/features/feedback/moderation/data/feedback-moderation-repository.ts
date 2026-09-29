import type { ModerateGuestFeedbackInput, PrismGuestFeedback } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const feedbackModerationRepository = {
  listPending(eventId: string): Promise<PrismGuestFeedback[]> {
    return eventApi.guest.pendingFeedback(eventId);
  },
  moderate(eventId: string, feedbackId: string, input: ModerateGuestFeedbackInput): Promise<PrismGuestFeedback> {
    return eventApi.guest.moderateFeedback(eventId, feedbackId, input);
  },
};
