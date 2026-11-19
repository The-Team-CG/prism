import { z } from "zod";
import { floorplanSceneDocumentSchema } from "./floorplan-scene.js";
import { optionalTrimmedStringSchema } from "./common.js";

export const tableAssignmentIneligibleReasonSchema = z.enum([
  "unknown-guest",
  "guest-declined",
  "not-a-table",
  "table-hidden",
  "table-full",
  "guest-already-seated",
  "event-too-large",
  "event-public",
]);
export type TableAssignmentIneligibleReason = z.infer<typeof tableAssignmentIneligibleReasonSchema>;
/* ── Floorplan preference (client layout notes) ───────────────── */

export const createFloorPlanDraftSchema = z.object({
  name: z.string(),
  sourceType: z.enum(["blank", "template", "client_preference"]),
  /** PMCM venue library preset to copy server-side; when set, the venue's scene is copied and no layout is sent. */
  venueTemplateId: optionalTrimmedStringSchema,
  venue: optionalTrimmedStringSchema,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  gridSize: z.number().int().positive().optional(),
  pax: z.number().int().nonnegative().optional(),
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
  /** The client's layout as a Pascal scene; omitted until the client has saved one. */
  scene: floorplanSceneDocumentSchema.optional(),
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
  updatedAt: z.string().optional(),
  scene: floorplanSceneDocumentSchema,
  sceneFormat: z.string(),
});

/* ── Floorplan snapshot query (type plus optional actor hints; unknown keys are rejected) ── */

export const floorPlanSnapshotQuerySchema = z.object({
  type: z.enum(["submitted", "approved"]).optional(),
  actorId: z.string().optional(),
  actorRole: z.enum(["pmcm-admin", "client", "supplier", "coordinator", "guest", "system", "unknown"]).optional(),
  actorEmail: z.string().email().optional(),
  actorName: z.string().optional(),
  clientName: z.string().optional(),
  supplierId: z.string().optional(),
  coordinatorId: z.string().optional(),
  eventId: z.string().optional(),
  accessCode: z.string().optional(),
}).strict();
export type FloorPlanSnapshotQuery = z.infer<typeof floorPlanSnapshotQuerySchema>;
