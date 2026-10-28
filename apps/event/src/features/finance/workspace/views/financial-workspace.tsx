import type { PrismBillingStatement, PrismEvent, PrismInquiry, PrismNotificationLog, PrismPaymentMilestone } from "@prism/types";
import type { MarkPaymentInput } from "@prism/types";
import { remainingPaymentCopy, sumPaymentAmounts } from "../model/finance-workspace-rules";
import { useFinancialWorkspaceViewModel } from "../view-models/use-financial-workspace-view-model";
import type { RecordPaymentInput } from "../model/finance-workspace-types";
import {
  BillingStatementCard,
  FinancialSummaryStats,
  NotificationEvidence,
  PaymentAtRiskAlert,
  PaymentTracker,
  RecordPaymentModal,
} from "./financial-workspace-sections";

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
  const statement = billingStatements.find((b) => b.eventId === event.id);
  const vm = useFinancialWorkspaceViewModel({ statement, busy, onRecordPayment });
  const { totalDue, totalPaid, totalRemaining, openMilestones } = sumPaymentAmounts(payments);
  const balance = payments.find((p) => p.label.toLowerCase().includes("balance"));
  const paymentAtRisk = Boolean(balance && balance.status === "at_risk");

  return (
    <div className="space-y-5">
      <FinancialSummaryStats
        statement={statement}
        totalDue={totalDue}
        totalPaid={totalPaid}
        totalRemaining={totalRemaining}
        paymentsCount={payments.length}
        openMilestones={openMilestones}
        remainingSub={remainingPaymentCopy(paymentAtRisk)}
      />
      {paymentAtRisk ? <PaymentAtRiskAlert /> : null}
      {notificationLogs.length > 0 ? <NotificationEvidence logs={notificationLogs} /> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <BillingStatementCard
          event={event}
          inquiry={inquiry}
          statement={statement}
          billingStatementHref={vm.billingStatementHref}
          busy={busy}
          onSendBilling={onSendBilling}
        />
        <PaymentTracker payments={payments} busy={busy} onRecord={vm.openRecordModal} onMarkPayment={onMarkPayment} />
      </div>
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
