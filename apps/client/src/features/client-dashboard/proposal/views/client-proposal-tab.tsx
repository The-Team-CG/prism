"use client";

import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
  LockKeyhole,
  MapPinned,
  MessageSquareText,
  Presentation,
  ReceiptText,
  ThumbsUp,
  Timer,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type {
  PrismAuditLog,
  PrismBillingStatement,
  PrismBriefing,
  PrismDocument,
  PrismEvent,
  PrismFloorPlanDraft,
  PrismPaymentMilestone,
} from "@/lib/prism-api";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import {
  Card,
  CardBody,
  CardHeader,
  DataRow,
  InfoGrid,
  SectionLabel,
  actorInitials,
  clientActivityActor,
  clientActivityTitle,
  formatDayLabel,
  formatLabel,
  groupByDay,
  money,
  portalBadgeStatus,
  portalStatusLabel,
} from "../../shared/tab-ui";
import type { DetailTab } from "../../workspace/model/client-dashboard.types";


export function ClientProposalTab({
  selectedEvent,
  briefing,
  billing,
  payments,
  officialDraft,
  setTab,
}: {
  selectedEvent: PrismEvent;
  briefing?: PrismBriefing;
  billing?: PrismBillingStatement;
  payments: PrismPaymentMilestone[];
  officialDraft?: PrismFloorPlanDraft;
  setTab: (tab: DetailTab) => void;
}) {
  const nextPayment = payments.find((p) => p.status !== "paid");
  const proposalReady = Boolean(briefing && billing);

  return (
    <div className="space-y-5">
      {/* Status hero */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <SectionLabel>Proposal status</SectionLabel>
              <h2 className="mt-1 text-xl font-black text-foreground">
                {proposalReady ? "Proposal ready for review." : "PMCM is preparing your proposal."}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                This view summarizes your briefing, planning package, payment schedule, and layout status. Internal cost estimation stays with PMCM.
              </p>
              {proposalReady && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button className="rounded-lg font-bold">
                    <ThumbsUp className="size-4" /> Approve proposal
                  </Button>
                  <Button variant="outline" className="rounded-lg font-semibold">
                    Request revision
                  </Button>
                </div>
              )}
            </div>
            <StatusBadge
              status={proposalReady ? "ready" : "pending"}
              label={proposalReady ? "Ready for review" : "In preparation"}
            />
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Package details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Presentation className="size-4 text-(--prism-signal)" />
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
          </CardBody>
        </Card>

        {/* Review checklist */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquareText className="size-4 text-(--prism-signal)" />
              <h3 className="text-sm font-bold text-foreground">Review checklist</h3>
            </div>
          </CardHeader>
          <div className="divide-y divide-border">
            {[
              {
                label: "Briefing details",
                value: briefing ? "Ready" : "Waiting",
                status: briefing ? "approved" : "pending",
                action: () => setTab("briefing"),
              },
              {
                label: "Planning package",
                value: proposalReady ? "Ready for review" : "In preparation",
                status: proposalReady ? "ready" : "pending",
                action: () => setTab("proposal"),
              },
              {
                label: "Official layout",
                value: officialDraft ? formatLabel(officialDraft?.status) : "Not published",
                status: officialDraft?.status ?? "pending",
                action: () => setTab("floorplan"),
              },
              {
                label: "Billing milestones",
                value: billing ? formatLabel(billing.status) : "Not issued",
                status: billing?.status ?? "pending",
                action: () => setTab("billing"),
              },
            ].map((item) => (
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
      </div>
    </div>
  );
}
