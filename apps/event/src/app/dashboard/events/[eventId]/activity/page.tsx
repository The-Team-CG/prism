import { EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return <EventDashboardRouteView routeKey="events/[eventId]/activity" />;
}
