import { PRISM_LIFECYCLE_STAGES, PRISM_LIFECYCLE_STAGE_LABELS, derivePrismLifecycleStage, isBeforePrismEventDay, type PrismClientOcularVisit, type PrismEvent, type PrismLifecycleStage, type PrismPaymentMilestone } from "@prism/types";
import type { DetailTab } from "../../workspace/shared";

export type GettingStartedStep = { id: string; label: string; done: boolean; tab: DetailTab };

/**
 * The first five things a new event needs from the client, in the order they usually happen. The conforme is done by
 * the time the portal opens; the downpayment is the earliest payment milestone.
 */
export function gettingStartedSteps({ event, hasBriefing, hasLayoutIdeas, payments }: {
  event: Pick<PrismEvent, "clientPortalStatus" | "proposalClientStatus">;
  hasBriefing: boolean;
  hasLayoutIdeas: boolean;
  payments: Pick<PrismPaymentMilestone, "dueDate" | "status">[];
}): GettingStartedStep[] {
  const downpayment = [...payments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  return [
    { id: "conforme", label: "Sign the conforme", done: event.clientPortalStatus === "unlocked", tab: "overview" },
    { id: "briefing", label: "Tell us about your event", done: hasBriefing, tab: "briefing" },
    { id: "layout", label: "Share your layout ideas", done: hasLayoutIdeas, tab: "floorplan" },
    { id: "proposal", label: "Approve the proposal", done: event.proposalClientStatus === "approved", tab: "proposal" },
    { id: "downpayment", label: "Pay the downpayment", done: downpayment?.status === "paid", tab: "billing" },
  ];
}

/** The checklist stays until every step is done, and is gone once the event day arrives. */
export function showGettingStarted(event: Parameters<typeof derivePrismLifecycleStage>[0], steps: GettingStartedStep[]): boolean {
  return isBeforePrismEventDay(derivePrismLifecycleStage(event)) && steps.some((step) => !step.done);
}

export type SinceLastVisitItem = { id: "messages" | "files" | "notices"; text: string };

const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

/** What changed since the client was last here; zeros and counts still loading are left out. */
export function sinceLastVisitItems({ unreadMessages, newFiles, unreadNotices }: { unreadMessages?: number; newFiles?: number; unreadNotices?: number }): SinceLastVisitItem[] {
  const items: SinceLastVisitItem[] = [];
  if (unreadMessages) items.push({ id: "messages", text: count(unreadMessages, "new message", "new messages") });
  if (newFiles) items.push({ id: "files", text: count(newFiles, "new file", "new files") });
  if (unreadNotices) items.push({ id: "notices", text: count(unreadNotices, "unread notice", "unread notices") });
  return items;
}

/** A venue visit as a Coming up line: once scheduled it is dated; while requested it waits on PMCM. */
export function ocularVisitLine(visit: PrismClientOcularVisit | null): { label: string; at: string | null } | null {
  if (visit?.status === "scheduled") return { label: "Venue visit", at: visit.scheduledAt };
  if (visit?.status === "requested") return { label: "Venue visit requested · PMCM will set the date", at: null };
  return null;
}

/** "Your event moved to Planning": said once, when the event has moved on since the client last opened it. */
export function stageReachedMessage(previous: string | null, current: PrismLifecycleStage): string | null {
  if (!previous) return null;
  const before = PRISM_LIFECYCLE_STAGES.indexOf(previous as PrismLifecycleStage);
  if (before < 0 || PRISM_LIFECYCLE_STAGES.indexOf(current) <= before) return null;
  return `Your event moved to ${PRISM_LIFECYCLE_STAGE_LABELS[current]}`;
}

/** What the event's live payment milestones add up to, and how much of that is paid; replaced milestones are left out. */
export function paymentTotals(payments: Pick<PrismPaymentMilestone, "amount" | "amountPaid" | "supersededAt">[]): { billed: number; paid: number } {
  const live = payments.filter((payment) => !payment.supersededAt);
  return {
    billed: live.reduce((sum, payment) => sum + payment.amount, 0),
    paid: live.reduce((sum, payment) => sum + Math.min(payment.amountPaid, payment.amount), 0),
  };
}

export type LayoutStep = { id: "ideas" | "official" | "approved"; label: string; done: boolean };

/** The floor plan's three moments for the client: their ideas, PMCM's official layout, and its approval. */
export function layoutSteps({ preferenceDraftCount, officialStatus }: { preferenceDraftCount: number; officialStatus?: string }): LayoutStep[] {
  return [
    { id: "ideas", label: "Your ideas", done: preferenceDraftCount > 0 || Boolean(officialStatus) },
    { id: "official", label: "PMCM layout", done: Boolean(officialStatus) },
    { id: "approved", label: "Approved", done: officialStatus === "approved" },
  ];
}
