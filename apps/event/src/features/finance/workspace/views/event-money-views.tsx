"use client";

import Link from "next/link";
import { AlertTriangle, BellRing, CalendarClock, CheckCircle2, ChevronRight, FileText, Hourglass, Send, ShieldAlert, WalletCards, type LucideIcon } from "lucide-react";
import type { PrismFinanceDeskEvent, PrismFinanceDeskItem, PrismPaymentMilestone, PrismPaymentReceipt } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { formatPortalDate } from "@prism/ui/format-date";
import { formatPeso, PaymentProgressBar, PaymentRing, PaymentTimeline, type PaymentStep } from "@prism/ui/payment-track";
import { cn } from "@/app/components/ui/utils";
import { financeHeadline, financeStep, type FinanceTone } from "@/features/finance/desk";
import { recordCheck, type RecordCheck } from "../model/event-money";

const TONE: Record<FinanceTone, { icon: LucideIcon; text: string; chip: string }> = {
  danger: { icon: AlertTriangle, text: "text-danger", chip: "bg-danger-soft text-danger" },
  attention: { icon: CalendarClock, text: "text-attention", chip: "bg-attention-soft text-attention" },
  info: { icon: Hourglass, text: "text-info", chip: "bg-info-soft text-info" },
  success: { icon: CheckCircle2, text: "text-success", chip: "bg-success-soft text-success" },
  neutral: { icon: WalletCards, text: "text-foreground", chip: "bg-muted text-muted-foreground" },
};

