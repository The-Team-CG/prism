import { EventDashboardFinanceSectionView } from "@/features/event-dashboard/shell/views/sections/finance-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ financeView: string }> }) {
  const { financeView } = await params;
  return (
    <EventDashboardRouteView section="finance" tab="billing" view={financeView}>
      <EventDashboardFinanceSectionView />
    </EventDashboardRouteView>
  );
}
