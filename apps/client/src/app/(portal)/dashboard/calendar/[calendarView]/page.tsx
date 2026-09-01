import { notFound } from "next/navigation";
import { ClientDashboardWorkspaceView, type ClientPortalView } from "@/features/client-dashboard/workspace";

const calendarViews: Record<string, ClientPortalView> = {
  "event-dates": "calendar-event-dates",
  meetings: "calendar-meetings",
  deadlines: "calendar-deadlines",
  "payment-due-dates": "calendar-payment-due-dates",
  "approval-deadlines": "calendar-approval-deadlines",
};

type Props = { params: Promise<{ calendarView: string }> };

export default async function ClientDashboardCalendarViewPage({ params }: Props) {
  const { calendarView } = await params;
  const portalView = calendarViews[calendarView];
  if (!portalView) notFound();
  return <ClientDashboardWorkspaceView route="calendar" portalView={portalView} />;
}