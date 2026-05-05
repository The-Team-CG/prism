import { notFound } from "next/navigation";
import { Dashboard, type ClientDashboardRoute } from "@/app/components/dashboard/Dashboard";

const sectionRoutes: Record<string, ClientDashboardRoute> = {
  overview: "overview",
  actions: "actions",
  briefing: "briefing",
  proposal: "proposal",
  "floor-plan": "floorplan",
  documents: "documents",
  billing: "billing",
  messages: "messages",
};

type ClientEventSectionPageProps = {
  params: Promise<{ eventId: string; section: string }>;
};

export default async function ClientEventSectionPage({ params }: ClientEventSectionPageProps) {
  const { eventId, section } = await params;
  const route = sectionRoutes[section];

  if (!route) {
    notFound();
  }

  return <Dashboard route={route} eventId={eventId} />;
}
