"use client";

import { useEffect, useState } from "react";
import { Gamepad2, Ticket } from "lucide-react";
import type { PrismGuestSession } from "@prism/types";
import type { PrismGuestTab } from "@prism/ui";
import { portalHref } from "@prism/ui/portal-path";
import { guestSessionStorage } from "./guest-session-storage";

export type GuestTabKey = "pass" | "games";

/** Where the Games tab leads: the event's own lobby once the guest has opened it, otherwise the host's PIN. */
export function guestGamesHref(session: Pick<PrismGuestSession, "gamesLobbySlug"> | null): string {
  return session?.gamesLobbySlug ? portalHref(`/games/events/${encodeURIComponent(session.gamesLobbySlug)}`) : portalHref("/games/join");
}

export function guestTabs(session: PrismGuestSession | null, current: GuestTabKey): PrismGuestTab[] | undefined {
  if (!session) return undefined;
  return [
    { href: portalHref("/dashboard"), label: "Pass", icon: Ticket, current: current === "pass" },
    { href: guestGamesHref(session), label: "Games", icon: Gamepad2, current: current === "games" },
  ];
}

/** The guest's tabs, only while a pass is open on this device; game links opened without a pass show none. */
export function useGuestTabs(current: GuestTabKey): PrismGuestTab[] | undefined {
  const [session, setSession] = useState<PrismGuestSession | null>(null);
  useEffect(() => setSession(guestSessionStorage.read()), []);
  return guestTabs(session, current);
}

/** Remembers the lobby of the guest's own event, so the Games tab leads back to it. A lobby of another event is ignored. */
export function rememberGuestGamesLobby(eventId: string, lobbySlug: string): void {
  const session = guestSessionStorage.read();
  if (!session || session.id !== eventId || session.gamesLobbySlug === lobbySlug) return;
  guestSessionStorage.save({ ...session, gamesLobbySlug: lobbySlug });
}
