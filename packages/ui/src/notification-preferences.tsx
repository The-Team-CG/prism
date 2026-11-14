"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismNotificationPreferences, PrismViberLink, UpdateNotificationPreferencesInput } from "@prism/types";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "./components/ui/item";
import { Switch } from "./components/ui/switch";

/** The account's own notification operations; each portal passes its authenticated API client group. */
export interface NotificationPreferencesActions {
  mine(): Promise<PrismNotificationPreferences>;
  setViberEnabled(input: UpdateNotificationPreferencesInput): Promise<PrismNotificationPreferences>;
  startViberLink(): Promise<PrismViberLink>;
  unlinkViber(): Promise<PrismNotificationPreferences>;
}

function emailStatusCopy(delivery: PrismNotificationPreferences["emailDelivery"] | undefined) {
  if (delivery === "external") return "Email delivery is configured. Delivery depends on the provider and recipient mailbox.";
  if (delivery === "captured") return "Email is captured locally and is not sent to your mailbox.";
  return "Email delivery status is unavailable.";
}

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
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Manage event updates for {preferences?.email ?? "your account email"} and Viber.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Email</ItemTitle>
            <ItemDescription>{emailStatusCopy(preferences?.emailDelivery)}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Switch aria-label="Email updates" checked disabled />
          </ItemActions>
        </Item>
        {preferences && !preferences.viberConfigured ? (
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>Viber</ItemTitle>
              <ItemDescription>Viber updates are not available yet.</ItemDescription>
            </ItemContent>
          </Item>
        ) : null}
        {preferences?.viberConfigured ? (
          <Item id="viber-settings" variant="outline" className="flex-wrap scroll-mt-6">
            <ItemContent>
              <ItemTitle>Viber</ItemTitle>
              <ItemDescription>
                {preferences.viberLinked ? "Send my updates on Viber too." : "Link your Viber account to get updates there too."}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              {preferences.viberLinked ? (
                <>
                  <Switch
                    aria-label="Send my updates on Viber too"
                    checked={preferences.viberEnabled}
                    disabled={busy}
                    onCheckedChange={(checked) => void run(() => actions.setViberEnabled({ viberEnabled: checked }))}
                  />
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => actions.unlinkViber())}>Unlink Viber</Button>
                </>
              ) : (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => { setLink(await actions.startViberLink()); })}>Link Viber</Button>
              )}
            </ItemActions>
            {!preferences.viberLinked && link ? (
              <div className="w-full space-y-1 rounded-md bg-muted/50 p-3">
                <a href={link.deepLink} className="font-semibold text-primary">Open the P.R.I.S.M chat in Viber</a>
                <p className="text-xs text-muted-foreground">Send this code to the P.R.I.S.M bot: <span className="font-mono font-semibold text-foreground">{link.code}</span>. It works for 15 minutes.</p>
                <Button variant="link" size="sm" className="h-auto p-0" disabled={busy} onClick={() => void run(() => actions.mine())}>I have sent the code, refresh</Button>
              </div>
            ) : null}
          </Item>
        ) : null}
      </CardContent>
    </Card>
  );
}
