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
