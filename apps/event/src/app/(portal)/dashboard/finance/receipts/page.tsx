import { EventDashboardFinanceReceiptsSectionView } from "@/features/event-dashboard/shell/views/sections/finance-receipts-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardFinanceReceiptsPage() {
  return (
    <EventDashboardRouteView section="finance" tab="billing" view="receipts">
      <EventDashboardFinanceReceiptsSectionView />
    </EventDashboardRouteView>
  );
}
