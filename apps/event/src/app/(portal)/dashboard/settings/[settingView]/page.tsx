import { EventDashboardRouteView, EventDashboardSettingsSectionView } from "@/features/event-dashboard/shell";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ settingView: string }> }) {
  const { settingView } = await params;
  return (
    <EventDashboardRouteView section="settings" tab="overview" view={settingView}>
      <EventDashboardSettingsSectionView />
    </EventDashboardRouteView>
  );
}
