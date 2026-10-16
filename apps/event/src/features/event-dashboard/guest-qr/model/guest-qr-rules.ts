import type {
  PrismGuestQrPassDeliveryStatus,
  PrismGuestQrPassStatus,
  PrismGuestRosterEntry,
} from "@prism/types";

const QR_EXCLUDED_ROSTER_SOURCES = new Set([
  "guest-review",
  "guest-review-headcount",
  "coordinator-walk-in",
]);

const DELIVERY_LABELS: Record<PrismGuestQrPassDeliveryStatus, string> = {
  queued: "Queued",
  captured: "Captured for demo; not sent.",
  failed: "Failed",
  revoked: "Revoked",
};

export function guestQrPassDeliveryLabel(status: PrismGuestQrPassDeliveryStatus): string {
  return DELIVERY_LABELS[status];
}

export function canIssueGuestQrPass(entry: PrismGuestRosterEntry): boolean {
  const source = entry.source.trim().toLowerCase();
  return Boolean(entry.importBatchId?.trim())
    && Boolean(source)
    && !QR_EXCLUDED_ROSTER_SOURCES.has(source)
    && !entry.withdrawnAt
    && entry.eligibility === "eligible"
    && entry.verificationStatus !== "rejected"
    && Boolean(entry.email?.trim());
}

export function latestGuestQrPassForRosterEntry(
  passes: PrismGuestQrPassStatus[],
  rosterEntryId: string,
): PrismGuestQrPassStatus | null {
  const matching = passes.filter((pass) => pass.rosterEntryId === rosterEntryId);
  return matching.find((pass) => pass.status === "active")
    ?? [...matching].sort((left, right) => right.issuedAt.localeCompare(left.issuedAt))[0]
    ?? null;
}
