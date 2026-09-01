import { EventDashboardFinanceSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ financeView: string }> }) {
  const { financeView } = await params;
  return (
    <EventDashboardRouteView section="finance" tab="billing" view={financeView}>
      <EventDashboardFinanceSectionView />
    </EventDashboardRouteView>
  );
}
