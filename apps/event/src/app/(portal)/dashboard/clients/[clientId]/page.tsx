import { EventDashboardClientsSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return (
    <EventDashboardRouteView section="clients" tab="overview" clientId={clientId} view="overview">
      <EventDashboardClientsSectionView />
    </EventDashboardRouteView>
  );
}
