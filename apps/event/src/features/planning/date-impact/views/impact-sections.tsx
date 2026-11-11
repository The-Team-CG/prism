"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { PrismDateChangeImpact } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { formatPortalDate } from "@prism/ui/format-date";
import { eventWorkspaceHref } from "@/features/event-dashboard/shell/model/event-dashboard-routing";
import { money } from "@/features/pmcm-kit";
import { PAYMENT_STATE_LABELS, canSyncPlan, movingTasks } from "../model/impact-rules";
import type { DateImpactViewModel } from "../view-models/use-date-impact-view-model";

export function Section({ title, note, link, children }: { title: string; note: string; link?: { href: string; label: string }; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {link ? <Link href={link.href} className="text-xs font-semibold text-primary">{link.label}</Link> : null}
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
      {children}
    </section>
  );
}

export function PlanSection({ impact, vm }: { impact: PrismDateChangeImpact; vm: DateImpactViewModel }) {
  const tasks = movingTasks(impact);
  return (
    <Section
      title="Plan"
      note={
        impact.planApplicable
          ? "Open tasks follow the event date. Tasks that are done, skipped or edited by your team stay exactly where they are."
          : "Open tasks would move with the event. Record the new date on the event first; then the plan can follow it from here."
      }
    >
      {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No open task needs to move.</p> : (
        <ul className="grid gap-1 text-sm">
          {tasks.map((task) => <li key={task.id}>{task.title} · {formatPortalDate(task.from)} → {formatPortalDate(task.to)}<span className="text-xs text-muted-foreground"> · {task.templateName}</span></li>)}
        </ul>
      )}
      {impact.plan.kept > 0 ? <p className="text-xs text-muted-foreground">{impact.plan.kept} {impact.plan.kept === 1 ? "task stays" : "tasks stay"} where {impact.plan.kept === 1 ? "it is" : "they are"} (done, skipped or edited).</p> : null}
      {canSyncPlan(impact) ? (
        <Button className="rounded-lg font-semibold" disabled={vm.busy} onClick={() => void vm.syncPlan()}>
          {vm.busy ? "Moving…" : `Move ${impact.plan.movable} ${impact.plan.movable === 1 ? "task" : "tasks"} with the event`}
        </Button>
      ) : null}
    </Section>
  );
}

export function SuppliersSection({ impact }: { impact: PrismDateChangeImpact }) {
  return (
    <Section
      title="Suppliers"
      note="Bookings stay as they are. Each selected supplier should reconfirm the new date once it is recorded."
      link={{ href: eventWorkspaceHref(impact.eventId, "suppliers"), label: "Open Suppliers" }}
    >
      {impact.suppliers.length === 0 ? <p className="text-sm text-muted-foreground">No supplier is booked for this event yet.</p> : (
        <ul className="divide-y divide-border text-sm">
          {impact.suppliers.map((supplier) => (
            <li key={supplier.requestId} className="py-2">
              {supplier.supplierName} · {supplier.category}
              <span className="text-xs text-muted-foreground"> · {supplier.assignmentStatus.replaceAll("_", " ")}</span>
              {supplier.conflicts.map((conflict) => <span key={conflict} className="block text-xs font-semibold text-foreground">{conflict}</span>)}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function PaymentsSection({ impact }: { impact: PrismDateChangeImpact }) {
  return (
    <Section
      title="Payments"
      note="Money received is never changed. A balance still owed can be given a new due date in Billing, and the client sees that as a correction."
      link={{ href: eventWorkspaceHref(impact.eventId, "billing"), label: "Open Billing" }}
    >
      {impact.payments.length === 0 ? <p className="text-sm text-muted-foreground">No payment milestones yet.</p> : (
        <ul className="divide-y divide-border text-sm">
          {impact.payments.map((payment) => (
            <li key={payment.milestoneId} className="py-2">
              {payment.label} · {money.format(payment.amount)} · {PAYMENT_STATE_LABELS[payment.state]}
              {payment.amountPaid > 0 ? <span className="text-xs text-muted-foreground"> · {money.format(payment.amountPaid)} received</span> : null}
              <span className="block text-xs text-muted-foreground">
                Due {formatPortalDate(payment.dueDate)}
                {payment.suggestedDueDate ? ` · the same shift would make it ${formatPortalDate(payment.suggestedDueDate)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function ApprovedSection({ impact }: { impact: PrismDateChangeImpact }) {
  return (
    <Section title="Already approved by the client" note="None of this is changed. Decide whether the client must reconfirm it for the new date.">
      {impact.approvedWork.length === 0 ? <p className="text-sm text-muted-foreground">The client has not signed or approved anything for this event yet.</p> : (
        <ul className="divide-y divide-border text-sm">
          {impact.approvedWork.map((entry) => <li key={entry.kind} className="py-2">{entry.label}<span className="block text-xs text-muted-foreground">{entry.detail}</span></li>)}
        </ul>
      )}
    </Section>
  );
}
