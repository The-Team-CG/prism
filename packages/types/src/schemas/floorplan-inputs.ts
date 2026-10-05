import { z } from "zod";
import { nonEmptyStringSchema, optionalTrimmedStringSchema } from "./common.js";
/* ── Floorplan preference (client layout notes) ───────────────── */

export const createFloorPlanDraftSchema = z.object({
  name: z.string(),
  sourceType: z.enum(["blank", "template", "client_preference"]),
  venue: optionalTrimmedStringSchema,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  gridSize: z.number().int().positive().optional(),
  pax: z.number().int().nonnegative().optional(),
  objects: z.array(z.unknown()).optional(),
  guests: z.array(z.unknown()).optional(),
  suppliers: z.array(z.unknown()).optional(),
});
export type CreateFloorPlanDraftInput = z.infer<typeof createFloorPlanDraftSchema>;

export const createFloorPlanPreferenceSchema = z.object({
  name: z.string(),
  seatingStyle: z.string(),
  stagePreference: z.string(),
  flowNotes: z.string(),
  guestCount: z.number().int().min(1),
  constraints: z.array(z.string()),
  notes: optionalTrimmedStringSchema,
  venue: optionalTrimmedStringSchema,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  gridSize: z.number().int().positive().optional(),
  objects: z.array(z.unknown()).optional(),
});
export type CreateFloorPlanPreferenceInput = z.infer<typeof createFloorPlanPreferenceSchema>;

export const prismFloorPlanPreferenceSchema = z.object({
  seatingStyle: z.string(),
  stagePreference: z.string(),
  flowNotes: z.string(),
  guestCount: z.number(),
  constraints: z.array(z.string()),
  notes: z.string().optional(),
});

export const prismFloorPlanSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  venue: z.string(),
  width: z.number(),
  height: z.number(),
  gridSize: z.number(),
  pax: z.number(),
  objects: z.array(z.unknown()).optional(),
  guests: z.array(z.unknown()).optional(),
  suppliers: z.array(z.unknown()).optional(),
  seats: z.array(z.unknown()).optional(),
  seatCategories: z.array(z.unknown()).optional(),
  updatedAt: z.string().optional(),
});

export const createFloorPlanRevisionCommentSchema = z.object({
  revisionNote: nonEmptyStringSchema,
  idempotencyKey: optionalTrimmedStringSchema,
});
export type CreateFloorPlanRevisionCommentInput = z.infer<typeof createFloorPlanRevisionCommentSchema>;
