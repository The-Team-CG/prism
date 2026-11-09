"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismNotificationPreferences, PrismViberLink, UpdateNotificationPreferencesInput } from "@prism/types";

/** The account's own notification operations; each portal passes its authenticated API client group. */
export interface NotificationPreferencesActions {
  mine(): Promise<PrismNotificationPreferences>;
  setViberEnabled(input: UpdateNotificationPreferencesInput): Promise<PrismNotificationPreferences>;
  startViberLink(): Promise<PrismViberLink>;
  unlinkViber(): Promise<PrismNotificationPreferences>;
}

const button = "rounded-md border border-border px-3 py-1.5 text-sm font-semibold disabled:opacity-50";

/**
 * FR-25: account notification channels, shared by the client, supplier and event portals. Email is always on;
 * Viber is optional and linked by opening a one-time code in the P.R.I.S.M bot.
 */
export function NotificationPreferencesPanel({ actions }: { actions: NotificationPreferencesActions }) {
  const [preferences, setPreferences] = useState<PrismNotificationPreferences | null>(null);
  const [link, setLink] = useState<PrismViberLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<PrismNotificationPreferences | void>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      if (next) setPreferences(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update notification settings.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void run(() => actions.mine()); }, [actions, run]);

  return (
    <section className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-5 text-sm">
      <div>
        <h2 className="text-base font-bold text-foreground">Notifications</h2>
        <p className="mt-1 text-muted-foreground">Event updates always go to {preferences?.email ?? "your account email"}. You can also get them on Viber.</p>
      </div>
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      {preferences && !preferences.viberConfigured ? <p className="text-muted-foreground">Viber updates are not available yet.</p> : null}
      {preferences?.viberConfigured ? (
        <div className="space-y-3">
          {preferences.viberLinked ? (
            <>
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={preferences.viberEnabled} disabled={busy} onChange={(event) => void run(() => actions.setViberEnabled({ viberEnabled: event.target.checked }))} />
                Send my updates on Viber too
              </label>
              <button type="button" disabled={busy} onClick={() => void run(() => actions.unlinkViber())} className={button}>Unlink Viber</button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => void run(async () => { setLink(await actions.startViberLink()); })} className={button}>Link Viber</button>
              {link ? (
                <div className="space-y-1 rounded-md bg-muted/50 p-3">
                  <a href={link.deepLink} className="font-semibold text-primary">Open the P.R.I.S.M chat in Viber</a>
                  <p className="text-xs text-muted-foreground">Or send this code to the P.R.I.S.M bot: <span className="font-mono font-semibold text-foreground">{link.code}</span>. It works for 15 minutes.</p>
                  <button type="button" disabled={busy} onClick={() => void run(() => actions.mine())} className="text-xs font-semibold text-primary">I have opened it, refresh</button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
