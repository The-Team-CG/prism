import { EventDashboardCalendarSectionView } from "@/features/event-dashboard/shell/views/sections/calendar-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ calendarView: string }> }) {
  const { calendarView } = await params;
  return (
    <EventDashboardRouteView section="calendar" tab="overview" view={calendarView}>
      <EventDashboardCalendarSectionView />
    </EventDashboardRouteView>
  );
}
