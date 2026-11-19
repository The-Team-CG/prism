"use client";

import { formatPortalDate } from "@prism/ui/format-date";
import { ThumbsUp } from "lucide-react";
import type { PrismIssuedProposalSummary } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Checkbox } from "@prism/ui/components/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { Label } from "@prism/ui/components/label";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { Textarea } from "@prism/ui/components/textarea";
import { PrismSection } from "@prism/ui/page-blocks";
import { DataRow, money } from "../../shared/tab-ui";
import type { DetailTab } from "../../workspace/shared";
import { CLIENT_PROPOSAL_REVISION_CAP, PROPOSAL_REVISION_AREA_OPTIONS, proposalClientStatus } from "../model/proposal-review-rules";
import { useClientProposalTabViewModel, type ClientProposalTabViewModel } from "../view-models/use-client-proposal-tab-view-model";
import { ProposalCommentsThread } from "./proposal-comments-thread";
import { ClientVenueStylingReview } from "./client-venue-styling-review";
import { ClientVenueScouting } from "./client-venue-scouting";
import { ClientPresentationMeeting } from "./client-presentation-meeting";

function proposalBadge(status: string, packageReady: boolean) {
  if (status === "approved") return { status: "approved", label: "Approved" };
  if (status === "revision_requested") return { status: "pending", label: "Changes requested" };
  if (!packageReady) return { status: "pending", label: "In preparation" };
  return { status: "ready", label: "Ready to review" };
}

const changeRequestsLeft = (count: number) => (count === 1 ? "1 change request left" : `${count} change requests left`);

/** One sentence on where the proposal stands and, when it is the reader's turn, the two ways to answer. */
function ProposalStatusHero({ vm, onOpenBriefing }: { vm: ClientProposalTabViewModel; onOpenBriefing: () => void }) {
  const event = vm.selectedEvent;
  if (!event) return null;
  const status = proposalClientStatus(event);
  const badge = proposalBadge(status, vm.packageReady);
  let body: React.ReactNode;
  if (status === "approved") {
    const when = event.proposalReviewedAt ? ` on ${formatPortalDate(event.proposalReviewedAt)}` : "";
    body = <p className="text-sm text-muted-foreground">Approved by {event.clientName}{when}. PMCM is planning your event with this version. Later changes go through a change request.</p>;
  } else if (status === "revision_requested") {
    body = <p className="text-sm text-muted-foreground">PMCM will send a new version for you to review. {changeRequestsLeft(vm.remainingRevisions)} after that.</p>;
  } else if (!vm.packageReady) {
    body = vm.needsBriefing ? (
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">PMCM prices your package from the event briefing. Finish it so they can prepare your proposal.</p>
        <Button type="button" onClick={onOpenBriefing}>Complete briefing</Button>
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">We&apos;ll let you know as soon as it&apos;s ready to review.</p>
    );
  } else if (!vm.isDecider) {
    body = (
      <p className="text-sm text-muted-foreground">
        {vm.decider?.name ?? "The primary contact"} is the primary contact on this event and decides on the proposal. You can read it and leave comments below.
      </p>
    );
  } else {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Read the package below. Approving moves {event.eventName} into planning.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={!vm.canApprove || vm.reviewing} onClick={() => vm.setDialog("approve")}>
            <ThumbsUp className="size-4" /> Approve proposal
          </Button>
          <Button type="button" variant="outline" disabled={!vm.canRequestRevision || vm.reviewing} onClick={() => vm.setDialog("revise")}>
            Ask for changes
          </Button>
          <span className="text-xs text-muted-foreground">
            {vm.canRequestRevision
              ? `${vm.remainingRevisions} of ${CLIENT_PROPOSAL_REVISION_CAP} change requests left`
              : `You've used all ${CLIENT_PROPOSAL_REVISION_CAP} change requests. Approve this version or message PMCM.`}
          </span>
        </div>
      </div>
    );
  }
  // The page's lead, not a card: one heading, one sentence and, when it is the reader's turn, the two answers.
  return (
    <section aria-labelledby="proposal-status-heading" className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="proposal-status-heading" className="text-lg font-semibold text-foreground">{vm.proposal && vm.packageReady && status === "pending" ? `Version ${vm.proposal.versionNumber} is ready to review` : vm.headline}</h2>
        <StatusBadge status={badge.status} label={badge.label} />
      </div>
      {body}
    </section>
  );
}

