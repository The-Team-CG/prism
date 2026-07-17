import { z } from "zod";

/** Shared privacy consent fields used on public / guest write surfaces. */
export const privacyConsentSchema = z.object({
  privacyConsentAccepted: z.boolean().optional(),
  privacyNoticeVersion: z.string().min(1).optional(),
  marketingConsentAccepted: z.boolean().optional(),
});

export type PrivacyConsentInput = z.infer<typeof privacyConsentSchema>;

/** Calendar date `YYYY-MM-DD` (matches portal date inputs + Nest ISO-date usage). */
export const isoDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date as YYYY-MM-DD");

/** Non-empty trimmed string. */
export const nonEmptyStringSchema = z.string().trim().min(1);
