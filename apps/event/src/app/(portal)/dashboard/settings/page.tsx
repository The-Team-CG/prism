import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";
import { EventDashboardSettingsSectionView } from "@/features/event-dashboard/shell/views/sections/settings-section-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="settings" tab="overview" view="organization-profile">
      <EventDashboardSettingsSectionView />
    </EventDashboardRouteView>
  );
}
