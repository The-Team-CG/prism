export function resolveGuestGameLobbyUrl(
  eventSlug: string,
  guestPortalUrl: string,
  currentOrigin: string,
): string {
  const guestPortal = new URL(guestPortalUrl, currentOrigin);
  const basePath = guestPortal.pathname.replace(/\/+$/, "");
  const lobbyPath = `${basePath}/games/events/${encodeURIComponent(eventSlug)}`;
  return new URL(lobbyPath, guestPortal.origin).toString();
}
