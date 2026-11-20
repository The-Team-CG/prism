/**
 * Planning writes stop once an event is archived or cancelled. A cancelled event is still closed out and archived by
 * PMCM; it no longer takes briefing, scope, ocular-visit or addendum changes. Returns the refusal, or null when open.
 */
export function planningWriteRefusal(event: { archived: boolean; status: string }, action: string): string | null {
  if (event.archived || event.status === 'archived') return `Archived events cannot ${action}`;
  if (event.status === 'cancelled') return `Cancelled events cannot ${action}`;
  return null;
}
