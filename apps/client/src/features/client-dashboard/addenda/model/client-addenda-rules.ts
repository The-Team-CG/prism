import type { PrismAddendum, PrismAddendumConformeExecution } from "@prism/types";

/** Addenda whose conforme is waiting for this client's acknowledgment. */
export function addendaAwaitingClientAcknowledgment(addenda: readonly PrismAddendum[]) {
  return addenda.filter((addendum) => addendum.conforme?.status === "awaiting_client");
}

/** Pending until PMCM countersigns; effective once the billing and quote changes are applied; withdrawn with the PMCM reason. */
export function addendumStatusLabel(addendum: Pick<PrismAddendum, "status" | "withdrawalReason">) {
  if (addendum.status === "effective") return "Effective. The billing reflects this change.";
  if (addendum.status === "withdrawn") return addendum.withdrawalReason ? `Withdrawn by PMCM: ${addendum.withdrawalReason}` : "Withdrawn by PMCM";
  return "Pending. Takes effect when PMCM countersigns.";
}

export function addendumConformeStatusLabel(execution: PrismAddendumConformeExecution | null) {
  if (!execution) return "Conforme not requested yet";
  if (execution.status === "awaiting_client") return "Awaiting your acknowledgment";
  if (execution.status === "awaiting_pmcm") return "You acknowledged this version. Awaiting PMCM countersignature";
  if (execution.status === "withdrawn") return "Withdrawn. No acknowledgment is needed.";
  return "Executed by you and PMCM";
}
