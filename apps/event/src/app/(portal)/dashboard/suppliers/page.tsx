import { EventDashboardRouteView, EventDashboardSuppliersSectionView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="suppliers" tab="overview" view="all">
      <EventDashboardSuppliersSectionView />
    </EventDashboardRouteView>
  );
}
