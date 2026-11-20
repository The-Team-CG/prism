"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ChevronDown, Download, Hourglass, Scale, Truck, WalletCards, type LucideIcon } from "lucide-react";
import { useResource } from "@prism/portal-query";
import type { PrismFinanceDesk, PrismFinanceDeskEvent, PrismFinanceDeskPayout } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { PrismEmptyLine, PrismSection } from "@prism/ui/page-blocks";
import { formatPeso, PaymentProgressBar } from "@prism/ui/payment-track";
import { cn } from "@/app/components/ui/utils";
import { financeDesk } from "../data/finance-desk-resource";
import { agingBuckets, cashOutlook } from "../model/finance-desk-analysis";
import { financeHeadline, financeStep, payoutState, type FinanceTone, type PayoutState } from "../model/finance-desk-rules";
import { useFinanceDeskViewModel } from "../view-models/use-finance-desk-view-model";
import { AgingChart, CashOutlookChart } from "./finance-charts";
import { FinanceQueue } from "./finance-queue";

const TONE_TEXT: Record<FinanceTone, string> = { danger: "text-danger", attention: "text-attention", info: "text-info", success: "text-success", neutral: "text-foreground" };

function Tile({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: string }) {
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-full", tone)}><Icon className="size-5" /></span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </Card>
  );
}

const quiet = "bg-muted text-muted-foreground";

function Tiles({ totals }: { totals: PrismFinanceDesk["totals"] }) {
  const owedToSuppliers = totals.supplierOverdue + totals.supplierDueSoon;
  const reviews = totals.openDisputes + totals.pendingCorrections;
  // Money received but not yet on a payment is checked the same way as a reported payment, so it shares the tile.
  const toCheck = totals.toVerify + totals.unapplied;
  const toCheckDetail = [totals.toVerifyCount === 1 ? "1 payment" : `${totals.toVerifyCount} payments`, totals.unapplied ? `${formatPeso(totals.unapplied)} not yet applied` : null].filter(Boolean).join(" · ");
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile icon={AlertTriangle} label="Clients overdue" value={formatPeso(totals.clientOverdue)} detail={`${formatPeso(totals.clientDueSoon)} more due in two weeks`} tone={totals.clientOverdue ? "bg-danger-soft text-danger" : quiet} />
      <Tile icon={Hourglass} label="To verify" value={formatPeso(toCheck)} detail={toCheckDetail} tone={toCheck ? "bg-info-soft text-info" : quiet} />
      <Tile icon={Truck} label="Owed to suppliers" value={formatPeso(owedToSuppliers)} detail={totals.supplierOverdue ? `${formatPeso(totals.supplierOverdue)} late` : "Due within a week"} tone={totals.supplierOverdue ? "bg-danger-soft text-danger" : owedToSuppliers ? "bg-attention-soft text-attention" : quiet} />
      <Tile icon={Scale} label="Disputes and corrections" value={String(reviews)} detail={`${totals.openDisputes} disputes · ${totals.pendingCorrections} corrections`} tone={reviews ? "bg-attention-soft text-attention" : quiet} />
    </div>
  );
}

const BALANCE_GRID = "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 px-5 py-3 md:grid-cols-[minmax(0,1.6fr)_7.5rem_minmax(0,1fr)_7.5rem_minmax(0,1.1fr)] md:items-center";

