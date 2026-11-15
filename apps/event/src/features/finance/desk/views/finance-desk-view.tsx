"use client";

import Link from "next/link";
import {
  AlertTriangle, ArrowDownToLine, BadgeCheck, ChevronRight, FilePen, Hourglass, Inbox, Scale, Send, Truck, WalletCards, type LucideIcon,
} from "lucide-react";
import { useResource } from "@prism/portal-query";
import type { PrismFinanceDesk, PrismFinanceDeskEvent, PrismFinanceDeskItem, PrismFinanceDeskItemKind, PrismFinanceDeskPayout } from "@prism/types";
import { Card } from "@prism/ui/components/card";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { PrismEmptyLine, PrismSection } from "@prism/ui/page-blocks";
import { formatPeso, PaymentProgressBar } from "@prism/ui/payment-track";
import { cn } from "@/app/components/ui/utils";
import { financeDesk } from "../data/finance-desk-resource";
import { financeHeadline, financeStep, payoutState, type FinanceTone, type PayoutState } from "../model/finance-desk-rules";

const KIND_LOOK: Record<PrismFinanceDeskItemKind, { icon: LucideIcon; tone: string }> = {
  client_overdue: { icon: AlertTriangle, tone: "bg-danger-soft text-danger" },
  supplier_overdue: { icon: Truck, tone: "bg-danger-soft text-danger" },
  verify_payment: { icon: Hourglass, tone: "bg-info-soft text-info" },
  apply_money: { icon: ArrowDownToLine, tone: "bg-info-soft text-info" },
  dispute: { icon: Scale, tone: "bg-attention-soft text-attention" },
  correction: { icon: FilePen, tone: "bg-attention-soft text-attention" },
  supplier_due_soon: { icon: Truck, tone: "bg-attention-soft text-attention" },
  approve_source: { icon: BadgeCheck, tone: "bg-muted text-muted-foreground" },
  send_statement: { icon: Send, tone: "bg-muted text-muted-foreground" },
};

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
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Tile icon={AlertTriangle} label="Clients overdue" value={formatPeso(totals.clientOverdue)} detail={`${formatPeso(totals.clientDueSoon)} more due in two weeks`} tone={totals.clientOverdue ? "bg-danger-soft text-danger" : quiet} />
      <Tile icon={Hourglass} label="To verify" value={formatPeso(totals.toVerify)} detail={totals.toVerifyCount === 1 ? "1 payment" : `${totals.toVerifyCount} payments`} tone={totals.toVerifyCount ? "bg-info-soft text-info" : quiet} />
      <Tile icon={ArrowDownToLine} label="Not yet applied" value={formatPeso(totals.unapplied)} detail="Received, not on a payment" tone={totals.unapplied ? "bg-info-soft text-info" : quiet} />
      <Tile icon={Truck} label="Owed to suppliers" value={formatPeso(owedToSuppliers)} detail={totals.supplierOverdue ? `${formatPeso(totals.supplierOverdue)} late` : "Due within a week"} tone={totals.supplierOverdue ? "bg-danger-soft text-danger" : owedToSuppliers ? "bg-attention-soft text-attention" : quiet} />
      <Tile icon={Scale} label="Disputes and corrections" value={String(reviews)} detail={`${totals.openDisputes} disputes · ${totals.pendingCorrections} corrections`} tone={reviews ? "bg-attention-soft text-attention" : quiet} />
    </div>
  );
}

function QueueRow({ item }: { item: PrismFinanceDeskItem }) {
  const look = KIND_LOOK[item.kind];
  const Icon = look.icon;
  return (
    <li className="relative grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 hover:bg-muted/40">
      <span aria-hidden className={cn("grid size-9 place-items-center rounded-full", look.tone)}><Icon className="size-4" /></span>
      <span className="min-w-0">
        <Link href={item.href} className="block truncate text-sm font-semibold text-foreground outline-none after:absolute after:inset-0">{item.title}</Link>
        <span className="block truncate text-xs text-muted-foreground">{item.eventName ? `${item.eventName} · ` : ""}{item.detail}</span>
      </span>
      <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
    </li>
  );
}

function Queue({ items }: { items: PrismFinanceDeskItem[] }) {
  return (
    <PrismSection id="finance-queue" title="Needs you" count={items.length} flush>
      {items.length === 0 ? (
        <div className="px-5 py-4"><PrismEmptyLine icon={Inbox}>Nothing waiting. Payments, receipts, disputes and supplier payouts that need you appear here.</PrismEmptyLine></div>
      ) : (
        <ul className="divide-y divide-border">{items.map((item) => <QueueRow key={item.id} item={item} />)}</ul>
      )}
    </PrismSection>
  );
}

function EventCard({ event, todayKey }: { event: PrismFinanceDeskEvent; todayKey: string }) {
  const headline = financeHeadline(event, todayKey);
  return (
    <Link href={`/dashboard/events/${event.eventId}/billing`} className="group block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{event.eventName}</p>
          <p className="truncate text-xs text-muted-foreground">{[event.clientName, event.eventDate ? formatPortalDate(event.eventDate) : null, event.statementNumber].filter(Boolean).join(" · ")}</p>
        </div>
        <p className="shrink-0 text-right text-xs tabular-nums text-muted-foreground"><span className="block text-sm font-semibold text-foreground">{formatPeso(event.paid)}</span>of {formatPeso(event.billed)}</p>
      </div>
      <p className={cn("mt-2 text-sm font-medium tabular-nums", TONE_TEXT[headline.tone])}>{headline.title}</p>
      <PaymentProgressBar steps={event.milestones.map((milestone) => financeStep(milestone, todayKey))} className="mt-2" />
    </Link>
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

/**
 * Finance across every event, without choosing one first: totals that need attention, the work waiting on PMCM in
 * order of urgency, each event's payments as a bar, and what PMCM owes suppliers.
 */
export function FinanceDeskView() {
  const desk = useResource(financeDesk, "signed-in");
  if (desk.status === "error" && !desk.data) return <p role="alert" className="text-sm text-destructive">{desk.error.message}</p>;
  if (!desk.data) return <p className="text-sm text-muted-foreground">Loading finance…</p>;
  const todayKey = manilaDateKey();
  const { totals, queue, events, payouts } = desk.data;
  return (
    <div className="space-y-6">
      <Tiles totals={totals} />
      <Queue items={queue} />
      <PrismSection id="finance-events" title="Events" count={events.length} description="Each event's client payments, most overdue first." bare>
        {events.length === 0 ? (
          <PrismEmptyLine icon={WalletCards}>No billing statements yet. Approve a billing source on an event to issue one.</PrismEmptyLine>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">{events.map((event) => <EventCard key={event.eventId} event={event} todayKey={todayKey} />)}</div>
        )}
      </PrismSection>
      <Payouts payouts={payouts} todayKey={todayKey} />
    </div>
  );
}

