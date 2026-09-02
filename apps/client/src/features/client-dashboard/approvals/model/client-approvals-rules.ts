import type { PrismBillingStatement, PrismDocument, PrismEvent, PrismFloorPlanDraft } from "@prism/types";
import type { ClientPortalView } from "../../workspace/model/client-dashboard-types";
import { formatStatusLabel } from "../../workspace/model/client-dashboard-view-rules";

export type ApprovalItem = {
  title: string;
  detail: string;
  status: string;
};

function contractDocuments(documents: PrismDocument[]) {
  return documents.filter((document) => /contract|conforme|moa|nda/i.test(document.type));
}

export function buildApprovalItems(
  selectedEvent: PrismEvent | undefined,
  documents: PrismDocument[],
  billing?: PrismBillingStatement,
  officialDraft?: PrismFloorPlanDraft,
): ApprovalItem[] {
  if (!selectedEvent) return [];
  const contracts = contractDocuments(documents);
  return [
    {
      title: "Contracts",
      detail: contracts.length
        ? "Contract files are available for this event."
        : "Contracts will appear after PMCM uploads them.",
      status: contracts.length ? "approved" : "pending",
    },
    {
      title: "Quotations",
      detail: billing ? `${billing.number} is linked to the approved proposal package.` : "Quotation and billing details are being prepared.",
      status: billing?.status ?? "pending",
    },
    {
      title: "Layouts / Designs",
      detail: officialDraft ? `Official layout is ${formatStatusLabel(officialDraft.status)}.` : "PMCM has not published an official layout yet.",
      status: officialDraft?.status ?? "pending",
    },
    {
      title: "Final Confirmation",
      detail: selectedEvent.readiness ? `Readiness is ${formatStatusLabel(selectedEvent.readiness)}.` : "Final confirmation is pending.",
      status: selectedEvent.readiness ?? selectedEvent.status,
    },
  ];
}

const APPROVAL_VIEW_FILTERS: Partial<Record<ClientPortalView, (item: ApprovalItem) => boolean>> = {
  "approvals-pending": (item) => item.status !== "approved",
  "dashboard-pending-approvals": (item) => item.status !== "approved",
  "approvals-approved": (item) => item.status === "approved",
  "approvals-needs-revision": (item) => /revision|changes/i.test(item.status),
  "approvals-contracts": (item) => item.title === "Contracts",
  "approvals-quotations": (item) => item.title === "Quotations",
  "approvals-final-confirmation": (item) => item.title === "Final Confirmation",
};

export function filterApprovalItems(items: ApprovalItem[], portalView?: ClientPortalView) {
  const filter = portalView ? APPROVAL_VIEW_FILTERS[portalView] : undefined;
  if (!filter) return items;
  return items.filter(filter);
}

export function approvalStatusKind(status: string): "success" | "pending" | "neutral" {
  if (/approved|done|confirmed/i.test(status)) return "success";
  if (/pending|waiting|preparation/i.test(status)) return "pending";
  return "neutral";
}