/** One event's client money as a row: billed, how far paid, what is still owed, and what happens next. */
function BalanceRow({ event, todayKey }: { event: PrismFinanceDeskEvent; todayKey: string }) {
  const headline = financeHeadline(event, todayKey);
  const outstanding = Math.max(0, event.billed - event.paid);
  return (
    <li className={cn("relative transition-colors hover:bg-surface-raised has-[a:focus-visible]:bg-surface-raised", BALANCE_GRID)}>
      <span className="min-w-0">
        <Link href={`/dashboard/events/${event.eventId}/billing`} className="block truncate text-sm font-semibold text-foreground outline-none after:absolute after:inset-0">{event.eventName}</Link>
        <span className="block truncate text-xs text-muted-foreground">{[event.clientName, event.eventDate ? formatPortalDate(event.eventDate) : null, event.statementNumber].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="text-right text-sm tabular-nums text-muted-foreground md:order-none"><span className="md:hidden">Billed </span>{formatPeso(event.billed)}</span>
      <PaymentProgressBar steps={event.milestones.map((milestone) => financeStep(milestone, todayKey))} className="col-span-2 md:col-span-1" />
      <span className="text-sm font-semibold tabular-nums text-foreground md:text-right"><span className="font-normal text-muted-foreground md:hidden">Outstanding </span>{formatPeso(outstanding)}</span>
      <span className={cn("text-right text-sm font-medium tabular-nums md:text-left", TONE_TEXT[headline.tone])}>{headline.title}</span>
    </li>
  );
}

/** Rows shown before "Show all": the most overdue, which is what the page is for. */
const BALANCES_SHOWN = 8;

function ClientBalances({ events, todayKey, onExport }: { events: PrismFinanceDeskEvent[]; todayKey: string; onExport: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? events : events.slice(0, BALANCES_SHOWN);
  return (
    <PrismSection
      id="finance-events" title="Client balances" count={events.length} description="Each event's client payments, most overdue first." flush
      action={events.length ? <Button type="button" variant="outline" size="sm" onClick={onExport}><Download aria-hidden className="size-4" />Download spreadsheet</Button> : null}
    >
      {events.length === 0 ? (
        <div className="px-5 py-4"><PrismEmptyLine icon={WalletCards}>No billing statements yet. Approve a billing source on an event to issue one.</PrismEmptyLine></div>
      ) : (
        <>
          <div aria-hidden className={cn(BALANCE_GRID, "hidden border-b border-border py-2 text-xs text-muted-foreground md:grid")}>
            <span>Event</span><span className="text-right">Billed</span><span>Paid</span><span className="text-right">Outstanding</span><span>Next</span>
          </div>
          <ul className="divide-y divide-border">{shown.map((event) => <BalanceRow key={event.eventId} event={event} todayKey={todayKey} />)}</ul>
          {events.length > shown.length ? (
            <button type="button" onClick={() => setShowAll(true)} className="flex min-h-11 w-full items-center gap-1 border-t border-border px-5 text-sm font-medium text-primary hover:bg-surface-raised">
              Show all {events.length}<ChevronDown aria-hidden className="size-4" />
            </button>
          ) : null}
        </>
      )}
    </PrismSection>
  );
}

const PAYOUT_LOOK: Record<PayoutState, { label: string; tone: string }> = {
  paid: { label: "Paid out", tone: "bg-success-soft text-success" },
  overdue: { label: "Late", tone: "bg-danger-soft text-danger" },
  "due-soon": { label: "Due soon", tone: "bg-attention-soft text-attention" },
  partly: { label: "Part paid", tone: "bg-primary-soft text-primary" },
  upcoming: { label: "Scheduled", tone: "bg-muted text-muted-foreground" },
};

function PayoutRow({ payout, todayKey }: { payout: PrismFinanceDeskPayout; todayKey: string }) {
  const state = payoutState(payout, todayKey);
  const share = payout.amount > 0 ? Math.min(100, (payout.released / payout.amount) * 100) : 0;
  return (
    <li className="relative grid gap-2 px-5 py-3 hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center sm:gap-4">
      <span className="min-w-0">
        <Link href={`/dashboard/events/${payout.eventId}/suppliers`} className="block truncate text-sm font-semibold text-foreground outline-none after:absolute after:inset-0">{payout.supplierName} · {payout.label}</Link>
        <span className="block truncate text-xs text-muted-foreground">{payout.eventName}{payout.dueDate ? ` · due ${formatPortalDate(payout.dueDate)}` : ""}</span>
      </span>
      <span className="block">
        <span className="block h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-success" style={{ width: `${share}%` }} /></span>
        <span className="mt-1 block text-xs tabular-nums text-muted-foreground">{formatPeso(payout.released)} of {formatPeso(payout.amount)}</span>
      </span>
      <span className={cn("w-fit rounded-md px-2 py-0.5 text-xs font-medium", PAYOUT_LOOK[state].tone)}>{PAYOUT_LOOK[state].label}</span>
    </li>
  );
}

function Payouts({ payouts, todayKey }: { payouts: PrismFinanceDeskPayout[]; todayKey: string }) {
  const open = payouts.filter((payout) => payout.released < payout.amount);
  return (
    <PrismSection id="finance-payouts" title="Supplier payouts" count={open.length} description="What PMCM owes suppliers, soonest first." flush>
      {payouts.length === 0 ? (
        <div className="px-5 py-4"><PrismEmptyLine icon={Truck}>No supplier payment schedules yet.</PrismEmptyLine></div>
      ) : (
        <ul className="divide-y divide-border">{payouts.map((payout) => <PayoutRow key={payout.id} payout={payout} todayKey={todayKey} />)}</ul>
      )}
    </PrismSection>
  );
}

function FinanceDesk({ desk, todayKey }: { desk: PrismFinanceDesk; todayKey: string }) {
  const vm = useFinanceDeskViewModel(desk, todayKey);
  const { totals, queue, events, payouts } = desk;
  return (
    <div className="space-y-6">
      <Tiles totals={totals} />
      <FinanceQueue total={queue.length} vm={vm} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <AgingChart buckets={agingBuckets(events, todayKey)} />
        <CashOutlookChart weeks={cashOutlook(events, payouts, todayKey)} />
      </div>
      <ClientBalances events={events} todayKey={todayKey} onExport={vm.exportCsv} />
      <Payouts payouts={payouts} todayKey={todayKey} />
    </div>
  );
}

/**
 * Finance across every event, without choosing one first: totals that need attention, the work waiting on PMCM in
 * order of urgency with quick jobs done in place, what clients owe by lateness, the coming weeks of money in and out,
 * each event's payments as a bar, and what PMCM owes suppliers.
 */
export function FinanceDeskView() {
  const desk = useResource(financeDesk, "signed-in");
  if (desk.status === "error" && !desk.data) return <p role="alert" className="text-sm text-destructive">{desk.error.message}</p>;
  if (!desk.data) return <p className="text-sm text-muted-foreground">Loading finance…</p>;
  return <FinanceDesk desk={desk.data} todayKey={manilaDateKey()} />;
}
