import { notFound } from "next/navigation";
import { Dashboard, type ClientPortalView } from "@/app/components/dashboard/Dashboard";

const calendarViews: Record<string, ClientPortalView> = {
  "event-dates": "calendar-event-dates",
  meetings: "calendar-meetings",
  deadlines: "calendar-deadlines",
  "payment-due-dates": "calendar-payment-due-dates",
  "approval-deadlines": "calendar-approval-deadlines",
};

type ClientDashboardCalendarViewPageProps = {
  params: Promise<{ calendarView: string }>;
};

export default async function ClientDashboardCalendarViewPage({ params }: ClientDashboardCalendarViewPageProps) {
  const { calendarView } = await params;
  const portalView = calendarViews[calendarView];

  if (!portalView) {
    notFound();
  }

  return <Dashboard route="calendar" portalView={portalView} />;
}
