import type { PrismClientChangeRequest } from "@prism/types";

export function clientChangeRequestStatusLabel(status: PrismClientChangeRequest["status"]): string {
  if (status === "approved") return "Approved";
  if (status === "not_approved") return "Not approved";
  return "Under review";
}
