import { Dashboard } from "@/app/components/dashboard/Dashboard";

type ClientEventPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function ClientEventPage({ params }: ClientEventPageProps) {
  const { eventId } = await params;

  return <Dashboard route="overview" eventId={eventId} />;
}
