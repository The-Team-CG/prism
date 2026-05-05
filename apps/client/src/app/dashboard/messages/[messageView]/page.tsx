import { notFound } from "next/navigation";
import { Dashboard, type ClientPortalView } from "@/app/components/dashboard/Dashboard";

const messageViews: Record<string, ClientPortalView> = {
  recent: "dashboard-recent-messages",
  inbox: "messages-inbox",
  "event-conversations": "messages-event-conversations",
  "organizer-updates": "messages-organizer-updates",
  announcements: "messages-announcements",
  archived: "messages-archived",
};

type ClientDashboardMessageViewPageProps = {
  params: Promise<{ messageView: string }>;
};

export default async function ClientDashboardMessageViewPage({ params }: ClientDashboardMessageViewPageProps) {
  const { messageView } = await params;
  const portalView = messageViews[messageView];

  if (!portalView) {
    notFound();
  }

  return <Dashboard route="messages" portalView={portalView} />;
}
