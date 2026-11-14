import { countNavBadge } from "../nav-badge";

/** The count on a navigation item: nothing at zero, `99+` above 99, and a spoken label for screen readers. */
export function unreadNavBadge(unread: number | undefined): { badge: string | number; badgeLabel: string } | undefined {
  return countNavBadge(unread, "unread message", "unread messages");
}
