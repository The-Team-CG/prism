import type { NotificationAction } from "@prism/types";
import { conversationHash } from "@prism/ui/portal-path";
import { dashboardHref } from "../../workspace/model/client-dashboard-navigation";

export type NoticeLink = { href: string; label: string };

/**
 * Where a client notice sends the reader: the client's own page for the event area the notice is about.
 * Supplier schedules and event-day operations are not client pages, so those notices carry no client link.
 */
export function clientNoticeLink(action: NotificationAction | undefined): NoticeLink | null {
  if (action?.kind === "conversation") return { href: `${dashboardHref("messages", action.eventId)}${conversationHash(action.threadId)}`, label: "Open conversation" };
  if (action?.kind !== "event_section") return null;
  const { eventId } = action;
  switch (action.section) {
    case "overview": return { href: dashboardHref("overview", eventId), label: "Open event" };
    case "briefing": return { href: dashboardHref("briefing", eventId), label: "Open briefing" };
    case "proposal": return { href: dashboardHref("proposal", eventId), label: "Open proposal" };
    case "floorplans": return { href: dashboardHref("floorplan", eventId), label: "Open floor plan" };
    case "billing": return { href: dashboardHref("billing", eventId), label: "Open billing" };
    case "files": return { href: dashboardHref("documents", eventId), label: "Open documents" };
    case "changes": return { href: dashboardHref("changes", eventId), label: "Open change requests" };
    case "live_ops": return null;
  }
}
