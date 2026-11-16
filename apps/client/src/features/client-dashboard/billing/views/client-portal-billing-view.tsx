"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, WalletCards } from "lucide-react";
import { useResource } from "@prism/portal-query";
import type { PrismStatementOfAccount } from "@prism/types";
import { Card } from "@prism/ui/components/card";
import { manilaDateKey } from "@prism/ui/format-date";
import { formatPeso, MoneyTile, MoneyTiles, PaymentEventCard, PaymentTimeline } from "@prism/ui/payment-track";
import { dashboardHref, useClientWorkspace } from "../../workspace/shared";
import { ClientListEmpty } from "../../shared/client-list-ui";
import { clientStatementsOfAccount, statementsKey } from "../data/statement-of-account-resource";
import { accountGroups, accountTotals, milestoneStep, moneyHeadline, type AccountGroup, type MoneyTone } from "../model/client-money-rules";

const TONE_TEXT: Record<MoneyTone, string> = { danger: "text-danger", attention: "text-attention", info: "text-info", success: "text-success", neutral: "text-foreground" };

function Tiles({ groups, statements }: { groups: AccountGroup[]; statements: PrismStatementOfAccount[] }) {
  const group = (id: AccountGroup["id"]) => groups.find((item) => item.id === id)!;
  const totals = accountTotals(statements);
  const overdue = group("overdue");
  const soon = group("due-soon");
  const count = (n: number) => (n === 1 ? "1 payment" : `${n} payments`);
  return (
    <MoneyTiles count={4}>
      <MoneyTile icon={AlertTriangle} label="Overdue" value={formatPeso(overdue.total)} detail={overdue.payments.length ? count(overdue.payments.length) : "Nothing overdue"} tone={overdue.total > 0 ? "bg-danger-soft text-danger" : "bg-muted text-muted-foreground"} />
      <MoneyTile icon={CalendarClock} label="Due in two weeks" value={formatPeso(soon.total)} detail={soon.payments.length ? count(soon.payments.length) : "Nothing due soon"} tone={soon.total > 0 ? "bg-attention-soft text-attention" : "bg-muted text-muted-foreground"} />
      <MoneyTile icon={CheckCircle2} label="Paid so far" value={formatPeso(totals.paid)} detail={`of ${formatPeso(totals.billed)} billed`} tone="bg-success-soft text-success" />
      <MoneyTile icon={WalletCards} label="Left to pay" value={formatPeso(totals.balance)} detail={`across ${statements.filter((statement) => statement.available).length} events`} tone="bg-primary-soft text-primary" />
    </MoneyTiles>
  );
}

function EventCard({ statement, todayKey }: { statement: PrismStatementOfAccount; todayKey: string }) {
  const headline = moneyHeadline(statement, todayKey);
  if (!headline) return null;
  const steps = statement.milestones.map((milestone) => milestoneStep(milestone, todayKey));
  return (
    <PaymentEventCard
      title={statement.eventName}
      detail={headline.title}
      detailTone={`font-medium tabular-nums ${TONE_TEXT[headline.tone]}`}
      paid={steps.reduce((sum, step) => sum + step.paid, 0)}
      total={steps.reduce((sum, step) => sum + step.amount, 0)}
      steps={steps}
      href={dashboardHref("billing", statement.eventId)}
      link={Link}
    />
  );
}

function GroupTimeline({ group }: { group: AccountGroup }) {
  if (group.payments.length === 0) return null;
  const byStep = new Map(group.payments.map((payment) => [payment.step.id, payment]));
  return (
    <section aria-labelledby={`billing-group-${group.id}`} className="space-y-3">
      <h3 id={`billing-group-${group.id}`} className="flex items-baseline justify-between text-sm font-semibold text-foreground">
        {group.title}
        <span className="text-xs font-normal tabular-nums text-muted-foreground">{formatPeso(group.total)}</span>
      </h3>
      <PaymentTimeline
        label={group.title}
        steps={group.payments.map((payment) => payment.step)}
        heading={(step) => {
          const payment = byStep.get(step.id);
          return payment ? <Link className="hover:text-primary" href={dashboardHref("billing", payment.eventId)}>{payment.eventName}</Link> : null;
        }}
      />
    </section>
  );
}

/**
 * Billing across every event on one page: what is overdue and due soon at the top, each event's progress, then every
 * payment on a timeline grouped by when it needs the client. Paid payments fold away at the bottom.
 */
export function ClientPortalBillingView() {
  const { events } = useClientWorkspace();
  const key = statementsKey(events.map((event) => event.id));
  const result = useResource(clientStatementsOfAccount, key || null);
  const statements = (result.data ?? []).filter((statement) => statement.available);
  const todayKey = manilaDateKey();

  if (events.length === 0 || (result.status !== "pending" && statements.length === 0)) {
    return <ClientListEmpty icon={WalletCards} title="No billing yet" description="Billing appears here once PMCM sends the billing statement for one of your events." />;
  }
  if (!result.data) return <p className="text-sm text-muted-foreground">Loading your billing…</p>;

  const groups = accountGroups(statements, todayKey);
  const paid = groups.find((group) => group.id === "paid")!;
  return (
    <div className="space-y-5">
      <Tiles groups={groups} statements={statements} />
      <div className="grid gap-3 md:grid-cols-2">
        {statements.map((statement) => <EventCard key={statement.eventId} statement={statement} todayKey={todayKey} />)}
      </div>
      <Card className="gap-6 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Every payment</h2>
        {groups.filter((group) => group.id !== "paid").map((group) => <GroupTimeline key={group.id} group={group} />)}
        {paid.payments.length > 0 ? (
          <details className="border-t border-border pt-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">Paid <span className="font-normal tabular-nums text-muted-foreground">{paid.payments.length} · {formatPeso(paid.total)}</span></summary>
            <div className="mt-4"><GroupTimeline group={{ ...paid, title: "Paid payments" }} /></div>
          </details>
        ) : null}
      </Card>
    </div>
  );
}
