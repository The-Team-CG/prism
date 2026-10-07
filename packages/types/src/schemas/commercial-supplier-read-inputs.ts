import { z } from "zod";
import { nonEmptyStringSchema } from "./common.js";

const historyPageSchema = z.object({
  page: z.coerce.number().int().min(0).max(1000).default(0),
  pageSize: z.coerce.number().pipe(z.union([z.literal(25), z.literal(50)])).default(25),
}).strict();

const optionalQueryValue = z.preprocess(
  (value) => typeof value === "string" ? value.trim() || undefined : value,
  nonEmptyStringSchema,
).optional();

export const pmcmSupplierDirectoryQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  categoryId: optionalQueryValue,
  tier: z.enum(["tier_1", "tier_2", "pending_first_event"]).optional(),
  rating: z.enum(["all", "unrated", "4.0", "4.5"]).default("all"),
  sort: z.enum(["name", "rating", "last_review", "certifications"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(0).max(1000).default(0),
  pageSize: z.coerce.number().pipe(z.union([z.literal(25), z.literal(50)])).default(25),
}).strict();
export type PmcmSupplierDirectoryQuery = z.infer<typeof pmcmSupplierDirectoryQuerySchema>;

export const pmcmSupplierHistoryQuerySchema = historyPageSchema;
export type PmcmSupplierHistoryQuery = z.infer<typeof pmcmSupplierHistoryQuerySchema>;

export const pmcmSupplierProfileQuerySchema = z.object({
  period: z.enum(["all", "90d", "30d"]).default("all"),
}).strict();
export type PmcmSupplierProfileQuery = z.infer<typeof pmcmSupplierProfileQuerySchema>;

export const pmcmSupplierRecordsQuerySchema = historyPageSchema.extend({
  period: z.enum(["all", "90d", "30d"]).default("30d"),
}).strict();
export type PmcmSupplierRecordsQuery = z.infer<typeof pmcmSupplierRecordsQuerySchema>;
