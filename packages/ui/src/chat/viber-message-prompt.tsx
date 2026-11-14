"use client";

import { useEffect, useState } from "react";
import type { PrismNotificationPreferences } from "@prism/types";
import type { NotificationPreferencesActions } from "../notification-preferences";
import { portalHref } from "../portal-path";
import { Button } from "../components/ui/button";

/** Channel settings own linking; Messages only offers a route into the existing flow. */
export function ViberMessagePrompt({ actions, href }: { actions: Pick<NotificationPreferencesActions, "mine">; href: string }) {
  const [preferences, setPreferences] = useState<PrismNotificationPreferences | null>(null);
  useEffect(() => {
    let active = true;
    void actions.mine().then((next) => { if (active) setPreferences(next); }).catch(() => { if (active) setPreferences(null); });
    return () => { active = false; };
  }, [actions]);
  if (!preferences?.viberConfigured || (preferences.viberLinked && preferences.viberEnabled)) return null;
  return <div className="mx-3 mb-3 rounded-md bg-muted/50 p-3 text-sm">
    <p>Get message notices on Viber. Reply here in PRISM.</p>
    <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0"><a href={portalHref(href)}>{preferences.viberLinked ? "Turn on Viber updates" : "Get replies on Viber"}</a></Button>
  </div>;
}
