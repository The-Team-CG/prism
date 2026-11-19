import { z } from "zod";

/* ── Floor plan scenes (Pascal editor) ─────────────────────────── */
// A floor plan saved by the Pascal-based editor is Pascal's scene graph wrapped with its format and the
// Pascal version that wrote it. Pascal's own node fields pass through untouched; PRISM's event pieces
// (`prism-*` node types) have their own schemas below. Guests and suppliers appear only as IDs.

export const FLOORPLAN_SCENE_FORMAT = "pascal-v1";

/**
 * The Pascal plugin that registers PRISM's event pieces. Pascal draws a plugin's pieces only in a scene that lists
 * the plugin in `installedPlugins`, so every PRISM scene lists it.
 */
export const FLOORPLAN_EVENT_LAYOUT_PLUGIN_ID = "prism:event-layout";

export const floorplanSceneNodeSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    parentId: z.string().min(1).nullable(),
    visible: z.boolean().default(true),
  })
  .passthrough();

export const floorplanSceneDocumentSchema = z.object({
  format: z.literal(FLOORPLAN_SCENE_FORMAT),
  pascalVersion: z.string().min(1),
  nodes: z.record(z.string(), floorplanSceneNodeSchema),
  rootNodeIds: z.array(z.string().min(1)),
  collections: z.record(z.string(), z.unknown()).optional(),
  materials: z.record(z.string(), z.unknown()).optional(),
  installedPlugins: z.array(z.string()).optional(),
});

const hasUniqueEntries = (values: string[]) => new Set(values).size === values.length;

const placement = {
  /** Plan position in metres: x across, y up, z down the plan. */
  position: z.tuple([z.number(), z.number(), z.number()]),
  /** Rotation about the vertical axis in radians. */
  rotation: z.number(),
  width: z.number().positive(),
  depth: z.number().positive(),
  supplierIds: z.array(z.string().min(1)).default([]),
  locked: z.boolean().default(false),
};

export const prismTableNodeSchema = floorplanSceneNodeSchema.extend({
  type: z.literal("prism-table"),
  shape: z.enum(["round", "rect", "cocktail"]),
  ...placement,
  seats: z.number().int().nonnegative(),
  number: z.number().int().positive().optional(),
  chairStyle: z.string().min(1).default("chiavari"),
  linen: z.string().min(1).default("white"),
  centerpiece: z.string().min(1).optional(),
  guestIds: z.array(z.string().min(1)).refine(hasUniqueEntries, "A guest can be listed at a table only once").default([]),
});

export const prismPieceNodeTypes = [
  "prism-seat",
  "prism-stage",
  "prism-av",
  "prism-catering",
  "prism-registration",
  "prism-booth",
  "prism-decor",
  "prism-safety",
  "prism-fixture",
  "prism-shape",
] as const;

export const prismPieceNodeSchema = floorplanSceneNodeSchema.extend({
  type: z.enum(prismPieceNodeTypes),
  variant: z.string().min(1),
  ...placement,
  label: z.string().optional(),
  /** A stage's front steps and platform height; ignored by other pieces. */
  steps: z.boolean().optional(),
  heightM: z.number().positive().optional(),
});

/** Theater or classroom rows of chairs, laid out as one piece. Its chairs count as seats; guests are seated at tables. */
export const prismSeatingBlockNodeSchema = floorplanSceneNodeSchema.extend({
  type: z.literal("prism-seating-block"),
  style: z.enum(["theater", "classroom"]),
  ...placement,
  rows: z.number().int().min(1),
  columns: z.number().int().min(1),
  /** Centre aisle width in metres; 0 for none. */
  aisle: z.number().min(0).default(0),
});

export const prismDanceFloorNodeSchema = floorplanSceneNodeSchema.extend({
  type: z.literal("prism-dance-floor"),
  ...placement,
});

export const prismBarNodeSchema = floorplanSceneNodeSchema.extend({
  type: z.literal("prism-bar"),
  shape: z.enum(["straight", "l"]),
  ...placement,
});

/** An area of the room given to suppliers, such as catering back-of-house or the AV desk. */
export const prismZoneNodeSchema = floorplanSceneNodeSchema.extend({
  type: z.literal("prism-zone"),
  ...placement,
  label: z.string().trim().min(1),
});

export const prismEventPieceTypes = [
  "prism-table",
  ...prismPieceNodeTypes,
  "prism-seating-block",
  "prism-dance-floor",
  "prism-bar",
  "prism-zone",
] as const;
export type PrismEventPieceType = (typeof prismEventPieceTypes)[number];

export function isPrismEventPieceType(type: string): type is PrismEventPieceType {
  return (prismEventPieceTypes as readonly string[]).includes(type);
}

/** The schema an event piece of `type` is stored and validated with. */
export function prismEventPieceSchemaFor(type: PrismEventPieceType) {
  switch (type) {
    case "prism-table":
      return prismTableNodeSchema;
    case "prism-seating-block":
      return prismSeatingBlockNodeSchema;
    case "prism-dance-floor":
      return prismDanceFloorNodeSchema;
    case "prism-bar":
      return prismBarNodeSchema;
    case "prism-zone":
      return prismZoneNodeSchema;
    default:
      return prismPieceNodeSchema;
  }
}

const mintedId = (type: PrismEventPieceType) => z.string().min(1).default(() => `${type}_${crypto.randomUUID()}`);

/** The same schema, minting `${type}_<uuid>` when no id is given: Pascal's placement tools parse new nodes without one. */
export function placeableEventPieceSchemaFor(type: PrismEventPieceType) {
  return prismEventPieceSchemaFor(type).extend({ id: mintedId(type) });
}

export type FloorplanSceneNode = z.infer<typeof floorplanSceneNodeSchema>;
export type FloorplanSceneDocument = z.infer<typeof floorplanSceneDocumentSchema>;
export type PrismTableNode = z.infer<typeof prismTableNodeSchema>;
export type PrismPieceNodeType = (typeof prismPieceNodeTypes)[number];
export type PrismPieceNode = z.infer<typeof prismPieceNodeSchema>;
export type PrismSeatingBlockNode = z.infer<typeof prismSeatingBlockNodeSchema>;
export type PrismDanceFloorNode = z.infer<typeof prismDanceFloorNodeSchema>;
export type PrismBarNode = z.infer<typeof prismBarNodeSchema>;
export type PrismZoneNode = z.infer<typeof prismZoneNodeSchema>;
export type PrismEventPiece = PrismTableNode | PrismPieceNode | PrismSeatingBlockNode | PrismDanceFloorNode | PrismBarNode | PrismZoneNode;
