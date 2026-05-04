import EventDashboardClient from "../../../EventDashboardClient";

export default async function EventOverviewPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <EventDashboardClient section="events" eventId={eventId} tab="overview" />;
}
