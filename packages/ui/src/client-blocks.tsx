"use client";

import type { ReactNode } from "react";
import { CalendarDays, CheckCircle2, FileText, LayoutPanelTop, LockKeyhole, ReceiptText } from "lucide-react";
import {
  PrismBadge,
  PrismButton,
  PrismCard,
  PrismCardContent,
  PrismCardHeader,
  PrismCardTitle,
  type PrismBadgeTone,
} from "./primitives";
import {
  PrismBillingMilestoneList,
  PrismDocumentList,
  PrismNoticeBanner,
  PrismSectionPanel,
  PrismStatusTimeline,
  type PrismBillingMilestone,
  type PrismDocumentItem,
  type PrismTimelineItem,
} from "./blocks";

export interface ClientConformeGateProps {
  status: "pending" | "signed" | "needs-review" | "locked";
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}

export interface ClientBriefingSummaryProps {
  eventName: string;
  eventDate: string;
  venue: string;
  guestCount: string;
  packageLabel: string;
  notes?: string;
}

export interface ClientOfficialFloorplanProps {
  status: "not-started" | "draft" | "submitted" | "approved";
  updatedAt?: string;
  summary: string;
  onOpen?: () => void;
}

export interface ClientDefenseWorkspaceProps {
  conforme: ClientConformeGateProps;
  briefing: ClientBriefingSummaryProps;
  floorplan: ClientOfficialFloorplanProps;
  billing: PrismBillingMilestone[];
  documents: PrismDocumentItem[];
  activity: PrismTimelineItem[];
}

const conformeTone: Record<ClientConformeGateProps["status"], "info" | "success" | "warning"> = {
  pending: "warning",
  signed: "success",
  "needs-review": "info",
  locked: "info",
};

const floorplanLabel: Record<ClientOfficialFloorplanProps["status"], string> = {
  "not-started": "Not prepared",
  draft: "PMCM draft",
  submitted: "Submitted",
  approved: "Approved",
};

const floorplanTone: Record<ClientOfficialFloorplanProps["status"], PrismBadgeTone> = {
  "not-started": "neutral",
  draft: "warning",
  submitted: "info",
  approved: "success",
};

export function ClientConformeGate({
  status,
  title,
  description,
  primaryAction,
  secondaryAction,
}: ClientConformeGateProps) {
  const Icon = status === "signed" ? CheckCircle2 : LockKeyhole;

  return (
    <PrismNoticeBanner tone={conformeTone[status]} title={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <Icon className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm leading-6">{description}</p>
        </div>
        {primaryAction || secondaryAction ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {primaryAction}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    </PrismNoticeBanner>
  );
}

export function ClientBriefingSummary({
  eventName,
  eventDate,
  venue,
  guestCount,
  packageLabel,
  notes,
}: ClientBriefingSummaryProps) {
  return (
    <PrismSectionPanel
      title="Event briefing"
      description="The confirmed details PMCM is using for planning."
      icon={CalendarDays}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Event", eventName],
          ["Date", eventDate],
          ["Venue", venue],
          ["Guest count", guestCount],
          ["Package", packageLabel],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border/70 bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>
      {notes ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{notes}</p> : null}
    </PrismSectionPanel>
  );
}

export function ClientOfficialFloorplan({ status, updatedAt, summary, onOpen }: ClientOfficialFloorplanProps) {
  return (
    <PrismCard>
      <PrismCardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <PrismCardTitle className="flex items-center gap-2">
              <LayoutPanelTop className="size-4 text-primary" />
              Official floorplan
            </PrismCardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Read-only client copy. PMCM owns editing and approval.
            </p>
          </div>
          <PrismBadge tone={floorplanTone[status]}>{floorplanLabel[status]}</PrismBadge>
        </div>
      </PrismCardHeader>
      <PrismCardContent>
        <p className="text-sm leading-6 text-muted-foreground">{summary}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {updatedAt ? `Updated ${updatedAt}` : "No official snapshot yet"}
          </span>
          {onOpen ? (
            <PrismButton type="button" size="sm" variant="outline" onClick={onOpen}>
              View read-only plan
            </PrismButton>
          ) : null}
        </div>
      </PrismCardContent>
    </PrismCard>
  );
}

export function ClientDefenseWorkspace({
  conforme,
  briefing,
  floorplan,
  billing,
  documents,
  activity,
}: ClientDefenseWorkspaceProps) {
  return (
    <div className="space-y-5">
      <ClientConformeGate {...conforme} />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <ClientBriefingSummary {...briefing} />
        <ClientOfficialFloorplan {...floorplan} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <PrismSectionPanel
          title="Billing milestones"
          description="Payment progress and PMCM-reviewed billing states"
          icon={ReceiptText}
        >
          <PrismBillingMilestoneList milestones={billing} />
        </PrismSectionPanel>
        <PrismSectionPanel
          title="Documents"
          description="Files and submissions tied to this confirmed event"
          icon={FileText}
        >
          <PrismDocumentList documents={documents} />
        </PrismSectionPanel>
      </div>
      <PrismSectionPanel title="Activity" description="Recent PMCM and client-facing updates">
        <PrismStatusTimeline items={activity} />
      </PrismSectionPanel>
    </div>
  );
}
