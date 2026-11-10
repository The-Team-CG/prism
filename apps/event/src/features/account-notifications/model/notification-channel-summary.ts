import type { PrismNotificationPreferences } from "@prism/types";

/**
 * What the settings summary says about where this account's updates go. Email always works; Viber depends on the
 * deployment having a bot and on the account having linked it and left it on. Before the preferences load, or if
 * they cannot be read, only the email claim is made, since that is the one that always holds.
 */
export function notificationChannelSummary(preferences: PrismNotificationPreferences | null, fallbackEmail: string): { value: string; detail: string } {
  const email = preferences?.email || fallbackEmail;
  if (!preferences) return { value: "Email", detail: `Updates go to ${email}.` };
  if (!preferences.viberConfigured) return { value: "Email", detail: `Updates go to ${email}. Viber isn't set up for this deployment.` };
  if (!preferences.viberLinked) return { value: "Email", detail: `Updates go to ${email}. Link Viber below to get them there too.` };
  if (!preferences.viberEnabled) return { value: "Email", detail: `Updates go to ${email}. Viber is linked but turned off.` };
  return { value: "Email + Viber", detail: `Updates go to ${email} and your linked Viber.` };
}
