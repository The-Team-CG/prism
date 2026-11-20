/** Guest PIN-join page for an event lobby, honouring a guest portal mounted under a base path. */
export function resolveGuestGameJoinUrl(
  lobbySlug: string,
  guestPortalUrl: string,
  currentOrigin: string,
): string {
  const guestPortal = new URL(guestPortalUrl, currentOrigin);
  const basePath = guestPortal.pathname.replace(/\/+$/, "");
  const joinUrl = new URL(`${basePath}/games/join`, guestPortal.origin);
  joinUrl.searchParams.set("eventSlug", lobbySlug);
  return joinUrl.toString();
}