function ProposalDetails({ proposal }: { proposal: PrismIssuedProposalSummary }) {
  return (
    <PrismSection id="proposal-details" title={`Proposal version ${proposal.versionNumber}`} headerOutside>
        <DataRow label="Package" value={proposal.title} />
        <DataRow label={proposal.alternativeTotalAmount ? "Option A total" : "Total"} value={money.format(proposal.totalAmount)} />
        {proposal.alternativeTotalAmount ? <DataRow label="Option B total" value={money.format(proposal.alternativeTotalAmount)} /> : null}
        <DataRow label="Sent" value={formatPortalDate(proposal.issuedAt)} />
        {proposal.revisionNote.trim() ? (
          <p className="whitespace-pre-wrap pt-3 text-sm text-foreground"><span className="font-semibold">What changed:</span> {proposal.revisionNote}</p>
        ) : null}
        {proposal.summary ? <p className="whitespace-pre-wrap pt-3 text-sm leading-6 text-muted-foreground">{proposal.summary}</p> : null}
    </PrismSection>
  );
}

function ApproveProposalDialog({ vm }: { vm: ClientProposalTabViewModel }) {
  if (!vm.proposal || !vm.selectedEvent) return null;
  return (
    <Dialog open={vm.dialog === "approve"} onOpenChange={(open) => vm.setDialog(open ? "approve" : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve proposal version {vm.proposal.versionNumber}?</DialogTitle>
          <DialogDescription>
            This moves {vm.selectedEvent.eventName} into planning with this package. After you approve, changes go through a change request.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => vm.setDialog(null)} disabled={vm.reviewing}>Not yet</Button>
          <Button type="button" onClick={() => void vm.approve()} disabled={vm.reviewing}>{vm.reviewing ? "Approving…" : "Approve proposal"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestChangesDialog({ vm }: { vm: ClientProposalTabViewModel }) {
  const after = Math.max(0, vm.remainingRevisions - 1);
  return (
    <Dialog open={vm.dialog === "revise"} onOpenChange={(open) => vm.setDialog(open ? "revise" : null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask PMCM for changes</DialogTitle>
          <DialogDescription>
            This uses one of your {vm.remainingRevisions} remaining change requests.{after === 0 ? " After it, you can only approve the next version or message PMCM." : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(formEvent) => { formEvent.preventDefault(); void vm.requestRevision(); }}
        >
          <fieldset>
            <legend className="text-sm font-semibold text-foreground">What should change?</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PROPOSAL_REVISION_AREA_OPTIONS.map((option) => {
                const id = `revision-area-${option.value}`;
                return (
                  <div key={option.value} className="flex items-center gap-2">
                    <Checkbox id={id} checked={vm.revisionAreas.includes(option.value)} onCheckedChange={(checked) => vm.toggleRevisionArea(option.value, checked === true)} />
                    <Label htmlFor={id} className="text-sm font-normal">{option.label}</Label>
                  </div>
                );
              })}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="revision-note">Tell PMCM what to change</Label>
            <Textarea
              id="revision-note"
              required
              rows={4}
              value={vm.revisionNote}
              onChange={(changeEvent) => vm.setRevisionNote(changeEvent.target.value)}
              placeholder="For example: fewer tables near the stage, and a lower styling budget."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => vm.setDialog(null)} disabled={vm.reviewing}>Cancel</Button>
            <Button type="submit" disabled={vm.reviewing || !vm.revisionNote.trim()}>{vm.reviewing ? "Sending…" : "Send change request"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClientProposalTab({ setTab }: { setTab: (tab: DetailTab) => void }) {
  const vm = useClientProposalTabViewModel();
  if (!vm.selectedEvent) return null;

  return (
    <div className="space-y-5">
      <ProposalStatusHero vm={vm} onOpenBriefing={() => setTab("briefing")} />
      {vm.proposal ? <ProposalDetails proposal={vm.proposal} /> : null}
      <ProposalCommentsThread eventId={vm.selectedEvent.id} enabled={Boolean(vm.proposal)} />
      <ClientPresentationMeeting eventId={vm.selectedEvent.id} />
      <ClientVenueScouting eventId={vm.selectedEvent.id} />
      <ClientVenueStylingReview eventId={vm.selectedEvent.id} />
      <ApproveProposalDialog vm={vm} />
      <RequestChangesDialog vm={vm} />
    </div>
  );
}
