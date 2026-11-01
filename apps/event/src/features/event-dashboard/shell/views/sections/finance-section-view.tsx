"use client";

import { EventDestinationPicker } from "./event-destination-picker";
import { FinancialWorkspace } from "@/features/finance/workspace";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

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
    events,
    navigateEvent,
  } = useEventDashboardLoadedRouteViewModel();
  return (

          selectedEvent ? (
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
          ) : (
            <EventDestinationPicker
              events={events}
              description="Billing stays tied to each event's proposal and conforme. Choose an event to open its billing."
              actionLabel="Open billing"
              tab="billing"
              onOpenEvent={(eventId) => navigateEvent(eventId, "billing")}
            />
          )
  );
}
