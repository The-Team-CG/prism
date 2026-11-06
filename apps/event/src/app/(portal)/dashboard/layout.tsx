import type { ReactNode } from "react";
import { EventPortalQueryProvider } from "@/features/event-dashboard/shell/views/event-portal-query-provider";

export default function EventDashboardLayout({ children }: { children: ReactNode }) {
  return <EventPortalQueryProvider>{children}</EventPortalQueryProvider>;
}
