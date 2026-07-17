import type { ReactNode } from "react";
import { EventDashboardShellView } from "@/features/event-dashboard/shell";

export default function EventDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <EventDashboardShellView />
      {children}
    </>
  );
}
