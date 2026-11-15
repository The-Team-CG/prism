"use client";
import Link from "next/link";
import { formatPortalDate, formatPortalDateTime, manilaDateKey } from "@prism/ui/format-date";
import { EventCover, StepProgress } from "@prism/ui/event-cards";
import { ClientEventHero, ClientEventHeroStep, clientEventDaysToGo } from "../../../shared/client-event-hero";
import { dashboardHref } from "../../../workspace/shared";
import type { GettingStartedStep, SinceLastVisitItem } from "../../model/client-overview-glance";

import {
  ArrowRight,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
  MapPinned,
  MessageSquareText,
  PartyPopper,
  ReceiptText,
  X,
  type LucideIcon,
} from "lucide-react";
import { PRISM_LIFECYCLE_STAGE_LABELS, derivePrismLifecycleStage } from "@prism/types";
import type { PrismClientActionItem, PrismBillingStatement, PrismBriefing, PrismDocument, PrismEvent, PrismFloorPlanDraft, PrismPaymentMilestone } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { StatusBadge } from "@prism/ui/components/status-badge";
import {
  Card,
  CardBody,
  CardHeader,
  DataRow,
  formatLabel,
  money,
  portalBadgeStatus,
  portalStatusLabel,
} from "../../../shared/tab-ui";
import type { DetailTab } from "../../../workspace/shared";

