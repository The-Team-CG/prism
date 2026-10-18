export const ARCHIVE_COMPARISON_MAX_EVENTS = 4;
export const ARCHIVE_COMPARISON_MIN_EVENTS = 2;

/** Adds or removes an archived event from the comparison selection, capped at the comparison maximum. */
export function toggleArchiveComparisonSelection(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((selectedId) => selectedId !== id);
  if (selected.length >= ARCHIVE_COMPARISON_MAX_EVENTS) return selected;
  return [...selected, id];
}

export function canCompareArchivedEvents(selected: string[]) {
  return selected.length >= ARCHIVE_COMPARISON_MIN_EVENTS && selected.length <= ARCHIVE_COMPARISON_MAX_EVENTS;
}

export function archiveComparisonHint(selected: string[]) {
  if (selected.length === 0) return "Select two to four archived events to compare side by side.";
  if (selected.length === 1) return "Select one more archived event to compare.";
  return `${selected.length} events selected for comparison.`;
}
