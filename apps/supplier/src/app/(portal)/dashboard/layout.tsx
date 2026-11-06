import type { ReactNode } from "react";
import { SupplierPortalQueryProvider } from "@/features/supplier-dashboard/workspace/views/supplier-portal-query-provider";

export default function SupplierDashboardLayout({ children }: { children: ReactNode }) {
  return <SupplierPortalQueryProvider>{children}</SupplierPortalQueryProvider>;
}
