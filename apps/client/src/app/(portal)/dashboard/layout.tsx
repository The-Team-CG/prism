import type { ReactNode } from "react";
import { ClientPortalQueryProvider } from "@/features/client-dashboard/workspace/views/client-portal-query-provider";

export default function ClientDashboardLayout({ children }: { children: ReactNode }) {
  return <ClientPortalQueryProvider>{children}</ClientPortalQueryProvider>;
}
