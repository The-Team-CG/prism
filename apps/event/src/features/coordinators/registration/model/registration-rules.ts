import type { PrismCoordinatorRegistrationEntry } from "@prism/types";

export function canCheckInRegistrationEntry(entry: PrismCoordinatorRegistrationEntry): boolean {
  return entry.eligibility === "eligible"
    && entry.verificationStatus !== "rejected"
    && !entry.checkedInAt
    && (!entry.walkIn || entry.verificationStatus === "verified");
}
