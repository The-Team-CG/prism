import { EventDashboardFinanceSectionView } from "@/features/event-dashboard/shell/views/sections/finance-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="finance" tab="billing" view="overview">
      <EventDashboardFinanceSectionView />
    </EventDashboardRouteView>
  );
}
