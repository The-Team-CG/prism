"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
    MapPin,
  MapPinned,
  MessageSquareText,
  PartyPopper,
  ReceiptText,
  X,
  type LucideIcon,
} from "lucide-react";
import type { PrismBillingStatement, PrismBriefing, PrismEvent, PrismFloorPlanDraft, PrismPaymentMilestone } from "@prism/types";
import { formatPortalDate, formatPortalDateTime, formatPortalTime, manilaDateKey } from "@prism/ui/format-date";
import { AgendaList, EventCover, MoneyBar } from "@prism/ui/event-cards";
import { PrismPanel } from "@prism/ui/page-blocks";
import { Button } from "@prism/ui/components/button";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { cn } from "@/app/components/ui/utils";
import { ClientEventHero, ClientEventHeroStep, clientEventDaysToGo } from "../../../shared/client-event-hero";
import { money, portalBadgeStatus, portalStatusLabel } from "../../../shared/tab-ui";
import { dashboardHref, type DetailTab } from "../../../workspace/shared";
import type { ClientDashboardAction } from "../../../workspace/model/client-dashboard-view-rules";
import { layoutSteps, paymentTotals, type GettingStartedStep, type SinceLastVisitItem } from "../../model/client-overview-glance";

/** The overview's lead: the event, how far away it is, where it stands, what is new and the one thing to do next. */
export function OverviewNextDecision({
  selectedEvent,
  nextAction,
  onAction,
  coverUrl,
  since,
}: {
  selectedEvent: PrismEvent;
  /** The first of what needs the client, in the same order as the Actions list. */
  nextAction?: ClientDashboardAction;
  onAction: (action: ClientDashboardAction) => void;
  coverUrl?: string;
  /** What is new since the client's last visit, under the stage track. */
  since?: ReactNode;
}) {
  const daysToGo = clientEventDaysToGo(selectedEvent, manilaDateKey());
  const backdrop = <EventCover eventType={selectedEvent.eventType} imageUrl={coverUrl} tag={false} className="h-full" />;
  return (
    <ClientEventHero event={selectedEvent} daysToGo={daysToGo} backdrop={backdrop} extra={since} label={daysToGo !== null && daysToGo >= 0 ? "Your event" : "Your event · date passed"}>
      {nextAction ? (
        <>
          <ClientEventHeroStep
            label={`Your next step${nextAction.dueAt ? ` · due ${formatPortalDate(nextAction.dueAt)}` : ""}`}
            title={nextAction.title}
            description={nextAction.description || undefined}
          />
          <Button type="button" className="shrink-0" onClick={() => onAction(nextAction)}>
            {nextAction.ctaLabel} <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </>
      ) : (
        <p className="text-sm text-ink-foreground/70">Nothing needs your action right now. PMCM will let you know when it does.</p>
      )}
    </ClientEventHero>
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

/** What is new since the client was last here, as links on the hero; a calm line when everything has been seen. */
export function OverviewSinceLastVisit({ eventId, items, loaded }: { eventId: string; items: SinceLastVisitItem[]; loaded: boolean }) {
  if (items.length === 0) {
    return loaded ? <p className="flex items-center gap-1.5 text-xs text-ink-foreground/70"><CheckCircle2 aria-hidden className="size-3.5" />You are up to date on this event.</p> : null;
  }
  return (
    <nav aria-label="Since your last visit" className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-foreground/70">Since your last visit</span>
      {items.map((item) => {
        const { icon: Icon, href } = SINCE_LOOK[item.id];
        return (
          <Link key={item.id} href={href(eventId)} className="inline-flex items-center gap-1.5 rounded-full bg-ink-foreground/12 px-2.5 py-1 text-xs font-medium text-ink-foreground hover:bg-ink-foreground/20">
            <Icon aria-hidden className="size-3.5" />{item.text}
          </Link>
        );
      })}
    </nav>
  );
}

/** The one way on from a card, in the same place on every card. */
function PanelAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center justify-between text-sm font-medium text-primary">
      {label}
      <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return <dl className="mt-4 grid gap-2 border-t border-border pt-3 text-sm">{children}</dl>;
}

/** A card's lead figure: one large number or word and what it counts. */
function Figure({ value, caption, tone = "text-foreground" }: { value: ReactNode; caption: ReactNode; tone?: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className={cn("text-3xl font-semibold leading-none tabular-nums", tone)}>{value}</span>
      <span className="text-sm text-muted-foreground">{caption}</span>
    </p>
  );
}

/**
 * A new event's first steps as one line rather than a card: how many are done, each step with its tick, and the next
 * one as a link. The hero already carries the filled button, so nothing here competes with it.
 */
export function OverviewFirstSteps({ steps, setTab }: { steps: GettingStartedStep[]; setTab: (tab: DetailTab) => void }) {
  const done = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done);
  return (
    <section aria-labelledby="overview-first-steps" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <h2 id="overview-first-steps" className="text-sm font-semibold text-foreground">
        First steps <span className="font-normal tabular-nums text-muted-foreground">{done} of {steps.length} done</span>
      </h2>
      <ol className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center gap-1.5">
            <span aria-hidden className={cn(
              "grid size-5 shrink-0 place-items-center rounded-full text-2xs font-semibold",
              step.done ? "bg-success-soft text-success" : step === next ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}>
              {step.done ? <Check className="size-3" /> : index + 1}
            </span>
            {step === next && step.tab !== "overview" ? (
              <button type="button" onClick={() => setTab(step.tab)} className="font-medium text-primary hover:text-primary/80">{step.label}</button>
            ) : (
              <span className={step.done ? "text-muted-foreground" : "text-foreground"}>{step.label}</span>
            )}
            <span className="sr-only">{step.done ? " (done)" : step === next ? " (next)" : ""}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** `allDay` lines (the event day, a cutoff) are dates without a time. */
export type ComingUpLine = { id: string; label: string; at: string | null; href?: string; allDay?: boolean; note?: string };

/** The event's next dated steps on calendar leaves, soonest first: payments due, reviews, the venue visit. */
export function OverviewComingUp({ lines }: { lines: ComingUpLine[] }) {
  const items = lines.map((line) => ({ id: line.id, title: line.label, date: line.at, detail: [line.at && !line.allDay && line.at.includes("T") ? formatPortalTime(line.at) : null, line.note].filter(Boolean).join(" · ") || undefined, href: line.href }));
  return (
    <PrismPanel id="overview-coming-up" title="Coming up" icon={CalendarClock}>
      {items.length === 0
        ? <p className="text-sm text-muted-foreground">Nothing dated yet. Dates appear here as PMCM sets them.</p>
        : <AgendaList items={items} link={Link} />}
    </PrismPanel>
  );
}

export function OverviewEventDetails({ selectedEvent, briefing, setTab }: { selectedEvent: PrismEvent; briefing?: PrismBriefing; setTab: (tab: DetailTab) => void }) {
  const guests = briefing?.guestCount;
  return (
    <PrismPanel id="overview-event-details" title="Event details" icon={ClipboardList} footer={<PanelAction label="Event briefing" onClick={() => setTab("briefing")} />}>
      <Figure value={guests ?? "—"} caption={guests ? "guests" : "guest count to come"} />
      <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin aria-hidden className="size-4 shrink-0" />{briefing?.venue ?? selectedEvent.venue ?? "Venue to be confirmed"}</p>
      <Facts>
        <Fact label="Primary contact">{selectedEvent.clientName}</Fact>
        <Fact label="Portal access">
          <StatusBadge status={portalBadgeStatus(selectedEvent.clientPortalStatus)} label={portalStatusLabel(selectedEvent.clientPortalStatus)} />
        </Fact>
      </Facts>
    </PrismPanel>
  );
}

function layoutCaption(officialDraft: PrismFloorPlanDraft | undefined, preferenceDraftCount: number) {
  if (officialDraft?.status === "approved") return "Your official layout is approved.";
  if (officialDraft) return "PMCM shared your official layout.";
  if (preferenceDraftCount > 0) return "PMCM is working from your ideas.";
  return "Show us how you would like the room set up.";
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
  const steps = layoutSteps({ preferenceDraftCount, officialStatus: officialDraft?.status });
  const action = officialDraft && onOpenOfficialFloorplan
    ? <PanelAction label="Open floor plan" onClick={onOpenOfficialFloorplan} />
    : <PanelAction label={preferenceDraftCount ? "Edit your layout ideas" : "Set layout preferences"} onClick={() => setTab("floorplan")} />;
  return (
    <PrismPanel id="overview-floor-plan" title="Floor plan" icon={MapPinned} footer={action}>
      <ol aria-label={`Floor plan: ${steps.filter((step) => step.done).length} of ${steps.length} steps done`} className="grid grid-cols-3 gap-1.5">
        {steps.map((step) => (
          <li key={step.id} className="grid gap-1.5">
            <span aria-hidden className={cn("h-1.5 rounded-full", step.done ? "bg-success" : "bg-muted")} />
            <span className={cn("flex items-center gap-1 text-xs", step.done ? "font-medium text-foreground" : "text-muted-foreground")}>
              {step.done ? <Check aria-hidden className="size-3 text-success" /> : null}{step.label}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm font-medium text-foreground">{layoutCaption(officialDraft, preferenceDraftCount)}</p>
      <Facts>
        <Fact label="Your layout ideas">{preferenceDraftCount || "None yet"}</Fact>
        <Fact label="Last update">{officialDraft ? formatPortalDateTime(officialDraft.updatedAt) : "—"}</Fact>
      </Facts>
    </PrismPanel>
  );
}

function nextPaymentCaption(payment: PrismPaymentMilestone) {
  return `${payment.label} · ${payment.overdue ? "was due" : "due"} ${formatPortalDate(payment.dueDate)}`;
}

/** The next amount due, then everything billed so far as a bar of what is paid. */
export function OverviewNextPayment({
  billing,
  payments,
  setTab,
}: {
  billing?: PrismBillingStatement;
  payments: PrismPaymentMilestone[];
  setTab: (tab: DetailTab) => void;
}) {
  const next = payments.find((payment) => payment.status !== "paid" && !payment.supersededAt);
  const totals = paymentTotals(payments);
  return (
    <PrismPanel id="overview-payments" title="Payments" icon={ReceiptText} footer={<PanelAction label="View billing" onClick={() => setTab("billing")} />}>
      {next ? (
        <Figure value={money.format(Math.max(0, next.amount - next.amountPaid))} caption={nextPaymentCaption(next)} tone={next.overdue ? "text-danger" : "text-foreground"} />
      ) : (
        <Figure value={totals.billed > 0 ? "Paid" : "—"} caption={totals.billed > 0 ? "every milestone is settled" : "no payments scheduled yet"} tone={totals.billed > 0 ? "text-success" : "text-foreground"} />
      )}
      <div className="mt-3 flex">
        <MoneyBar billed={totals.billed} paid={totals.paid} />
      </div>
      <Facts>
        <Fact label="Contract total">{billing ? money.format(billing.totalAmount) : totals.billed ? money.format(totals.billed) : "To be billed"}</Fact>
        <Fact label="Milestones">{payments.filter((payment) => !payment.supersededAt).length || "—"}</Fact>
      </Facts>
    </PrismPanel>
  );
}
