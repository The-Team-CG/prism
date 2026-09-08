import { moderateGuestFeedbackSchema, parseContract, type ModerateGuestFeedbackInput, type PrismGuestFeedback } from "@prism/types";
import { feedbackModerationRepository } from "../data/feedback-moderation-repository";

export function moderateFeedback(eventId: string, feedbackId: string, input: ModerateGuestFeedbackInput): Promise<PrismGuestFeedback> {
  return feedbackModerationRepository.moderate(eventId, feedbackId, parseContract(moderateGuestFeedbackSchema, input, "Feedback moderation"));
}
