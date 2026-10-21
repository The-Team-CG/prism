import { EventDashboardPrivacySectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="privacy" tab="overview" view="console">
      <EventDashboardPrivacySectionView />
    </EventDashboardRouteView>
  );
}
