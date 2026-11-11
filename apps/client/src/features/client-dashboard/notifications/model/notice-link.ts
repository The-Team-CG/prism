import type { NotificationAction } from "@prism/types";
import { dashboardHref } from "../../workspace/model/client-dashboard-navigation";

export type NoticeLink = { href: string; label: string };

/**
 * Where a client notice sends the reader. Clients see their own event's billing, documents and floor
 * plan; supplier schedules belong to suppliers, so a notice carrying one has no client link.
 */
export function clientNoticeLink(action: NotificationAction | undefined): NoticeLink | null {
  if (action?.kind !== "event_section") return null;
  switch (action.section) {
    case "billing": return { href: dashboardHref("billing", action.eventId), label: "Open billing" };
    case "files": return { href: dashboardHref("documents", action.eventId), label: "Open documents" };
    case "floorplans": return { href: dashboardHref("floorplan", action.eventId), label: "Open floor plan" };
  }
}