function Figure({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums text-foreground">{value}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

/** The top of an event's billing for PMCM: how much is in, the one thing to know, and the next things to do. */
export function EventMoneyHero({
  money,
  todayKey,
  busy,
  onRecord,
  onSend,
  pdf,
}: {
  money: PrismFinanceDeskEvent;
  todayKey: string;
  busy: boolean;
  onRecord?: () => void;
  onSend?: () => void;
  pdf?: { busy: boolean; download: () => void };
}) {
  const headline = financeHeadline(money, todayKey);
  const look = TONE[headline.tone];
  const Icon = look.icon;
  return (
    <Card className="gap-4 p-5">
      <div className="flex flex-wrap items-center gap-5">
        <PaymentRing paid={money.paid} total={money.billed} label={`${formatPeso(money.paid)} of ${formatPeso(money.billed)} received`} />
        <div className="min-w-0 flex-1 basis-64">
          <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium", look.chip)}>
            <Icon className="size-3.5" aria-hidden /> {money.statementNumber ? `Statement ${money.statementNumber}${money.statementSent ? "" : " · not sent"}` : "Billing"}
          </span>
          <h2 className={cn("mt-1.5 text-2xl font-semibold tabular-nums", look.text)}>{headline.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{headline.detail}</p>
        </div>
        <div className="grid grid-cols-3 gap-5">
          <Figure label="Billed" value={formatPeso(money.billed)} />
          <Figure label="Received" value={formatPeso(money.paid)} detail={money.checking > 0 ? `${formatPeso(money.checking)} to verify` : undefined} />
          <Figure label="Outstanding" value={formatPeso(money.balance)} detail={money.overdue > 0 ? `${formatPeso(money.overdue)} overdue` : undefined} />
        </div>
      </div>
      <HeroActions sent={money.statementSent} busy={busy} onRecord={onRecord} onSend={onSend} pdf={pdf} />
    </Card>
  );
}

function HeroActions({ sent, busy, onRecord, onSend, pdf }: { sent: boolean; busy: boolean; onRecord?: () => void; onSend?: () => void; pdf?: { busy: boolean; download: () => void } }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      {onRecord ? <Button size="sm" disabled={busy} onClick={onRecord}><WalletCards className="size-4" aria-hidden /> Record payment</Button> : null}
      {onSend ? (
        <Button size="sm" variant={sent ? "outline" : "default"} disabled={busy} onClick={onSend}>
          <Send className="size-4" aria-hidden /> {sent ? "Send again" : "Send to client"}
        </Button>
      ) : null}
      {pdf ? <Button size="sm" variant="outline" disabled={pdf.busy} onClick={pdf.download}><FileText className="size-4" aria-hidden /> {pdf.busy ? "Preparing…" : "Statement PDF"}</Button> : null}
    </div>
  );
}

const ITEM_TONE: Record<PrismFinanceDeskItem["severity"], string> = { critical: "bg-danger-soft text-danger", warning: "bg-attention-soft text-attention", info: "bg-muted text-muted-foreground" };

/** What this event is waiting on from PMCM, from the same queue as the finance desk. */
export function EventFinanceQueue({ items }: { items: PrismFinanceDeskItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">Needs you on this event <span className="font-normal tabular-nums text-muted-foreground">{items.length}</span></h2>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="relative flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40">
            <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-full", ITEM_TONE[item.severity])}><ShieldAlert className="size-3.5" /></span>
            <span className="min-w-0 flex-1">
              <Link href={item.href} className="block truncate text-sm font-semibold text-foreground outline-none after:absolute after:inset-0">{item.title}</Link>
              <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
            </span>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

const CHECK_LABEL: Record<RecordCheck["state"], { label: string; tone: string }> = {
  verified: { label: "Verified", tone: "text-success" },
  "to-verify": { label: "To verify", tone: "text-info" },
  "not-counted": { label: "Not counted", tone: "text-danger" },
  legacy: { label: "Recorded", tone: "text-muted-foreground" },
};

type PaymentRecordRow = PrismPaymentMilestone["history"][number];

function RecordLine({ record, check }: { record: PaymentRecordRow; check: RecordCheck }) {
  const look = CHECK_LABEL[check.state];
  const text = `${formatPeso(Math.abs(record.amountReceived))} ${record.reversesRecordId ? "reversed" : "received"} ${formatPortalDate(record.paymentDate)} · ${record.paymentMethod}${record.referenceNumber ? ` · ${record.referenceNumber}` : ""}`;
  return (
    <li className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      <span>{text}</span>
      <span className={cn("font-medium", look.tone)}>{look.label}</span>
      {check.receiptId ? <Link href={`/dashboard/finance/receipts?receipt=${encodeURIComponent(check.receiptId)}`} className="font-medium text-primary hover:text-primary/80">Open receipt</Link> : null}
    </li>
  );
}

function StepActions({ payment, busy, reminding, onRecord, onRemind, onToggleRisk }: { payment: PrismPaymentMilestone; busy: boolean; reminding: boolean; onRecord: () => void; onRemind?: () => void; onToggleRisk: () => void }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={busy} onClick={onRecord}><WalletCards className="size-3" aria-hidden /> Record payment</Button>
      {onRemind ? <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={busy || reminding} onClick={onRemind}><BellRing className="size-3" aria-hidden /> {reminding ? "Sending…" : "Remind client"}</Button> : null}
      <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" disabled={busy} onClick={onToggleRisk}>{payment.status === "at_risk" ? "Clear risk" : "Mark at risk"}</Button>
    </div>
  );
}

/**
 * The client's payments as a bar and a timeline, each with the money applied to it and whether that money has been
 * verified, and the actions for what is still open.
 */
export function EventPaymentSchedule({
  money,
  payments,
  receipts,
  todayKey,
  busy,
  onRecord,
  onToggleRisk,
  reminder,
}: {
  money: PrismFinanceDeskEvent;
  payments: PrismPaymentMilestone[];
  receipts: PrismPaymentReceipt[];
  todayKey: string;
  busy: boolean;
  onRecord: (payment: PrismPaymentMilestone) => void;
  onToggleRisk: (payment: PrismPaymentMilestone) => void;
  /** Reminding is offered once a payment is late or due within two weeks. */
  reminder?: { busyId: string | null; remind: (milestoneId: string, label: string) => void };
}) {
  const steps = money.milestones.map((milestone) => financeStep(milestone, todayKey));
  const byId = new Map(payments.map((payment) => [payment.id, payment]));
  const receiptById = new Map(receipts.map((receipt) => [receipt.id, receipt]));
  const detail = (step: PaymentStep) => {
    const payment = byId.get(step.id);
    if (!payment) return null;
    const open = step.state !== "paid" && step.state !== "checking";
    return (
      <>
        {payment.history.length ? <ul className="space-y-1">{payment.history.map((record) => <RecordLine key={record.id} record={record} check={recordCheck(record.receiptId, receiptById)} />)}</ul> : null}
        {open ? (
          <StepActions
            payment={payment}
            busy={busy}
            reminding={reminder?.busyId === payment.id}
            onRecord={() => onRecord(payment)}
            onRemind={reminder && (step.state === "overdue" || step.state === "due-soon") ? () => reminder.remind(payment.id, payment.label) : undefined}
            onToggleRisk={() => onToggleRisk(payment)}
          />
        ) : null}
      </>
    );
  };
  return (
    <Card role="region" aria-labelledby="finance-payment-schedule" className="gap-4 p-5">
      <header className="flex items-baseline justify-between gap-2">
        <h2 id="finance-payment-schedule" className="text-base font-semibold text-foreground">Client payments</h2>
        <span className="text-xs text-muted-foreground">{steps.length} payments</span>
      </header>
      <PaymentProgressBar steps={steps} />
      <PaymentTimeline steps={steps} detail={detail} label="Client payments" />
    </Card>
  );
}
