import type { PrismCommandInboxItem } from "@prism/types";

type Kind = PrismCommandInboxItem["kind"];

/** Owning work area for each inbox row, shown in the "Area" column. */
export const COMMAND_INBOX_AREA_LABEL: Record<Kind, string> = {
  inquiry: "Inquiries", conforme: "Conforme", briefing: "Briefing",
  billing: "Billing", document: "Files", floorplan: "Floorplan",
  approval: "Approvals", supplier: "Suppliers", coordinator: "Staffing",
  closure: "Closure", live_ops: "Live operations", change_request: "Change requests", addendum: "Addenda", feedback: "Feedback",
};

/** The single action each row offers. */
export const COMMAND_INBOX_ACTION_LABEL: Record<Kind, string> = {
  inquiry: "Review inquiry", conforme: "Review conforme", briefing: "Review briefing",
  billing: "Review billing", document: "Review document", floorplan: "Review layout",
  approval: "Open proposal", supplier: "Review supplier work", coordinator: "Review assignment",
  closure: "Review closeout", live_ops: "Open live operations", change_request: "Review change request", addendum: "Review addendum", feedback: "Review feedback",
};

/** A client decision left waiting is PMCM's to chase, so it offers the follow-up rather than the item itself. */
export function commandInboxActionLabel(item: Pick<PrismCommandInboxItem, "kind" | "status">): string {
  return item.status === "awaiting_client" ? "Send a follow-up" : COMMAND_INBOX_ACTION_LABEL[item.kind];
}
