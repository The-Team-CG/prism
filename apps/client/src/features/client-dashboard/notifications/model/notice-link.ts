import type { NotificationAction } from "@prism/types";
import { conversationHash } from "@prism/ui/portal-path";
import { dashboardHref } from "../../workspace/model/client-dashboard-navigation";

export type NoticeLink = { href: string; label: string };

type EventSection = Extract<NotificationAction, { kind: "event_section" }>["section"];
type SectionTarget = { page: Parameters<typeof dashboardHref>[0]; label: string };

/** Event areas a client page exists for. Supplier schedules and event-day operations have none, so they carry no link. */
const SECTION_TARGETS: Record<EventSection, SectionTarget | null> = {
  overview: { page: "overview", label: "Open event" },
  briefing: { page: "briefing", label: "Open briefing" },
  proposal: { page: "proposal", label: "Open proposal" },
  floorplans: { page: "floorplan", label: "Open floor plan" },
  billing: { page: "billing", label: "Open billing" },
  files: { page: "documents", label: "Open documents" },
  changes: { page: "changes", label: "Open change requests" },
  live_ops: null,
};

/**
 * Where a client notice sends the reader: the client's own page for the event area the notice is about.
 * Supplier schedules and event-day operations are not client pages, so those notices carry no client link.
 */
export function clientNoticeLink(action: NotificationAction | undefined): NoticeLink | null {
  if (action?.kind === "conversation") return { href: `${dashboardHref("messages", action.eventId)}${conversationHash(action.threadId)}`, label: "Open conversation" };
  if (action?.kind !== "event_section") return null;
  const target = SECTION_TARGETS[action.section];
  return target ? { href: dashboardHref(target.page, action.eventId), label: target.label } : null;
}
