import { countNavBadge } from "../nav-badge";

/** The count on the Notifications navigation item: nothing at zero, 99+ above 99, and a spoken label. */
export function unreadNoticeBadge(unread: number | undefined): { badge: string | number; badgeLabel: string } | undefined {
  return countNavBadge(unread, "unread notification", "unread notifications");
}
