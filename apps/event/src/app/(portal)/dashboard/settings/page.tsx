import { EventDashboardRouteView, EventDashboardSettingsSectionView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="settings" tab="overview" view="organization-profile">
      <EventDashboardSettingsSectionView />
    </EventDashboardRouteView>
  );
}
