"use client";

import {
  MessageSquareText,
  Presentation,
  ThumbsUp,
} from "lucide-react";
import type { PrismBillingStatement, PrismBriefing, PrismEvent, PrismFloorPlanDraft, PrismIssuedProposalSummary, PrismPaymentMilestone } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  Card,
  CardBody,
  CardHeader,
  DataRow,
  SectionLabel,
  formatLabel,
  money,
} from "../../shared/tab-ui";
import type { DetailTab } from "../../workspace/shared";
import { proposalClientStatus } from "../model/proposal-review-rules";
import { useClientProposalTabViewModel } from "../view-models/use-client-proposal-tab-view-model";
import { ClientVenueStylingReview } from "./client-venue-styling-review";

function proposalBadge(status: string, packageReady: boolean) {
  if (!packageReady) return { status: "pending", label: "In preparation" };
  if (status === "approved") return { status: "approved", label: "Approved" };
  if (status === "revision_requested") return { status: "attention", label: "Revision requested" };
  return { status: "ready", label: "Ready for review" };
}

function ProposalStatusHero({
  headline,
  packageReady,
  clientStatus,
  remainingRevisions,
  revisionNote,
  setRevisionNote,
  reviewing,
  canApprove,
  canRequestRevision,
  onApprove,
  onRequestRevision,
}: {
  headline: string;
  packageReady: boolean;
  clientStatus: string;
  remainingRevisions: number;
  revisionNote: string;
  setRevisionNote: (value: string) => void;
  reviewing: boolean;
  canApprove: boolean;
  canRequestRevision: boolean;
  onApprove: () => void;
  onRequestRevision: () => void;
}) {
  const badge = proposalBadge(clientStatus, packageReady);
  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <SectionLabel>Proposal status</SectionLabel>
            <h2 className="mt-1 text-xl font-black text-foreground">{headline}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Only the primary client contact on the inquiry can approve or request a revision. Internal cost estimation stays with PMCM. Up to three revisions.
            </p>
            {canApprove ? (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button className="rounded-lg font-bold" disabled={reviewing} onClick={onApprove}>
                    <ThumbsUp className="size-4" /> Approve proposal
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-lg font-semibold"
                    disabled={reviewing || !canRequestRevision}
                    onClick={onRequestRevision}
                  >
                    Request revision
                  </Button>
                </div>
                {canRequestRevision ? (
                  <label className="block max-w-xl text-sm">
                    <span className="mb-1 block font-semibold text-foreground">
                      Revision note ({remainingRevisions} remaining)
                    </span>
                    <textarea
                      className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      value={revisionNote}
                      onChange={(event) => setRevisionNote(event.target.value)}
                      placeholder="Describe the change you need."
                    />
                  </label>
                ) : (
                  <p className="text-xs text-muted-foreground">Revision cap reached. Approve the current package or wait for PMCM.</p>
                )}
              </div>
            ) : null}
          </div>
          <StatusBadge status={badge.status} label={badge.label} />
        </div>
      </CardBody>
    </Card>
  );
}

