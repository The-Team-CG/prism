import type { PrismDateChangeImpact, PrismDateChangePaymentState, PrismPlanPreview } from "@prism/types";
import { formatPortalDate } from "@prism/ui/format-date";

export const PAYMENT_STATE_LABELS: Record<PrismDateChangePaymentState, string> = {
  paid: "Paid in full",
  partial: "Part paid",
  open: "Not paid yet",
};

/** The templates whose plan has something to write: a task to move, or one to add. The rest already follow the date. */
export function syncableTemplates(impact: PrismDateChangeImpact): PrismPlanPreview[] {
  return impact.plan.templates.filter((template) => template.update.length > 0 || template.add.length > 0);
}

/** The plan can follow the date only once the event has it, and only when there is something to move. */
export function canSyncPlan(impact: PrismDateChangeImpact): boolean {
  return impact.planApplicable && syncableTemplates(impact).length > 0;
}

export interface MovingTask {
  id: string;
  title: string;
  templateName: string;
  from: string;
  to: string;
}

/** The open tasks that would move, with the date each moves from and to. */
export function movingTasks(impact: PrismDateChangeImpact): MovingTask[] {
  return impact.plan.templates.flatMap((template) =>
    template.update.flatMap((entry) => {
      const due = entry.changes.find((change) => change.field === "dueDate");
      return due ? [{ id: entry.id, title: entry.title, templateName: template.templateName, from: due.from, to: due.to }] : [];
    }),
  );
}

/** How far the date moves, in words. */
export function shiftLabel(shiftDays: number | null): string {
  if (shiftDays === null) return "";
  if (shiftDays === 0) return "the same day";
  const days = Math.abs(shiftDays);
  return `${days} ${days === 1 ? "day" : "days"} ${shiftDays > 0 ? "later" : "earlier"}`;
}

/** The one line that says what is being looked at. */
export function impactHeadline(impact: PrismDateChangeImpact): string {
  if (impact.newDate === null) return `The date the event has now: ${formatPortalDate(impact.currentDate)}.`;
  return `${formatPortalDate(impact.currentDate)} → ${formatPortalDate(impact.newDate)}, ${shiftLabel(impact.shiftDays)}.`;
}

/** Bookings with a known reason they may not serve the new date. */
export function conflictedSuppliers(impact: PrismDateChangeImpact) {
  return impact.suppliers.filter((supplier) => supplier.conflicts.length > 0);
}

/** Money still owed on a milestone that could be given a new due date. Money already received is never part of it. */
export function owedPayments(impact: PrismDateChangeImpact) {
  return impact.payments.filter((payment) => payment.state !== "paid");
}
