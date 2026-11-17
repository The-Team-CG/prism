import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";
import { EventAccountView } from "@/features/account";

export default function EventDashboardAccountPage() {
  return (
    <EventDashboardRouteView section="account" tab="overview" view="me">
      <EventAccountView />
    </EventDashboardRouteView>
  );
}