function ProposalPackageCard({
  selectedEvent,
  briefing,
  billing,
  officialDraft,
  nextPayment,
  proposalReady,
  proposal,
}: {
  proposal: PrismIssuedProposalSummary | null;
  selectedEvent: PrismEvent;
  briefing?: PrismBriefing;
  billing?: PrismBillingStatement;
  officialDraft?: PrismFloorPlanDraft;
  nextPayment?: PrismPaymentMilestone;
  proposalReady: boolean;
}) {
  const clientStatus = proposalClientStatus(selectedEvent);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Presentation className="size-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Proposal package</h3>
          </div>
          <StatusBadge
            status={proposalReady ? "ready" : "pending"}
            label={proposalReady ? "Ready" : "In preparation"}
          />
        </div>
      </CardHeader>
      <CardBody className="py-2">
        <DataRow label="Event" value={selectedEvent.eventName} />
        {proposal ? (
          <>
            <DataRow label="Proposal" value={`${proposal.title} (version ${proposal.versionNumber})`} />
            <DataRow label="Proposal total" value={money.format(proposal.totalAmount)} />
          </>
        ) : null}
        <DataRow label="Client review" value={formatLabel(clientStatus)} />
        <DataRow label="Stage" value={proposalReady ? "Client review" : "PMCM preparation"} />
        <DataRow
          label="Briefing basis"
          value={briefing ? `${briefing.guestCount} guests at ${briefing.venue}` : "Waiting for briefing"}
        />
        <DataRow
          label="Billing statement"
          value={billing ? `${billing.number} — ${formatLabel(billing.status)}` : "Not issued"}
        />
        <DataRow
          label="Official layout"
          value={officialDraft ? formatLabel(officialDraft.status) : "Not published"}
        />
        <DataRow
          label="Next payment"
          value={nextPayment ? `${nextPayment.label} on ${nextPayment.dueDate}` : "No open milestone"}
        />
        {proposal?.summary ? <p className="whitespace-pre-wrap pt-3 text-sm leading-6 text-foreground">{proposal.summary}</p> : null}
        {proposal?.revisionNote ? (
          <p className="pt-2 text-sm leading-6 text-muted-foreground">Changed in version {proposal.versionNumber}: {proposal.revisionNote}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function proposalChecklistItems(input: {
  briefing?: PrismBriefing;
  billing?: PrismBillingStatement;
  officialDraft?: PrismFloorPlanDraft;
  proposalReady: boolean;
  setTab: (tab: DetailTab) => void;
}) {
  return [
    {
      label: "Briefing details",
      value: input.briefing ? "Ready" : "Waiting",
      status: input.briefing ? "approved" : "pending",
      action: () => input.setTab("briefing"),
    },
    {
      label: "Planning package",
      value: input.proposalReady ? "Ready for review" : "In preparation",
      status: input.proposalReady ? "ready" : "pending",
      action: () => input.setTab("proposal"),
    },
    {
      label: "Official layout",
      value: input.officialDraft ? formatLabel(input.officialDraft.status) : "Not published",
      status: input.officialDraft?.status ?? "pending",
      action: () => input.setTab("floorplan"),
    },
    {
      label: "Billing milestones",
      value: input.billing ? formatLabel(input.billing.status) : "Not issued",
      status: input.billing?.status ?? "pending",
      action: () => input.setTab("billing"),
    },
  ];
}

function ProposalReviewChecklist({
  briefing,
  billing,
  officialDraft,
  proposalReady,
  setTab,
}: {
  briefing?: PrismBriefing;
  billing?: PrismBillingStatement;
  officialDraft?: PrismFloorPlanDraft;
  proposalReady: boolean;
  setTab: (tab: DetailTab) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquareText className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Review checklist</h3>
        </div>
      </CardHeader>
      <div className="divide-y divide-border">
        {proposalChecklistItems({ briefing, billing, officialDraft, proposalReady, setTab }).map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-muted/40"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{item.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{item.value}</span>
            </span>
            <StatusBadge status={item.status} />
          </button>
        ))}
      </div>
    </Card>
  );
}

export function ClientProposalTab({ setTab }: { setTab: (tab: DetailTab) => void }) {
  const vm = useClientProposalTabViewModel();
  if (!vm.selectedEvent) return null;
  const nextPayment = vm.payments.find((payment) => payment.status !== "paid");

  return (
    <div className="space-y-5">
      <ProposalStatusHero
        headline={vm.headline}
        packageReady={vm.packageReady}
        clientStatus={proposalClientStatus(vm.selectedEvent)}
        remainingRevisions={vm.remainingRevisions}
        revisionNote={vm.revisionNote}
        setRevisionNote={vm.setRevisionNote}
        reviewing={vm.reviewing}
        canApprove={vm.canApprove}
        canRequestRevision={vm.canRequestRevision}
        onApprove={() => void vm.approve()}
        onRequestRevision={() => void vm.requestRevision()}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <ProposalPackageCard
          selectedEvent={vm.selectedEvent}
          briefing={vm.briefing}
          billing={vm.billing}
          officialDraft={vm.officialDraft}
          nextPayment={nextPayment}
          proposalReady={vm.packageReady}
          proposal={vm.proposal}
        />
        <ProposalReviewChecklist
          briefing={vm.briefing}
          billing={vm.billing}
          officialDraft={vm.officialDraft}
          proposalReady={vm.packageReady}
          setTab={setTab}
        />
      </div>
      <ClientVenueStylingReview eventId={vm.selectedEvent.id} />
    </div>
  );
}
