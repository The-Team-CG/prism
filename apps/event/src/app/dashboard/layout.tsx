import type { ReactNode } from "react";
import EventDashboardClient from "./EventDashboardClient";

export default function EventDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <EventDashboardClient />
      {children}
    </>
  );
}
