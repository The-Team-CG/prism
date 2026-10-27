import type { PrismSupplierReadinessItem } from "@prism/types";
import { supplierReadinessSection } from "./supplier-workspace-rules";
import { supplierSectionHref } from "./supplier-workspace-types";

export function supplierWorkHref(item: Pick<PrismSupplierReadinessItem, "quoteStatus" | "requestId">) {
  return `${supplierSectionHref(supplierReadinessSection(item))}#supplier-work-${encodeURIComponent(item.requestId)}`;
}

export function supplierNextStep(item: PrismSupplierReadinessItem, hasQuote: boolean) {
  if (item.quoteStatus !== "selected") {
    if (["closed", "cancelled"].includes(item.quoteStatus)) return { title: "Request closed", detail: "Review the request and any quote you submitted.", action: "View request", owner: "For reference" };
    return hasQuote
      ? { title: "Quote submitted", detail: "PMCM will review your offer. Submitting a quote does not confirm a booking.", action: "Review your quote", owner: "Waiting for PMCM" }
      : { title: "Prepare your quote", detail: "Review the requested scope, price your services and send your offer to PMCM.", action: "Review request", owner: "Your next step" };
  }
  if (item.ingressLate) return { title: "Arrival update needed", detail: "Your scheduled arrival time has passed without an arrival report.", action: "Update arrival status", owner: "Your next step" };
  if (item.assignmentStatus !== "confirmed") return { title: "Confirm your booking", detail: "PMCM selected your quote. Confirm that you can take on the assignment.", action: "Review booking", owner: "Your next step" };
  if (item.contractStatus === "changes_requested") return { title: "Correct your contract", detail: "PMCM requested changes. Review the feedback before uploading a new version.", action: "Review contract feedback", owner: "Your next step" };
  if (item.contractStatus === "missing") return { title: "Upload your signed contract", detail: "PMCM needs your signed contract for review.", action: "Open booking documents", owner: "Your next step" };
  if (item.schedule && !item.schedule.acknowledged) return { title: "Acknowledge your schedule", detail: "Review the latest arrival, departure and location details.", action: "Review schedule", owner: "Your next step" };
  if (item.readinessStatus !== "confirmed") return { title: "Confirm your readiness", detail: "Check the booking requirements and tell PMCM when your preparation is complete.", action: "Review preparation", owner: "Your next step" };
  if (item.contractStatus === "submitted") return { title: "Contract awaiting review", detail: "PMCM is reviewing your contract. Your schedule and event-day controls remain in the booking.", action: "View booking", owner: "Waiting for PMCM" };
  return { title: "Keep PMCM updated", detail: "Review the schedule and report arrival, setup or departure as it happens.", action: "Open booking", owner: "Event-day updates" };
}
