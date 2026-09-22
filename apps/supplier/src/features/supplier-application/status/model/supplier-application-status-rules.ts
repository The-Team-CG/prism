import { PrismApiError } from "@prism/api-client";
import { PrismContractError, type PrismSupplierApplicationStatusResult } from "@prism/types";

export type SupplierApplicationStatus = PrismSupplierApplicationStatusResult["status"];
export type SupplierApplicationStatusFailure = "invalid_input" | "not_found" | "unavailable";

export const SUPPLIER_APPLICATION_STATUS_LABELS: Record<SupplierApplicationStatus, string> = {
  pending: "Under Review",
  under_review: "Under Review",
  proposal_requested: "Proposal Requested",
  meeting_scheduled: "Meeting Scheduled",
  approved: "Approved",
  declined: "Declined",
};

const TERMINAL_STATUSES = new Set<SupplierApplicationStatus>(["approved", "declined"]);

export function supplierApplicationStatusLabel(status: SupplierApplicationStatus): string {
  return SUPPLIER_APPLICATION_STATUS_LABELS[status];
}

export function isTerminalSupplierApplicationStatus(status: SupplierApplicationStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function supplierApplicationStatusDescription(status: SupplierApplicationStatus): string {
  if (status === "approved") return "PMCM approved your application and will contact you with next steps.";
  if (status === "declined") return "PMCM has completed its review. Please contact PMCM if you need clarification.";
  if (status === "proposal_requested") return "PMCM requested a proposal. Watch your email for the next request.";
  if (status === "meeting_scheduled") return "PMCM scheduled a meeting. Check your email for the meeting details.";
  return "PMCM is reviewing your application. We will show the latest status here.";
}

export function mapSupplierApplicationStatusFailure(error: unknown): SupplierApplicationStatusFailure {
  if (error instanceof PrismContractError) return "invalid_input";
  if (error instanceof PrismApiError && error.status === 404) return "not_found";
  return "unavailable";
}

export function supplierApplicationStatusFailureMessage(failure: SupplierApplicationStatusFailure): string {
  if (failure === "invalid_input") {
    return "Enter the application reference and submitting email used on your application.";
  }
  if (failure === "not_found") {
    return "We could not find an application matching those details. Check the reference and email and try again.";
  }
  return "Status is temporarily unavailable. Check your connection and try again.";
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