/** The overview's lead: the event, how far away it is, where it stands and the one thing the client should do next. */
export function OverviewNextDecision({
  selectedEvent,
  nextAction,
  coverUrl,
}: {
  selectedEvent: PrismEvent;
  nextAction?: PrismClientActionItem;
  coverUrl?: string;
}) {
  const daysToGo = clientEventDaysToGo(selectedEvent, manilaDateKey());
  const backdrop = <EventCover eventType={selectedEvent.eventType} imageUrl={coverUrl} tag={false} className="h-full" />;
  return (
    <ClientEventHero event={selectedEvent} daysToGo={daysToGo} backdrop={backdrop} label={daysToGo !== null && daysToGo >= 0 ? "Your event" : "Your event · date passed"}>
      {nextAction ? (
        <>
          <ClientEventHeroStep
            label={`Your next step${nextAction.dueAt ? ` · due ${formatPortalDate(nextAction.dueAt)}` : ""}`}
            title={nextAction.label}
            description={nextAction.description || undefined}
          />
          {nextAction.href ? (
            <Button asChild className="shrink-0">
              <a href={nextAction.href}>
                Open <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-ink-foreground/70">Nothing needs your action right now. PMCM will let you know when it does.</p>
      )}
    </ClientEventHero>
  );
}

export function OverviewEventDetails({
  selectedEvent,
  briefing,
}: {
  selectedEvent: PrismEvent;
  briefing?: PrismBriefing;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Event details</h3>
        </div>
      </CardHeader>
      <CardBody className="py-2">
        <DataRow label="Primary contact" value={selectedEvent.clientName} />
        <DataRow label="Date" value={formatPortalDate(selectedEvent.eventDate, "Pending")} />
        <DataRow label="Stage" value={PRISM_LIFECYCLE_STAGE_LABELS[derivePrismLifecycleStage(selectedEvent)]} />
        <DataRow
          label="Portal access"
          value={
            <StatusBadge
              status={portalBadgeStatus(selectedEvent.clientPortalStatus)}
              label={portalStatusLabel(selectedEvent.clientPortalStatus)}
            />
          }
        />
        <DataRow label="Venue" value={briefing?.venue ?? "To be confirmed"} />
        <DataRow label="Guests" value={briefing?.guestCount ? `${briefing.guestCount} guests` : "Pending"} />
      </CardBody>
    </Card>
  );
}

export function OverviewFloorPlanCard({
  officialDraft,
  preferenceDraftCount,
  onOpenOfficialFloorplan,
  setTab,
}: {
  officialDraft?: PrismFloorPlanDraft;
  preferenceDraftCount: number;
  onOpenOfficialFloorplan?: () => void;
  setTab: (tab: DetailTab) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPinned className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Floor plan</h3>
          </div>
          {officialDraft ? <StatusBadge status={officialDraft.status} label={formatLabel(officialDraft.status)} /> : null}
        </div>
      </CardHeader>
      <CardBody className="py-2">
        <DataRow label="Preference drafts" value={preferenceDraftCount || "None yet"} />
        <DataRow label="Official layout" value={officialDraft ? formatLabel(officialDraft.status) : "Not published"} />
        <DataRow label="Last update" value={officialDraft ? formatPortalDateTime(officialDraft.updatedAt) : "—"} />
      </CardBody>
      <div className="px-6 pb-5">
        <Button
          className="w-full rounded-lg font-semibold"
          onClick={officialDraft && onOpenOfficialFloorplan ? onOpenOfficialFloorplan : () => setTab("floorplan")}
        >
          {officialDraft ? "Open floor plan" : "Set layout preferences"} <ArrowRight className="size-4" />
        </Button>
      </div>
    </Card>
  );
}

export function OverviewNextPayment({
  billing,
  nextPayment,
  setTab,
}: {
  billing?: PrismBillingStatement;
  nextPayment?: PrismPaymentMilestone;
  setTab: (tab: DetailTab) => void;
}) {
  if (!billing && !nextPayment) return null;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ReceiptText className="size-4 text-attention" />
          <h3 className="text-sm font-semibold text-foreground">Next payment</h3>
        </div>
      </CardHeader>
      <CardBody className="py-2">
        {nextPayment ? (
          <>
            <DataRow label="Milestone" value={nextPayment.label} />
            <DataRow label="Due" value={formatPortalDate(nextPayment.dueDate)} />
            <DataRow label="Amount" value={money.format(nextPayment.amount)} />
          </>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">All milestones settled.</p>
        )}
      </CardBody>
      <div className="px-6 pb-5">
        <Button variant="outline" className="w-full rounded-lg font-semibold" onClick={() => setTab("billing")}>
          View billing
        </Button>
      </div>
    </Card>
  );
}

/** Said once, on the first visit after the event moves to a new stage. */
export function OverviewStageBanner({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div role="status" className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm text-foreground">
      <PartyPopper aria-hidden className="size-4 shrink-0 text-success" />
      <p className="min-w-0 flex-1 font-medium">{message}</p>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground">
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}

const SINCE_LOOK: Record<SinceLastVisitItem["id"], { icon: LucideIcon; href: (eventId: string) => string }> = {
  messages: { icon: MessageSquareText, href: (eventId) => dashboardHref("messages", eventId) },
  files: { icon: FileText, href: (eventId) => dashboardHref("files", eventId) },
  notices: { icon: Bell, href: () => dashboardHref("notifications") },
};

/** What is new since the client was last here, each a link to it; a calm line when everything has been seen. */
export function OverviewSinceLastVisit({ eventId, items, loaded }: { eventId: string; items: SinceLastVisitItem[]; loaded: boolean }) {
  if (items.length === 0) {
    return loaded ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 aria-hidden className="size-4 text-success" />You are up to date on this event.</p> : null;
  }
  return (
    <nav aria-label="Since your last visit" className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Since your last visit</span>
      {items.map((item) => {
        const { icon: Icon, href } = SINCE_LOOK[item.id];
        return (
          <Link key={item.id} href={href(eventId)} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-3 py-1 text-sm font-medium text-primary hover:bg-primary-soft">
            <Icon aria-hidden className="size-3.5" />{item.text}
          </Link>
        );
      })}
    </nav>
  );
}

/** A new event's first steps as a checklist, so the client sees how far along they are and what to do next. */
export function OverviewGettingStarted({ steps, setTab }: { steps: GettingStartedStep[]; setTab: (tab: DetailTab) => void }) {
  const done = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done);
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-foreground">Get started</h3>
      </CardHeader>
      <CardBody className="grid gap-3 py-3">
        <StepProgress done={done} total={steps.length} current={next ? `Next: ${next.label}` : undefined} />
        <ul className="grid gap-1">
          {steps.map((step) => (
            <li key={step.id}>
              <button
                type="button"
                disabled={step.done || step.tab === "overview"}
                onClick={() => setTab(step.tab)}
                className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left text-sm enabled:hover:bg-surface-raised"
              >
                <span aria-hidden className={step.done ? "grid size-5 shrink-0 place-items-center rounded-full bg-success text-success-foreground" : "size-5 shrink-0 rounded-full border-2 border-border"}>
                  {step.done ? <Check className="size-3" /> : null}
                </span>
                <span className={step.done ? "text-muted-foreground line-through" : step === next ? "font-semibold text-foreground" : "text-foreground"}>{step.label}</span>
                <span className="sr-only">{step.done ? " (done)" : ""}</span>
                {!step.done && step.tab !== "overview" ? <ArrowRight aria-hidden className="ml-auto size-4 text-muted-foreground" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export type ComingUpLine = { id: string; label: string; at: string | null; href?: string };

/** The event's next dated steps, soonest first: payments due, reviews, the venue visit. */
export function OverviewComingUp({ lines }: { lines: ComingUpLine[] }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-foreground">Coming up</h3>
      </CardHeader>
      <CardBody className="py-3">
        {lines.length === 0 ? <p className="text-sm text-muted-foreground">Nothing dated yet. Dates appear here as PMCM sets them.</p> : (
          <ul className="grid gap-2.5">
            {lines.map((line) => {
              const body = (
                <>
                  <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{line.label}</span>
                    {line.at ? <span className="block text-xs text-muted-foreground">{formatPortalDateTime(line.at)}</span> : null}
                  </span>
                </>
              );
              return <li key={line.id}>{line.href ? <Link href={line.href} className="flex items-start gap-2.5 rounded-md hover:bg-surface-raised">{body}</Link> : <div className="flex items-start gap-2.5">{body}</div>}</li>;
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
