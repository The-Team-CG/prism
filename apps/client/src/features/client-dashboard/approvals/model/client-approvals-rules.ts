import type { PrismBillingStatement, PrismDocument, PrismEvent, PrismFloorPlanDraft } from "@prism/types";
import type { ClientDashboardRoute, ClientPortalView } from "../../workspace/model/client-dashboard-types";
import { formatStatusLabel } from "../../workspace/model/client-dashboard-view-rules";
import { canApproveProposal, latestIssuedProposal } from "../../proposal/model/proposal-review-rules";

export type ApprovalItem = {
  title: string;
  detail: string;
  status: string;
  actionable: boolean;
  /** Where in the event workspace this approval is reviewed. */
  route: ClientDashboardRoute;
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
      title: "Proposal",
      detail:
        selectedEvent.proposalClientStatus === "approved"
          ? "The primary client contact approved this proposal."
          : selectedEvent.proposalClientStatus === "revision_requested"
            ? "A revision was requested. PMCM will update the package."
            : "Review the proposal once PMCM has issued it. Billing is handled separately.",
      status: selectedEvent.proposalClientStatus ?? "pending",
      route: "proposal",
      actionable: canApproveProposal(selectedEvent, Boolean(latestIssuedProposal(documents))),
    },
    {
      title: "Contracts",
      detail: contracts.length
        ? "Contract files are available for this event."
        : "Contracts will appear after PMCM uploads them.",
      status: contracts.length ? "approved" : "pending",
      route: "documents",
      actionable: false,
    },
    {
      title: "Quotations",
      detail: billing ? `${billing.number} is linked to the approved proposal package.` : "Quotation and billing details are being prepared.",
      status: billing?.status ?? "pending",
      route: "billing",
      actionable: false,
    },
    {
      title: "Layouts / Designs",
      detail: officialDraft ? `Official layout is ${formatStatusLabel(officialDraft.status)}.` : "PMCM has not published an official layout yet.",
      status: officialDraft?.status ?? "pending",
      route: "floorplan",
      actionable: false,
    },
    {
      title: "Final Confirmation",
      detail: selectedEvent.readiness ? `Readiness is ${formatStatusLabel(selectedEvent.readiness)}.` : "Final confirmation is pending.",
      status: selectedEvent.readiness ?? selectedEvent.status,
      route: "overview",
      actionable: false,
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

export function filterApprovalItems<T extends ApprovalItem>(items: T[], portalView?: ClientPortalView): T[] {
  const filter = portalView ? APPROVAL_VIEW_FILTERS[portalView] : undefined;
  return (filter ? items.filter(filter) : [...items]).sort((left, right) =>
    Number(right.actionable) - Number(left.actionable) ||
    Number(approvalStatusKind(left.status) === "success") - Number(approvalStatusKind(right.status) === "success"),
  );
}

export function approvalStatusKind(status: string): "success" | "pending" | "neutral" {
  if (/approved|done|confirmed/i.test(status)) return "success";
  if (/pending|waiting|preparation/i.test(status)) return "pending";
  return "neutral";
}
