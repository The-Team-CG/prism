import EventDashboardClient from "../../../EventDashboardClient";

export default async function EventSuppliersPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <EventDashboardClient section="events" eventId={eventId} tab="suppliers" />;
}
