"use client";

import { useState } from "react";
import { ReceiptText } from "lucide-react";
import { useResource } from "@prism/portal-query";
import type { MarkPaymentInput, PrismBillingStatement, PrismEvent, PrismInquiry, PrismNotificationLog, PrismPaymentMilestone } from "@prism/types";
import { toast } from "@prism/ui/components/sonner";
import { manilaDateKey } from "@prism/ui/format-date";
import { PrismEmptyLine, PrismPageColumn, PrismSection } from "@prism/ui/page-blocks";
import { financeDesk } from "@/features/finance/desk";
import { EventFinancialSummaryPanel } from "@/features/finance/financials";
import { paymentReceipts } from "@/features/finance/receipts";
import { downloadStatementPdf, eventStatementOfAccount } from "../data/finance-repository";
import { eventMoney } from "../model/event-money";
import type { RecordPaymentInput } from "../model/finance-workspace-types";
import { useClientReminder } from "../view-models/use-client-reminder";
import { useFinancialWorkspaceViewModel } from "../view-models/use-financial-workspace-view-model";
import { EventFinanceQueue, EventMoneyHero, EventPaymentSchedule } from "./event-money-views";
import { BillingStatementDetails, NotificationEvidence, PaymentAtRiskAlert, RecordPaymentModal } from "./financial-workspace-sections";
import { PendingAddendaNote } from "./pending-addenda-note";

function saveFile(file: { blob: Blob; fileName: string }) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function useStatementPdf(statement: PrismBillingStatement | undefined) {
  const [busy, setBusy] = useState(false);
  if (!statement?.storageObjectId || statement.storageState !== "stored") return undefined;
  const objectId = statement.storageObjectId;
  return {
    busy,
    download: () => {
      setBusy(true);
      downloadStatementPdf(objectId)
        .then((file) => saveFile({ blob: file.blob, fileName: `${statement.number}.pdf` }))
        .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : "Could not download the statement."))
        .finally(() => setBusy(false));
    },
  };
}

/**
 * One event's billing for PMCM: where the money stands and what to do (top), what this event is waiting on, every client
 * payment with whether its money has been verified, then the statement, reconciliation and delivery log folded away.
 */
export function FinancialWorkspace({
  event,
  inquiry,
  billingStatements,
  payments,
  notificationLogs = [],
  busy,
  onRecordPayment,
  onSendBilling,
  onMarkPayment,
}: {
  event: PrismEvent;
  inquiry?: PrismInquiry;
  billingStatements: PrismBillingStatement[];
  payments: PrismPaymentMilestone[];
  notificationLogs?: PrismNotificationLog[];
  busy: boolean;
  onRecordPayment: (milestoneId: string, input: RecordPaymentInput) => Promise<void>;
  onSendBilling: (billingId: string) => Promise<void>;
  onMarkPayment: (milestoneId: string, input: MarkPaymentInput) => Promise<void>;
}) {
  const statement = billingStatements.find((billing) => billing.eventId === event.id && billing.status !== "superseded");
  const vm = useFinancialWorkspaceViewModel({ busy, onRecordPayment });
  const soa = useResource(eventStatementOfAccount, event.id).data;
  const receipts = useResource(paymentReceipts, { eventId: event.id }).data ?? [];
  const desk = useResource(financeDesk, "signed-in").data;
  const pdf = useStatementPdf(statement);
  const reminder = useClientReminder(event.id);
  const todayKey = manilaDateKey();
  const active = payments.filter((payment) => !payment.supersededAt);
  const paymentAtRisk = active.some((payment) => payment.status === "at_risk");

  if (!soa?.available) {
    return (
      <PrismPageColumn>
        <PendingAddendaNote eventId={event.id} />
        <PrismSection id="finance-billing-statement" title="Billing">
          <PrismEmptyLine icon={ReceiptText}>No billing statement yet. Create and approve a billing source under Billing sources, then generate the statement.</PrismEmptyLine>
        </PrismSection>
      </PrismPageColumn>
    );
  }

  const money = eventMoney(soa, statement, event, todayKey);
  const nextOpen = active.find((payment) => payment.remainingBalance > 0);
  return (
    <div className="space-y-5">
      <EventMoneyHero
        money={money}
        todayKey={todayKey}
        busy={busy}
        onRecord={nextOpen ? () => vm.openRecordModal(nextOpen) : undefined}
        onSend={statement ? () => void onSendBilling(statement.id) : undefined}
        pdf={pdf}
      />
      {paymentAtRisk ? <PaymentAtRiskAlert /> : null}
      <PendingAddendaNote eventId={event.id} />
      <EventFinanceQueue items={(desk?.queue ?? []).filter((item) => item.eventId === event.id)} />
      <EventPaymentSchedule
        money={money}
        payments={active}
        receipts={receipts}
        todayKey={todayKey}
        busy={busy}
        onRecord={vm.openRecordModal}
        onToggleRisk={(payment) => void onMarkPayment(payment.id, { status: payment.status === "at_risk" ? "pending" : "at_risk" })}
        reminder={{ busyId: reminder.busyId, remind: (milestoneId, label) => void reminder.remind(milestoneId, label) }}
      />
      {statement ? <BillingStatementDetails event={event} inquiry={inquiry} statement={statement} /> : null}
      <EventFinancialSummaryPanel eventId={event.id} folded />
      {notificationLogs.length > 0 ? <NotificationEvidence logs={notificationLogs} /> : null}
      {vm.activePayment ? (
        <RecordPaymentModal
          activePayment={vm.activePayment}
          amountReceived={vm.amountReceived}
          paymentDate={vm.paymentDate}
          paymentMethod={vm.paymentMethod}
          referenceNumber={vm.referenceNumber}
          busy={busy}
          onAmount={vm.setAmountReceived}
          onDate={vm.setPaymentDate}
          onMethod={vm.setPaymentMethod}
          onReference={vm.setReferenceNumber}
          onClose={() => vm.setActivePayment(null)}
          onSubmit={vm.submitRecordPayment}
        />
      ) : null}
    </div>
  );
}
