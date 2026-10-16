export function guestAccessCodeForEvent(event: { id: string; eventName: string }) {
  const namePart = event.eventName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .split('-')
    .filter(Boolean)
    .slice(0, 2)
    .join('-') || 'PRISM';
  const idPart = event.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'EVNT';
  return `${namePart}-${idPart}`;
}
