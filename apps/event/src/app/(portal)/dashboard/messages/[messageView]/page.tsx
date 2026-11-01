import { EventDashboardMessagesSectionView } from "@/features/event-dashboard/shell/views/sections/messages-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ messageView: string }> }) {
  const { messageView } = await params;
  return (
    <EventDashboardRouteView section="messages" tab="activity" view={messageView}>
      <EventDashboardMessagesSectionView />
    </EventDashboardRouteView>
  );
}
