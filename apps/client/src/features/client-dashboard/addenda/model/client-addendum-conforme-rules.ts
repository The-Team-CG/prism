import type { PrismClientAddendumConforme } from "@prism/types";

export function addendumConformeNeedsAcknowledgement(conforme: Pick<PrismClientAddendumConforme, "status">): boolean {
  return conforme.status === "awaiting_client";
}

export function clientAddendumConformeStatusLabel(status: PrismClientAddendumConforme["status"]): string {
  if (status === "awaiting_client") return "Awaiting your acknowledgement";
  if (status === "awaiting_pmcm") return "Acknowledged, awaiting PMCM countersignature";
  return "Executed";
}
