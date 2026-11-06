"use client";

import { useResource } from "@prism/portal-query";
import { emptyEventSummary, financeSummaryLabel, pmcmEventSummaries, summariesByEvent } from "@/features/pmcm-overview";
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
  const summaries = useResource(pmcmEventSummaries, selectedEvent ? null : "signed-in");
  const byEvent = summariesByEvent(summaries.data?.items);
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
              rowDetail={(event) => (summaries.status === "ready" ? financeSummaryLabel(byEvent.get(event.id) ?? emptyEventSummary(event.id)) : null)}
            />
          )
  );
}
