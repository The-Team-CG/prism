import { ClientDashboardWorkspaceView } from "@/features/client-dashboard/workspace";

type ClientEventPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function ClientEventPage({ params }: ClientEventPageProps) {
  const { eventId } = await params;
  return <ClientDashboardWorkspaceView route="overview" eventId={eventId} />;
}