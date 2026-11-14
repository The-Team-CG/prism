"use client";

import { FinanceDeskView } from "@/features/finance/desk";
import { FinancialWorkspace } from "@/features/finance/workspace";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

/** Finance: with an event chosen, that event's billing; otherwise the desk across every event, with no picker first. */
export function EventDashboardFinanceSectionView() {
  const {
    selectedEvent,
    selectedInquiry,
    billingStatements,
    payments,
    notificationLogs,
    busy,
    recordPayment,
    sendBillingStatement,
    markPayment,
  } = useEventDashboardLoadedRouteViewModel();
  if (!selectedEvent) return <FinanceDeskView />;
  return (
    <FinancialWorkspace
      event={selectedEvent}
      inquiry={selectedInquiry}
      billingStatements={billingStatements}
      payments={payments}
      notificationLogs={notificationLogs}
      busy={Boolean(busy)}
      onRecordPayment={recordPayment}
      onSendBilling={sendBillingStatement}
      onMarkPayment={markPayment}
    />
  );
}
