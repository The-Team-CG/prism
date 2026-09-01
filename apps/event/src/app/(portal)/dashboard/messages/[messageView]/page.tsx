import { EventDashboardMessagesSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ messageView: string }> }) {
  const { messageView } = await params;
  return (
    <EventDashboardRouteView section="messages" tab="activity" view={messageView}>
      <EventDashboardMessagesSectionView />
    </EventDashboardRouteView>
  );
}
