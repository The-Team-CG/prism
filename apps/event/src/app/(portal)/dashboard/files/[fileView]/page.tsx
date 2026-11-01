import { EventDashboardFilesSectionView } from "@/features/event-dashboard/shell/views/sections/files-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ fileView: string }> }) {
  const { fileView } = await params;
  return (
    <EventDashboardRouteView section="files" tab="floorplans" view={fileView}>
      <EventDashboardFilesSectionView />
    </EventDashboardRouteView>
  );
}
