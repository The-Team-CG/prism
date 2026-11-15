"use client";

import Link from "next/link";
import {
  ArrowDownToLine, BadgeCheck, BellRing, CalendarPlus, CheckCircle2, CircleX, FilePen, MessageSquareWarning, Scale, Send, Undo2, type LucideIcon,
} from "lucide-react";
import { useResource } from "@prism/portal-query";
import type { PrismPaymentHistoryEntry, PrismPaymentHistoryKind } from "@prism/types";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import { formatPeso } from "@prism/ui/payment-track";
import { cn } from "@/app/components/ui/utils";
import { paymentHistory } from "../data/finance-repository";

const LOOK: Record<PrismPaymentHistoryKind, { icon: LucideIcon; tone: string }> = {
  scheduled: { icon: CalendarPlus, tone: "bg-muted text-muted-foreground" },
  reminded: { icon: BellRing, tone: "bg-attention-soft text-attention" },
  reported: { icon: Send, tone: "bg-info-soft text-info" },
  recorded: { icon: FilePen, tone: "bg-info-soft text-info" },
  verified: { icon: BadgeCheck, tone: "bg-success-soft text-success" },
  not_accepted: { icon: CircleX, tone: "bg-danger-soft text-danger" },
  applied: { icon: ArrowDownToLine, tone: "bg-success-soft text-success" },
  undone: { icon: Undo2, tone: "bg-danger-soft text-danger" },
  disputed: { icon: MessageSquareWarning, tone: "bg-attention-soft text-attention" },
  dispute_closed: { icon: Scale, tone: "bg-muted text-muted-foreground" },
  paid_in_full: { icon: CheckCircle2, tone: "bg-success text-white" },
};

function Entry({ entry, last }: { entry: PrismPaymentHistoryEntry; last: boolean }) {
  const look = LOOK[entry.kind];
  const Icon = look.icon;
  return (
    <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-5">
      {last ? null : <span aria-hidden className="absolute bottom-0 left-4 top-8 w-px -translate-x-1/2 bg-border" />}
      <span aria-hidden className={cn("relative grid size-8 place-items-center rounded-full", look.tone)}><Icon className="size-4" /></span>
      <div className="min-w-0 pt-1">
        <p className="text-sm font-medium text-foreground">{entry.title}</p>
        {entry.detail ? <p className="mt-0.5 break-words text-sm text-muted-foreground">{entry.detail}</p> : null}
        <p className="mt-1 text-xs text-muted-foreground">
          {formatPortalDateTime(entry.at)}{entry.by ? ` · ${entry.by}` : ""}
          {entry.receiptId ? <> · <Link href={`/dashboard/finance/receipts?receipt=${encodeURIComponent(entry.receiptId)}`} className="font-medium text-primary hover:text-primary/80">Open receipt</Link></> : null}
        </p>
      </div>
    </li>
  );
}

function Body({ eventId, milestoneId }: { eventId: string; milestoneId: string }) {
  const history = useResource(paymentHistory, { eventId, milestoneId });
  if (history.status === "error" && !history.data) return <p role="alert" className="px-4 text-sm text-destructive">{history.error.message}</p>;
  if (!history.data) return <p className="px-4 text-sm text-muted-foreground">Loading history…</p>;
  const { entries, amount, paid, remaining, dueDate } = history.data;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
      <dl className="mb-5 grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">Amount</dt><dd className="font-semibold tabular-nums">{formatPeso(amount)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Paid</dt><dd className="font-semibold tabular-nums">{formatPeso(paid)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Left</dt><dd className={cn("font-semibold tabular-nums", remaining > 0 ? "text-foreground" : "text-success")}>{formatPeso(remaining)}</dd></div>
        <p className="col-span-3 text-xs text-muted-foreground">Due {formatPortalDate(dueDate)}</p>
      </dl>
      <ol aria-label="Payment history">{entries.map((entry, index) => <Entry key={entry.id} entry={entry} last={index === entries.length - 1} />)}</ol>
    </div>
  );
}

/** Everything that happened to one client payment, oldest first. Full screen on a phone, a side panel on wider screens. */
export function PaymentHistorySheet({ eventId, payment, onClose }: { eventId: string; payment: { id: string; label: string } | null; onClose: () => void }) {
  return (
    <Sheet open={payment !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {payment ? (
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b border-border pr-12">
            <SheetTitle>{payment.label}</SheetTitle>
            <SheetDescription>Everything that happened to this payment, oldest first.</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col pt-4"><Body eventId={eventId} milestoneId={payment.id} /></div>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
