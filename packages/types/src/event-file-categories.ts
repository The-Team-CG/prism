/**
 * FR-03 / FR-04: what a PMCM event file is. The category travels in the stored object's logical target
 * (event-deliverable:<eventId>:<category>:<attemptId>) so storage needs no extra column.
 */
export const EVENT_FILE_CATEGORIES = {
  floor_plan: "Floor plan",
  moodboard: "Moodboard",
  key_visual: "Key visual",
  work_permit: "Work permit",
  ingress_egress_form: "Ingress and egress form",
  registration_data: "Registration data",
  crew_meal_allocation: "Crew meal allocation",
  manpower_list: "Manpower list",
  supplier_contract: "Supplier contract",
  client_asset: "Client-submitted asset",
  moa: "Memorandum of agreement (MOA)",
  nda: "Non-disclosure agreement (NDA)",
  /** FR-43: the client's terms of reference and PMCM's submitted bid. */
  bid_tor: "Terms of reference (TOR)",
  bid_proposal: "Bid proposal",
  pre_conforme: "Pre-conforme document",
  other: "Other",
} as const;
export type EventFileCategory = keyof typeof EVENT_FILE_CATEGORIES;

export function eventFileLogicalTarget(eventId: string, category: EventFileCategory, attemptId: string): string {
  return `event-deliverable:${eventId}:${category}:${attemptId}`;
}

/** Older uploads carry no category segment and read as "other". */
export function eventFileCategoryOf(logicalTarget: string): EventFileCategory {
  const segment = logicalTarget.split(":")[2];
  return segment && segment in EVENT_FILE_CATEGORIES ? (segment as EventFileCategory) : "other";
}
