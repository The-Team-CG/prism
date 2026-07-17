import { notFound } from "next/navigation";
import { ClientDashboardWorkspaceView, type ClientPortalView } from "@/features/client-dashboard/workspace";

const messageViews: Record<string, ClientPortalView> = {
  inbox: "messages-inbox",
  "event-conversations": "messages-event-conversations",
  "organizer-updates": "messages-organizer-updates",
  announcements: "messages-announcements",
  archived: "messages-archived",
  recent: "dashboard-recent-messages",
};

type Props = { params: Promise<{ messageView: string }> };

export default async function ClientDashboardMessageViewPage({ params }: Props) {
  const { messageView } = await params;
  const portalView = messageViews[messageView];
  if (!portalView) notFound();
  return <ClientDashboardWorkspaceView route="messages" portalView={portalView} />;
}