import type { NotificationAction } from "@prism/types";
import { eventWorkspaceHref } from "@/features/event-dashboard/shell/model/event-dashboard-routing";

export type NoticeLink = { href: string; label: string };

type EventSection = Extract<NotificationAction, { kind: "event_section" }>["section"];
type WorkspaceTab = Parameters<typeof eventWorkspaceHref>[1];

/** The workspace tab each event section opens. Proposals and scope changes are both reviewed in the Planning & decisions tab. */
const SECTION_LINKS: Record<EventSection, { tab: WorkspaceTab; label: string }> = {
  overview: { tab: "overview", label: "Open event" },
  briefing: { tab: "briefing", label: "Open planning" },
  proposal: { tab: "briefing", label: "Open proposal" },
  changes: { tab: "briefing", label: "Open scope changes" },
  floorplans: { tab: "floorplans", label: "Open floorplans" },
  billing: { tab: "billing", label: "Open billing" },
  // The files tab opens on the library, with what is waiting for review at the top.
  files: { tab: "files", label: "Open files" },
  live_ops: { tab: "live-ops", label: "Open live operations" },
};

/** Where a PMCM notice sends the reader: the event workspace tab the notice is about. */
export function pmcmNoticeLink(action: NotificationAction | undefined, eventId: string | null): NoticeLink | null {
  if (action?.kind === "event_section") {
    // A section this app does not know (from a newer API) has no link rather than a broken one.
    const target = SECTION_LINKS[action.section] as (typeof SECTION_LINKS)[EventSection] | undefined;
    return target ? { href: eventWorkspaceHref(action.eventId, target.tab), label: target.label } : null;
  }
  // A supplier schedule is read inside the event's suppliers tab; without an event there is nowhere to go.
  if (action?.kind === "supplier_schedule" && eventId) return { href: eventWorkspaceHref(eventId, "suppliers"), label: "Open suppliers" };
  return null;
}
