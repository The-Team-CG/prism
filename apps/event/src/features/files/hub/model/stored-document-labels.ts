import type { PrismStoredObject, StorageUsage } from "@prism/types";

const USAGE_LABELS: Record<StorageUsage, string> = {
  signed_conforme: "Signed conforme",
  client_document: "Client document",
  supplier_document: "Supplier document",
  guest_feedback_media: "Guest feedback media",
  event_deliverable: "Event deliverable",
  event_game_media: "Event game media",
  event_game_branding: "Event game branding",
};

const LIFECYCLE_LABELS: Record<PrismStoredObject["lifecycleState"], string> = {
  requested: "Upload not finished",
  stored: "Stored",
  failed: "Upload failed",
  deleted: "Deleted",
};

/** Readable "what it is · where it stands" line for a stored file. */
export function storedDocumentMetadataLine(document: Pick<PrismStoredObject, "usage" | "lifecycleState" | "failureReason">): string {
  const usage = USAGE_LABELS[document.usage] ?? document.usage;
  const state = LIFECYCLE_LABELS[document.lifecycleState] ?? document.lifecycleState;
  return [usage, state, document.failureReason].filter(Boolean).join(" · ");
}
