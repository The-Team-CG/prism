import { notFound } from "next/navigation";
import { ClientDashboardWorkspaceView, type ClientDashboardRoute } from "@/features/client-dashboard/workspace";

const sectionRoutes: Record<string, ClientDashboardRoute> = {
  overview: "overview",
  details: "details",
  progress: "progress",
  schedule: "schedule",
  guests: "guests",
  preferences: "preferences",
  actions: "actions",
  approvals: "approvals",
  briefing: "briefing",
  proposal: "proposal",
  "floor-plan": "floorplan",
  documents: "documents",
  billing: "billing",
  messages: "messages",
  changes: "changes",
  summary: "summary",
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

  return <ClientDashboardWorkspaceView route={route} eventId={eventId} />;
}