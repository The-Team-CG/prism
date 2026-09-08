export function archivedEventMatchesSearch(
  hit: { venue: string; eventType: string; eventDate: string; eventName?: string; clientName?: string },
  filters: { venue?: string; eventType?: string; eventName?: string; clientName?: string; month?: string },
) {
  const venue = filters.venue?.trim().toLowerCase();
  const eventType = filters.eventType?.trim().toLowerCase();
  const eventName = filters.eventName?.trim().toLowerCase();
  const clientName = filters.clientName?.trim().toLowerCase();
  const month = filters.month?.trim();
  return matchesText(hit.venue, venue) && matchesText(hit.eventType, eventType)
    && matchesText(hit.eventName, eventName) && matchesText(hit.clientName, clientName)
    && matchesMonth(hit.eventDate, month);
}

function matchesText(value: string | undefined, query: string | undefined) {
  return !query || Boolean(value?.toLowerCase().includes(query));
}

function matchesMonth(value: string, month: string | undefined) {
  return !month || value.startsWith(month);
}
