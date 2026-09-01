import { EventDashboardRouteView, EventDashboardSuppliersSectionView } from "@/features/event-dashboard/shell";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ supplierView: string }> }) {
  const { supplierView } = await params;
  return (
    <EventDashboardRouteView section="suppliers" tab="overview" view={supplierView}>
      <EventDashboardSuppliersSectionView />
    </EventDashboardRouteView>
  );
}
