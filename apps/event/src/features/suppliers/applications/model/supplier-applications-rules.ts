import type { ReviewSupplierApplicationInput } from "@prism/types";

export function applicationReviewActions(): ReviewSupplierApplicationInput["action"][] {
  return ["request_proposal", "schedule", "decline"];
}

export function applicationActionLabel(action: ReviewSupplierApplicationInput["action"]) {
  if (action === "request_proposal") return "Request proposal";
  if (action === "schedule") return "Schedule";
  return "Decline";
}
