import { EventDashboardFinanceSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="finance" tab="billing" view="overview">
      <EventDashboardFinanceSectionView />
    </EventDashboardRouteView>
  );
}
