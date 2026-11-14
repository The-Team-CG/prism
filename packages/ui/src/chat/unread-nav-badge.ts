/** The count on a navigation item: nothing at zero, `99+` above 99, and a spoken label for screen readers. */
export function unreadNavBadge(unread: number | undefined): { badge: string | number; badgeLabel: string } | undefined {
  if (!unread) return undefined;
  return { badge: unread > 99 ? "99+" : unread, badgeLabel: `${unread} unread ${unread === 1 ? "message" : "messages"}` };
}
