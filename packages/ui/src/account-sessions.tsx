"use client";

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { PrismOwnSession } from "@prism/types";
import { Button } from "./components/ui/button";
import type { AccountChange } from "./account-security";
import { formatPortalDate, formatPortalDateTime, manilaCalendarKey } from "./format-date";

const isPhone = (device: string) => / on (iOS|Android)$/.test(device);

/** This device says so and when it signed in; another says when it was last used, which is what tells it apart. */
const sessionDetail = (session: PrismOwnSession) => session.current
  ? `This device · signed in ${formatPortalDate(manilaCalendarKey(session.signedInAt))}`
  : `Last active ${formatPortalDateTime(session.lastActiveAt)}`;

/** "This device and 2 others", for the Devices row. A session from before devices were tracked has no "this device". */
export function devicesValue(sessions: PrismOwnSession[]): string {
  const others = sessions.filter((session) => !session.current).length;
  if (others === sessions.length) return others === 1 ? "1 device" : `${others} devices`;
  if (others === 0) return "This device only";
  return `This device and ${others} ${others === 1 ? "other" : "others"}`;
}

/**
 * The browsers the person is signed in on, this one first. Each other one can be signed out on its own, or all of
 * them at once. This device is not signed out here: Sign out in the menu does that and ends the visit.
 */
export function SessionList({ sessions, signOut, signOutOthers }: {
  sessions: PrismOwnSession[];
  signOut?: AccountChange<string>;
  signOutOthers?: AccountChange<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (key: string, call: () => Promise<string | null>) => {
    setBusy(key);
    setError(await call());
    setBusy(null);
  };
  const others = sessions.filter((session) => !session.current);
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border text-sm">
        {sessions.map((session) => {
          const Icon = isPhone(session.device) ? Smartphone : Monitor;
          return (
          <li key={session.id} className="flex items-start gap-3 py-2.5">
            <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-foreground">{session.device}</span>
              <span className="block text-xs text-muted-foreground">{sessionDetail(session)}</span>
            </span>
            {!session.current && signOut ? (
              <Button type="button" variant="outline" size="sm" disabled={busy !== null} aria-label={`Sign out ${session.device}`}
                onClick={() => void run(session.id, () => signOut(session.id))}>
                {busy === session.id ? "Signing out…" : "Sign out"}
              </Button>
            ) : null}
          </li>
          );
        })}
      </ul>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {others.length > 1 && signOutOthers ? (
        <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void run("others", () => signOutOthers())}>
          {busy === "others" ? "Signing out…" : "Sign out everywhere else"}
        </Button>
      ) : null}
    </div>
  );
}
