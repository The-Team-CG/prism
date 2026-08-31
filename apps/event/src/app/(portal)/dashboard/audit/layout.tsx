import type { ReactNode } from "react";

/**
 * Scoped layout for the audit section. Currently a pass-through — the
 * shared shell in the parent (portal)/dashboard/layout.tsx still renders
 * chrome and drives section switching via pathname. This file exists as
 * the seam Task 14 uses to move audit-specific rendering out of the
 * pathname-sniffing VM without touching any other section.
 */
export default function EventDashboardAuditLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
