import { EventDashboardClientsSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ clientId: string; clientView: string }> }) {
  const { clientId, clientView } = await params;
  return (
    <EventDashboardRouteView section="clients" tab="overview" clientId={clientId} view={clientView}>
      <EventDashboardClientsSectionView />
    </EventDashboardRouteView>
  );
}
