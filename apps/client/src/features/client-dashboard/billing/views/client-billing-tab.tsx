"use client";

import Link from "next/link";
import { ReceiptText, X } from "lucide-react";
import { useResource } from "@prism/portal-query";
import type { PrismBillingStatement, PrismClientBillingDispute, PrismPaymentMilestone, PrismStatementOfAccount } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { PrismSection } from "@prism/ui/page-blocks";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { formatPeso, PaymentProgressBar, PaymentTimeline } from "@prism/ui/payment-track";
import { formatDayLabel } from "../../shared/tab-ui";
import { dashboardHref } from "../../workspace/shared";
import { ClientListEmpty } from "../../shared/client-list-ui";
import { clientStatementOfAccount } from "../data/statement-of-account-resource";
import { clientPaymentLines } from "../model/client-billing-rules";
import { milestoneStep, moneyHeadline } from "../model/client-money-rules";
import { billingDocumentsRepository } from "../data/billing-documents-repository";
import { useClientBillingDisputeViewModel } from "../view-models/use-client-billing-dispute-view-model";
import { useBillingDocumentDownload, type BillingDocumentDownload } from "../view-models/use-billing-document-download";
import { useClientStatementDownload } from "../view-models/use-client-statement-download";
import { useReportPaymentViewModel } from "../view-models/use-report-payment-view-model";
import { BillingDisputes } from "./billing-disputes";
import { MoneyHero } from "./money-hero";
import { PaidInFull } from "./paid-in-full";
import { PaymentsYouSent } from "./payments-you-sent";
import { ReportPaymentDialog } from "./report-payment-dialog";
import { StatementHistory } from "./statement-history";

type PaymentRecord = PrismPaymentMilestone["history"][number];

/** Under each payment: the money received toward it, each with a receipt. Reporting a payment lives once, in the hero. */
function StepDetail({ history, eventId, documents }: { history: PaymentRecord[]; eventId: string; documents: BillingDocumentDownload }) {
  const lines = clientPaymentLines(history);
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {lines.map(({ record, reversed }) => (
        <span key={record.id} className="inline-flex items-center gap-1.5">
          {formatPeso(record.amountReceived)} received {formatPortalDate(record.paymentDate)}
          {reversed ? <span>· reversed by PMCM</span> : (
            <button
              type="button"
              disabled={documents.busyKey === record.id}
              onClick={() => void documents.download(record.id, () => billingDocumentsRepository.paymentReceipt(eventId, record.id))}
              className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80 disabled:opacity-60"
            >
              <ReceiptText className="size-3" aria-hidden /> {documents.busyKey === record.id ? "Preparing…" : "Receipt"}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function DownloadError({ messages }: { messages: Array<string | null | undefined> }) {
  const message = messages.find(Boolean);
  return message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null;
}

function Notice({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <p role="status" className="flex items-start justify-between gap-3 rounded-lg border border-info/30 bg-info-soft px-3 py-2 text-sm text-info">
      {text}
      <button type="button" aria-label="Dismiss" onClick={onDismiss}><X className="size-4" /></button>
    </p>
  );
}

function ScheduleCard({ statement, payments, documents }: { statement: PrismStatementOfAccount; payments: PrismPaymentMilestone[]; documents: BillingDocumentDownload }) {
  const todayKey = manilaDateKey();
  const steps = statement.milestones.map((milestone) => milestoneStep(milestone, todayKey));
  const historyFor = (milestoneId: string) => payments.find((payment) => payment.id === milestoneId)?.history ?? [];
  return (
    <PrismSection id="client-payment-schedule" title="Payment schedule" count={steps.length} headerOutside>
      <div className="space-y-4">
        <PaymentProgressBar steps={steps} />
        <PaymentTimeline steps={steps} detail={(step) => <StepDetail history={historyFor(step.id)} eventId={statement.eventId} documents={documents} />} />
      </div>
    </PrismSection>
  );
}

function EarlierPayments({ payments }: { payments: PrismPaymentMilestone[] }) {
  if (payments.length === 0) return null;
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground">
          Earlier statement payments <span className="font-normal tabular-nums text-muted-foreground">{payments.length}</span>
        </summary>
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">These payments count toward the current statement.</p>
        <ul className="divide-y divide-border border-t border-border">
          {payments.map((payment) => (
            <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0 truncate">{payment.label} <span className="text-xs text-muted-foreground">· replaced {payment.supersededAt ? formatDayLabel(payment.supersededAt) : ""}</span></span>
              <span className="tabular-nums text-muted-foreground">{formatPeso(payment.amountPaid)} paid</span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

/**
 * One event's money: where it stands and what to do (the hero), every payment on a timeline, payments the client sent and
 * where PMCM is with them, the history, and a way to question a charge.
 */
export function ClientBillingTab({
  eventId,
  eventName = "Event",
  payments,
  billing,
  disputes = [],
}: {
  eventId?: string;
  eventName?: string;
  payments: PrismPaymentMilestone[];
  billing?: PrismBillingStatement;
  disputes?: PrismClientBillingDispute[];
}) {
  const statement = useResource(clientStatementOfAccount, eventId ?? null).data;
  const report = useReportPaymentViewModel(eventId ?? "", statement?.milestones ?? []);
  const disputeForm = useClientBillingDisputeViewModel({ eventId, billing, disputes });
  const statementDownload = useClientStatementDownload();
  const documents = useBillingDocumentDownload();
  const messagesHref = dashboardHref("messages", eventId);
  const headline = statement ? moneyHeadline(statement, manilaDateKey()) : null;

  if (!statement?.available || !headline) {
    return (
      <ClientListEmpty
        icon={ReceiptText}
        title="Your billing statement is not ready yet"
        description="PMCM posts your billing statement once the proposal is approved. Your payment schedule and how to pay appear here."
        action={<Button asChild variant="outline" size="sm"><Link href={messagesHref}>Message PMCM about billing</Link></Button>}
      />
    );
  }

  const storageObjectId = billing?.storageObjectId;
  return (
    <div className="space-y-6">
      {report.notice ? <Notice text={report.notice} onDismiss={report.dismissNotice} /> : null}
      <MoneyHero
        statement={statement}
        headline={headline}
        messagesHref={messagesHref}
        onReportPayment={report.start}
        statementPdf={storageObjectId && billing ? { busy: statementDownload.busy, download: () => void statementDownload.download(storageObjectId, `${billing.number}.pdf`) } : undefined}
      />
      <DownloadError messages={[statementDownload.error, documents.error]} />
      <PaidInFull statement={statement} settled={headline.tone === "success"} documents={documents} />
      <ScheduleCard statement={statement} payments={payments} documents={documents} />
      <PaymentsYouSent submissions={statement.submissions} proofBusyId={report.proofBusyId} onAddProof={(id, file) => void report.addProof(id, file)} onSendAgain={() => report.start()} />
      <StatementHistory statement={statement} documents={documents} />
      {billing && eventId ? <BillingDisputes billing={billing} milestones={statement.milestones} disputeForm={disputeForm} /> : null}
      <EarlierPayments payments={payments.filter((payment) => Boolean(payment.supersededAt))} />
      <ReportPaymentDialog vm={report} milestones={statement.milestones} />
    </div>
  );
}
