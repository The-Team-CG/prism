import { z } from "zod";

/* FR-25: per-account notification channels. Email always stays on: account, security and invitation mail depend on it. */

export const updateNotificationPreferencesSchema = z.object({ viberEnabled: z.boolean() }).strict();
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;

/** How long a Viber link code stays valid after the account asks for it. */
export const VIBER_LINK_CODE_MINUTES = 15;

export interface PrismNotificationPreferences {
  email: string;
  /** Whether mail is routed to an external provider or captured locally; configuration does not prove delivery. */
  emailDelivery: "external" | "captured" | "unavailable";
  /** The deployment has a Viber bot configured; without it Viber cannot be linked. */
  viberConfigured: boolean;
  viberLinked: boolean;
  viberEnabled: boolean;
  viberLinkedAt: string | null;
}

/** Opening the deep link starts a chat with the P.R.I.S.M bot carrying the one-time code. */
export interface PrismViberLink {
  deepLink: string;
  code: string;
  expiresAt: string;
}
