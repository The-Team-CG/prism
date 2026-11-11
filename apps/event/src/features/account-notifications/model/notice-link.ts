import type { NotificationAction } from "@prism/types";
import { eventWorkspaceHref } from "@/features/event-dashboard/shell/model/event-dashboard-routing";

export type NoticeLink = { href: string; label: string };

/** Where a PMCM notice sends the reader: the event workspace tab the notice is about. */
export function pmcmNoticeLink(action: NotificationAction | undefined, eventId: string | null): NoticeLink | null {
  if (action?.kind === "event_section") {
    const id = action.eventId;
    switch (action.section) {
      case "overview": return { href: eventWorkspaceHref(id, "overview"), label: "Open event" };
      // Proposals and scope changes are both reviewed in the Planning & decisions tab.
      case "briefing": return { href: eventWorkspaceHref(id, "briefing"), label: "Open planning" };
      case "proposal": return { href: eventWorkspaceHref(id, "briefing"), label: "Open proposal" };
      case "changes": return { href: eventWorkspaceHref(id, "briefing"), label: "Open scope changes" };
      case "floorplans": return { href: eventWorkspaceHref(id, "floorplans"), label: "Open floorplans" };
      case "billing": return { href: eventWorkspaceHref(id, "billing"), label: "Open billing" };
      case "files": return { href: eventWorkspaceHref(id, "files"), label: "Open files" };
      case "live_ops": return { href: eventWorkspaceHref(id, "live-ops"), label: "Open live operations" };
    }
  }
  // A supplier schedule is read inside the event's suppliers tab; without an event there is nowhere to go.
  if (action?.kind === "supplier_schedule" && eventId) return { href: eventWorkspaceHref(eventId, "suppliers"), label: "Open suppliers" };
  return null;
}
