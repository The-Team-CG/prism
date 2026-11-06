import { EventDashboardInquiriesSectionView } from "@/features/event-dashboard/shell/views/sections/inquiries-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="inquiries" tab="overview" view="prospects">
      <EventDashboardInquiriesSectionView />
    </EventDashboardRouteView>
  );
}
