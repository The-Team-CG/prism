import { z } from "zod";
import { PRISM_PRIVACY_NOTICE_VERSION } from "../privacy.js";

export const PRIVACY_NOTICE_CHANGED_MESSAGE = "The privacy notice has changed. Review it and try again.";

/** The notice version a person agreed to. Only the current version is accepted. */
export const privacyNoticeVersionSchema = z
  .string()
  .refine((value) => value === PRISM_PRIVACY_NOTICE_VERSION, PRIVACY_NOTICE_CHANGED_MESSAGE);

/** Shared privacy consent fields used on public / guest write surfaces. */
export const privacyConsentSchema = z.object({
  privacyConsentAccepted: z.literal(true),
  privacyNoticeVersion: privacyNoticeVersionSchema,
  marketingConsentAccepted: z.boolean().optional(),
});

export type PrivacyConsentInput = z.infer<typeof privacyConsentSchema>;

/**
 * Calendar date `YYYY-MM-DD`, or full ISO-8601 datetime (Nest `@IsISO8601` compat).
 */
export const isoDateStringSchema = z
  .string()
  .trim()
  .refine(
    (value) => /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) || !Number.isNaN(Date.parse(value)),
    "Expected ISO date (YYYY-MM-DD) or datetime",
  );

/** Non-empty trimmed string. */
export const nonEmptyStringSchema = z.string().trim().min(1);

/** Optional trimmed string. */
export const optionalTrimmedStringSchema = z.string().trim().optional();

/** Event-ops actor query (headers/query on scoped APIs). */
export const prismEventOpsActorSchema = z.object({
  actorId: z.string().trim().optional(),
  actorRole: z.string().trim().min(1).optional(),
  actorEmail: z.string().trim().email().optional(),
  actorName: z.string().trim().optional(),
  clientName: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  coordinatorId: z.string().trim().optional(),
  eventId: z.string().trim().optional(),
  accessCode: z.string().trim().optional(),
});
export type PrismEventOpsActorInput = z.infer<typeof prismEventOpsActorSchema>;

/** Generic uploaded file metadata. */
export const uploadMetadataSchema = z.object({
  fileName: nonEmptyStringSchema,
  mimeType: z.string().trim().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});
export type UploadMetadataInput = z.infer<typeof uploadMetadataSchema>;
