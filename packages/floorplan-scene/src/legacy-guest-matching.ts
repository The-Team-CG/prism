/** A guest known by id and name: a legacy plan's own guest, or an entry on the event roster. */
export type NamedGuest = { id: string; name: string };

/**
 * Pairs each legacy plan guest with the roster guest of exactly the same name (ignoring surrounding spaces). Each
 * roster guest is taken once, in the legacy list's order, so two legacy guests with one name never become the same
 * roster guest. Legacy guests with no match are left out of the map.
 */
export function matchLegacyGuests(legacy: readonly NamedGuest[], roster: readonly NamedGuest[]): Map<string, string> {
  const unclaimed = new Map<string, string[]>();
  for (const guest of roster) unclaimed.set(guest.name.trim(), [...(unclaimed.get(guest.name.trim()) ?? []), guest.id]);
  const matches = new Map<string, string>();
  for (const guest of legacy) {
    const rosterId = unclaimed.get(guest.name.trim())?.shift();
    if (rosterId) matches.set(guest.id, rosterId);
  }
  return matches;
}
