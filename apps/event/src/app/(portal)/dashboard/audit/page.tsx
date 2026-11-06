import { EventDashboardAuditSectionView } from "@/features/event-dashboard/shell/views/sections/audit-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="audit" tab="overview" view="system-logs">
      <EventDashboardAuditSectionView />
    </EventDashboardRouteView>
  );
}
