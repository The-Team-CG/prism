import { EventDashboardFinancePaymentDetailsSectionView } from "@/features/event-dashboard/shell/views/sections/finance-payment-details-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardFinancePaymentDetailsPage() {
  return (
    <EventDashboardRouteView section="finance" tab="billing" view="payment-details">
      <EventDashboardFinancePaymentDetailsSectionView />
    </EventDashboardRouteView>
  );
}
