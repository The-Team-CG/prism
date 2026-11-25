"use client";

import { useEffect, useState } from "react";
import { Gamepad2, Ticket } from "lucide-react";
import type { PrismGuestSession } from "@prism/types";
import type { PrismGuestTab } from "@prism/ui";
import { portalHref } from "@prism/ui/portal-path";
import { guestSessionStorage } from "./guest-session-storage";

export type GuestTabKey = "pass" | "games";

/** Open the event's activity lobby when available, otherwise open the host's PIN form. */
export function guestGamesHref(session: Pick<PrismGuestSession, "gamesLobbySlug"> | null): string {
  return session?.gamesLobbySlug ? portalHref(`/games/events/${encodeURIComponent(session.gamesLobbySlug)}`) : portalHref("/games/join");
}

export function guestTabs(session: PrismGuestSession | null, current: GuestTabKey): PrismGuestTab[] | undefined {
  if (!session) return undefined;
  return [
    { href: portalHref("/dashboard"), label: "Pass", icon: Ticket, current: current === "pass" },
    ...(session.feedbackAvailability === "not_open"
      ? [{ href: guestGamesHref(session), label: "Activities", icon: Gamepad2, current: current === "games" }]
      : []),
  ];
}

/** The guest's tabs, only while a pass is open on this device; game links opened without a pass show none. */
export function useGuestTabs(current: GuestTabKey): PrismGuestTab[] | undefined {
  const [session, setSession] = useState<PrismGuestSession | null>(null);
  useEffect(() => setSession(guestSessionStorage.read()), []);
  return guestTabs(session, current);
}
