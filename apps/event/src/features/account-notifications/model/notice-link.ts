import type { NotificationAction } from "@prism/types";
import { eventWorkspaceHref } from "@/features/event-dashboard/shell/model/event-dashboard-routing";

export type NoticeLink = { href: string; label: string };

/** Where a PMCM notice sends the reader: the event workspace tab the notice is about. */
export function pmcmNoticeLink(action: NotificationAction | undefined, eventId: string | null): NoticeLink | null {
  if (action?.kind === "event_section") {
    switch (action.section) {
      case "billing": return { href: eventWorkspaceHref(action.eventId, "billing"), label: "Open billing" };
      case "files": return { href: eventWorkspaceHref(action.eventId, "files"), label: "Open files" };
      case "floorplans": return { href: eventWorkspaceHref(action.eventId, "floorplans"), label: "Open floorplans" };
    }
  }
  // A supplier schedule is read inside the event's suppliers tab; without an event there is nowhere to go.
  if (action?.kind === "supplier_schedule" && eventId) return { href: eventWorkspaceHref(eventId, "suppliers"), label: "Open suppliers" };
  return null;
}
