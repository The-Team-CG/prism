export function archivedEventMatchesSearch(
  hit: { venue: string; eventType: string; eventDate: string },
  filters: { venue?: string; eventType?: string; month?: string },
) {
  const venue = filters.venue?.trim().toLowerCase();
  const eventType = filters.eventType?.trim().toLowerCase();
  const month = filters.month?.trim();
  if (venue && !hit.venue.toLowerCase().includes(venue)) return false;
  if (eventType && !hit.eventType.toLowerCase().includes(eventType)) return false;
  if (month && !hit.eventDate.startsWith(month)) return false;
  return true;
}
