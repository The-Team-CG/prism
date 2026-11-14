import { z } from "zod";
import { nonEmptyStringSchema } from "./common.js";

export const storageUsageSchema = z.enum([
  "signed_conforme",
  "client_document",
  "supplier_document",
  "guest_feedback_media",
  "event_deliverable",
  "event_game_media",
  "event_game_branding",
  /** Proof that money arrived (a bank statement line, a screenshot). PMCM finance only. */
  "payment_receipt_evidence",
  /** A file attached to a conversation message. Owned by the conversation; only its active members may read it. */
  "communication_attachment",
]);
export type StorageUsage = z.infer<typeof storageUsageSchema>;

const sha256Schema = z.string().trim().regex(/^[a-f0-9]{64}$/i, "checksumSha256 must be a SHA-256 hex digest");

export const requestStorageUploadSchema = z.object({
  eventId: nonEmptyStringSchema,
  ownerRecordType: nonEmptyStringSchema,
  ownerRecordId: nonEmptyStringSchema,
  logicalTarget: nonEmptyStringSchema,
  usage: storageUsageSchema,
  fileName: nonEmptyStringSchema,
  contentType: z.string().trim().min(1),
  declaredByteSize: z.number().int().positive(),
  checksumSha256: sha256Schema,
  idempotencyKey: nonEmptyStringSchema.optional(),
});
export type RequestStorageUploadInput = z.infer<typeof requestStorageUploadSchema>;

export const confirmStorageUploadSchema = z.object({
  checksumSha256: sha256Schema,
  byteSize: z.number().int().positive(),
});
export type ConfirmStorageUploadInput = z.infer<typeof confirmStorageUploadSchema>;

export const storageObjectIdSchema = z.object({ objectId: nonEmptyStringSchema });
export type StorageObjectIdInput = z.infer<typeof storageObjectIdSchema>;

/**
 * Copy a stored file the actor can read into another event as a new client document, under that event's own
 * client-upload target. The server moves the bytes; each event keeps its own copy and retention.
 */
export const copyStorageObjectSchema = z.object({
  eventId: nonEmptyStringSchema,
  logicalTarget: nonEmptyStringSchema,
}).strict();
export type CopyStorageObjectInput = z.infer<typeof copyStorageObjectSchema>;

/** Copy a stored file of the same event into a conversation as its attachment; the server moves the bytes. */
export const copyStorageObjectToThreadSchema = z.object({
  threadId: nonEmptyStringSchema,
}).strict();
export type CopyStorageObjectToThreadInput = z.infer<typeof copyStorageObjectToThreadSchema>;

/** The last day a stored document is valid, as a calendar date; null clears it. */
export const setStorageObjectExpirySchema = z.object({
  expiresAt: z.iso.date().nullable(),
}).strict();
export type SetStorageObjectExpiryInput = z.infer<typeof setStorageObjectExpirySchema>;

/** Search the signed-in client's stored files across all of their events by file name; an empty query lists the newest. */
export const searchClientStoredFilesQuerySchema = z.object({
  query: z.string().trim().max(100).optional().default(""),
}).strict();
export type SearchClientStoredFilesQuery = z.infer<typeof searchClientStoredFilesQuerySchema>;
