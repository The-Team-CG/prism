import { EventDashboardCalendarSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ calendarView: string }> }) {
  const { calendarView } = await params;
  return (
    <EventDashboardRouteView section="calendar" tab="overview" view={calendarView}>
      <EventDashboardCalendarSectionView />
    </EventDashboardRouteView>
  );
}
