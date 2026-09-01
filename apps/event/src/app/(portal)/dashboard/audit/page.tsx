import { EventDashboardAuditSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="audit" tab="overview" view="system-logs">
      <EventDashboardAuditSectionView />
    </EventDashboardRouteView>
  );
}
