import { EventDashboardInquiriesSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="inquiries" tab="overview" view="prospects">
      <EventDashboardInquiriesSectionView />
    </EventDashboardRouteView>
  );
}
