import type { ReactNode } from "react";

/**
 * Scoped layout for the audit route family. It intentionally stays a
 * pass-through: the route page owns section composition and the shared
 * dashboard shell owns only portal chrome.
 */
export default function EventDashboardAuditLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
