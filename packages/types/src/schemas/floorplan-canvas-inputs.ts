import { z } from "zod";

/* ── Official plan canvas (floorplan editor shape) ─────────────── */
// Saved plan objects and guests use the floorplan editor's shape so PMCM saves round-trip and
// seat assignments can be checked server-side. Unknown fields pass through so editor data is not
// stripped on save. Assignment fields are optional so plans saved before seat assignments existed
// still parse.

const hasUniqueEntries = (values: string[]) => new Set(values).size === values.length;

export const floorPlanShapeKindSchema = z.enum(["rect", "ellipse", "line"]);
export const floorPlanElementCategorySchema = z.enum(["furniture", "stage", "registration", "safety", "architecture"]);
export const floorPlanRsvpSchema = z.enum(["confirmed", "pending", "declined"]);

export const floorPlanCanvasObjectSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    kind: floorPlanShapeKindSchema,
    category: floorPlanElementCategorySchema,
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    rotation: z.number(),
    fill: z.string(),
    stroke: z.string(),
    strokeWidth: z.number(),
    label: z.string().optional(),
    seats: z.number().int().nonnegative().optional(),
    assignedGuestIds: z
      .array(z.string().min(1))
      .refine(hasUniqueEntries, "A guest can be listed at a table only once")
      .optional(),
    assignedSupplierIds: z.array(z.string().min(1)).optional(),
    locked: z.boolean(),
    hidden: z.boolean(),
  })
  .passthrough();

export const floorPlanGuestSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    rsvp: floorPlanRsvpSchema,
    group: z.string().optional(),
    dietary: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();

export type FloorPlanShapeKind = z.infer<typeof floorPlanShapeKindSchema>;
export type FloorPlanElementCategory = z.infer<typeof floorPlanElementCategorySchema>;
export type FloorPlanRsvp = z.infer<typeof floorPlanRsvpSchema>;
export type FloorPlanCanvasObject = z.infer<typeof floorPlanCanvasObjectSchema>;
export type FloorPlanGuest = z.infer<typeof floorPlanGuestSchema>;
