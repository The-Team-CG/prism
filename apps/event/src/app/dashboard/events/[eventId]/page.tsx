import { redirect } from "next/navigation";

export default async function EventDetailIndex({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  redirect(`/dashboard/events/${encodeURIComponent(eventId)}/overview`);
}
