import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";
import { EventDashboardSettingsSectionView } from "@/features/event-dashboard/shell/views/sections/settings-section-view";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ settingView: string }> }) {
  const { settingView } = await params;
  return (
    <EventDashboardRouteView section="settings" tab="overview" view={settingView}>
      <EventDashboardSettingsSectionView />
    </EventDashboardRouteView>
  );
}
