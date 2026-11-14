"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, Hourglass, MessageSquareText, Scale, Send, type LucideIcon } from "lucide-react";
import type { PrismStatementOfAccount } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { formatPeso, PaymentRing } from "@prism/ui/payment-track";
import { cn } from "@/app/components/ui/utils";
import type { MoneyHeadline, MoneyTone } from "../model/client-money-rules";
import { HowToPay } from "./how-to-pay";

const TONE: Record<MoneyTone, { icon: LucideIcon; text: string; chip: string }> = {
  danger: { icon: AlertTriangle, text: "text-danger", chip: "bg-danger-soft text-danger" },
  attention: { icon: CalendarClock, text: "text-attention", chip: "bg-attention-soft text-attention" },
  info: { icon: Hourglass, text: "text-info", chip: "bg-info-soft text-info" },
  success: { icon: CheckCircle2, text: "text-success", chip: "bg-success-soft text-success" },
  neutral: { icon: Scale, text: "text-foreground", chip: "bg-muted text-muted-foreground" },
};

function Figure({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-base font-semibold tabular-nums", muted ? "text-muted-foreground" : "text-foreground")}>{value}</p>
    </div>
  );
}

/**
 * The top of an event's billing: how much is paid (the ring), the one thing to know now (overdue, next due, or paid in
 * full), and what the client can do about it: pay, say they paid, or download the statement.
 */
export function MoneyHero({
  statement,
  headline,
  messagesHref,
  onReportPayment,
  statementPdf,
}: {
  statement: PrismStatementOfAccount;
  headline: MoneyHeadline;
  messagesHref: string;
  onReportPayment: (milestoneId?: string) => void;
  statementPdf?: { busy: boolean; download: () => void };
}) {
  const look = TONE[headline.tone];
  const Icon = look.icon;
  const paid = statement.milestones.reduce((sum, milestone) => sum + milestone.paid, 0);
  const owing = statement.balance > 0;
  return (
    <Card className="gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <PaymentRing paid={paid} total={statement.billed} label={`${formatPeso(paid)} of ${formatPeso(statement.billed)} paid`} />
        <div className="min-w-0 flex-1 basis-64">
          <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium", look.chip)}>
            <Icon className="size-3.5" aria-hidden /> {statement.statementNumber ? `Statement ${statement.statementNumber}` : "Billing"}
          </span>
          <h2 className={cn("mt-1.5 text-xl font-semibold tabular-nums sm:text-2xl", look.text)}>{headline.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{headline.detail}</p>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:gap-6">
          <Figure label="Paid" value={formatPeso(paid)} muted={paid === 0} />
          <Figure label="Left to pay" value={formatPeso(statement.balance)} muted={!owing} />
          <Figure label="Total" value={formatPeso(statement.billed)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {owing ? (
          <>
            <Button size="sm" onClick={() => onReportPayment(headline.milestoneId ?? undefined)}><Send className="size-4" aria-hidden /> I&apos;ve paid</Button>
            <HowToPay methods={statement.paymentMethods} statementNumber={statement.statementNumber} />
          </>
        ) : null}
        {statementPdf ? (
          <Button size="sm" variant="outline" disabled={statementPdf.busy} onClick={statementPdf.download}>
            <FileText className="size-4" aria-hidden /> {statementPdf.busy ? "Preparing…" : "Billing statement"}
          </Button>
        ) : null}
        <Button asChild size="sm" variant="ghost"><Link href={messagesHref}><MessageSquareText className="size-4" aria-hidden /> Ask PMCM</Link></Button>
      </div>
    </Card>
  );
}
