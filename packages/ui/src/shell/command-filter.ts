/**
 * Ctrl K matching: every word the person types must appear, ignoring case, somewhere in the item's text. A name
 * either contains the typed text or it does not, so "bill" never matches "Private Birthday Celebration".
 * Matches cmdk's filter contract: 1 keeps the item, 0 hides it.
 */
export function substringCommandFilter(value: string, search: string): number {
  const haystack = value.toLowerCase();
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((word) => haystack.includes(word)) ? 1 : 0;
}
