import { parseContract, reviewScopeChangeRequestSchema, type ReviewScopeChangeRequestInput } from "@prism/types";
import { scopeReviewRepository } from "../data/scope-review-repository";

/**
 * Approval needs the impact review and, on a frozen event, an approved freeze exception. The server enforces both;
 * the frozen check here only avoids a round trip with a clear message.
 */
export function reviewScopeChangeUseCase(eventId: string, requestId: string, draft: ReviewScopeChangeRequestInput, options: { frozen: boolean }) {
  const input = parseContract(reviewScopeChangeRequestSchema, draft, "Scope change decision");
  if (input.decision === "approve" && options.frozen && !input.freezeExceptionId) {
    throw new Error("Choose an approved freeze exception before approving this scope change on a frozen event.");
  }
  return scopeReviewRepository.review(eventId, requestId, input);
}
