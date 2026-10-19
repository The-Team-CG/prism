import type { PrismAddendum, PrismAddendumConformeExecution } from "@prism/types";

/** Addenda whose conforme is waiting for this client's acknowledgment. */
export function addendaAwaitingClientAcknowledgment(addenda: readonly PrismAddendum[]) {
  return addenda.filter((addendum) => addendum.conforme?.status === "awaiting_client");
}

export function addendumConformeStatusLabel(execution: PrismAddendumConformeExecution | null) {
  if (!execution) return "Conforme not requested yet";
  if (execution.status === "awaiting_client") return "Awaiting your acknowledgment";
  if (execution.status === "awaiting_pmcm") return "You acknowledged this version. Awaiting PMCM countersignature";
  return "Executed by you and PMCM";
}
