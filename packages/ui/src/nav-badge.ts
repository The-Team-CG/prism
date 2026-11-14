/**
 * The count on a navigation item: nothing at zero, `99+` above 99, and a spoken label for screen readers, such as
 * "2 overdue payments".
 */
export function countNavBadge(count: number | undefined, singular: string, plural = `${singular}s`): { badge: string | number; badgeLabel: string } | undefined {
  if (!count) return undefined;
  return { badge: count > 99 ? "99+" : count, badgeLabel: `${count} ${count === 1 ? singular : plural}` };
}
