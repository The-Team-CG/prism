import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";
import { EventDashboardSuppliersSectionView } from "@/features/event-dashboard/shell/views/sections/suppliers-section-view";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ supplierView: string }> }) {
  const { supplierView } = await params;
  return (
    <EventDashboardRouteView section="suppliers" tab="overview" view={supplierView}>
      <EventDashboardSuppliersSectionView />
    </EventDashboardRouteView>
  );
}
