import type { PrismCoordinatorRegistrationEntry } from "@prism/types";

export function canVerifyRegistrationEntry(entry: PrismCoordinatorRegistrationEntry): boolean {
  return !entry.checkedInAt && entry.verificationStatus !== "verified";
}

export function canRejectRegistrationEntry(entry: PrismCoordinatorRegistrationEntry): boolean {
  return !entry.checkedInAt && entry.verificationStatus !== "rejected";
}

/** Only an unchecked, not-yet-flagged walk-in can be flagged for verification. */
export function canFlagRegistrationEntry(entry: PrismCoordinatorRegistrationEntry): boolean {
  return Boolean(entry.walkIn && !entry.checkedInAt && !entry.verificationFlaggedAt);
}

export function canCheckInRegistrationEntry(entry: PrismCoordinatorRegistrationEntry): boolean {
  return entry.eligibility === "eligible"
    && entry.verificationStatus !== "rejected"
    && !entry.checkedInAt
    && (!entry.walkIn || (entry.verificationStatus === "verified" && !entry.verificationFlaggedAt));
}
