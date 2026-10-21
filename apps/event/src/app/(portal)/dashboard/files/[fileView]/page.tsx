import { EventDashboardFilesSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ fileView: string }> }) {
  const { fileView } = await params;
  return (
    <EventDashboardRouteView section="files" tab="floorplans" view={fileView}>
      <EventDashboardFilesSectionView />
    </EventDashboardRouteView>
  );
}
