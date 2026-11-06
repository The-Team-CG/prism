import { EventDashboardPrivacySectionView } from "@/features/event-dashboard/shell/views/sections/privacy-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="privacy" tab="overview" view="console">
      <EventDashboardPrivacySectionView />
    </EventDashboardRouteView>
  );
}
