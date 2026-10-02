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

export const createFloorPlanRevisionCommentSchema = z.object({
  revisionNote: nonEmptyStringSchema,
  idempotencyKey: optionalTrimmedStringSchema,
});
export type CreateFloorPlanRevisionCommentInput = z.infer<typeof createFloorPlanRevisionCommentSchema>;
