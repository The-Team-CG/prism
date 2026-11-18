import { BuildingNode, ColumnNode, LevelNode, SiteNode, WallNode } from "@pascal-app/core";
import {
  FLOORPLAN_SCENE_FORMAT,
  prismPieceNodeSchema,
  prismTableNodeSchema,
  type FloorPlanCanvasObject,
  type FloorplanSceneDocument,
  type PrismPieceNodeType,
} from "@prism/types";

/** A floor plan saved by the legacy canvas editor: the room's size in metres and its objects. */
export type LegacyPlan = { name: string; widthM: number; heightM: number; objects: FloorPlanCanvasObject[] };

type SceneNode = FloorplanSceneDocument["nodes"][string];
type TableShape = "round" | "rect" | "cocktail";

/** How one legacy object becomes a scene node, decided by its category, shape, name and seats. */
type PieceMapping = { type: PrismPieceNodeType; variant: string; locked?: true };
type Mapping = { type: "wall" } | { type: "column" } | { type: "prism-table"; shape: TableShape } | PieceMapping;

const PERIMETER_WALL_THICKNESS = 0.2;
/** The site extends this far past the room on every side, so nothing near a wall falls outside it. */
const SITE_MARGIN_M = 5;
/** Scene pieces need a positive size; a legacy object can be saved with a zero side. */
const MIN_SIZE_M = 0.01;
/** A seatless rectangle smaller than this on both sides is a chair. */
const SEAT_MAX_SIDE_M = 0.6;

function kebab(value: string, fallback: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function piece(type: PrismPieceNodeType, object: FloorPlanCanvasObject): PieceMapping {
  return { type, variant: kebab(object.name, object.kind) };
}

function furnitureMapping(object: FloorPlanCanvasObject): Mapping {
  const seated = (object.seats ?? 0) > 0;
  if (object.kind === "ellipse") return { type: "prism-table", shape: seated ? "round" : "cocktail" };
  if (seated) return { type: "prism-table", shape: "rect" };
  if (Math.max(Math.abs(object.w), Math.abs(object.h)) < SEAT_MAX_SIDE_M) return piece("prism-seat", object);
  return { type: "prism-catering", variant: "buffet" };
}

function architectureMapping(object: FloorPlanCanvasObject): Mapping {
  if (object.name.startsWith("Wall")) return { type: "wall" };
  if (object.name.startsWith("Pillar")) return { type: "column" };
  return { ...piece("prism-fixture", object), locked: true };
}

function registrationMapping(object: FloorPlanCanvasObject): Mapping {
  if (object.name === "Registration Desk") return piece("prism-registration", object);
  if (object.name.includes("Booth")) return piece("prism-booth", object);
  return piece("prism-decor", object);
}

/** The plan's mapping table, first match wins. Lines, and anything no rule claims, stay as plain shapes. */
function legacyMapping(object: FloorPlanCanvasObject): Mapping {
  if (object.kind === "line") return piece("prism-shape", object);
  switch (object.category) {
    case "architecture":
      return architectureMapping(object);
    case "furniture":
      return furnitureMapping(object);
    case "stage":
      return piece(object.name === "Stage" ? "prism-stage" : "prism-av", object);
    case "registration":
      return registrationMapping(object);
    case "safety":
      return piece("prism-safety", object);
    default:
      return piece("prism-shape", object);
  }
}

function centre(object: FloorPlanCanvasObject): [number, number] {
  return [object.x + object.w / 2, object.y + object.h / 2];
}

function size(value: number): number {
  return Math.max(MIN_SIZE_M, Math.abs(value));
}

/** The legacy canvas turns clockwise on a y-down plan; the scene turns about the vertical axis by three.js rules. */
function sceneRotation(object: FloorPlanCanvasObject): number {
  return 0 - object.rotation;
}

/** Where the object came from, so nothing the legacy editor knew about it is lost. */
function legacyMetadata(object: FloorPlanCanvasObject) {
  return { legacyId: object.id, legacyName: object.name, legacyFill: object.fill, legacyStroke: object.stroke };
}

/** "T12" or "12" on a legacy table is its table number. */
function tableNumber(label: string | undefined): number | undefined {
  const match = label?.trim().match(/^T?\s*(\d+)$/i);
  const value = match ? Number(match[1]) : 0;
  return value > 0 ? value : undefined;
}

function wallFrom(object: FloorPlanCanvasObject, parentId: string): SceneNode {
  const [cx, cz] = centre(object);
  const alongWidth = Math.abs(object.w) >= Math.abs(object.h);
  const halfLength = (alongWidth ? Math.abs(object.w) : Math.abs(object.h)) / 2;
  const angle = object.rotation + (alongWidth ? 0 : Math.PI / 2);
  const [dx, dz] = [Math.cos(angle) * halfLength, Math.sin(angle) * halfLength];
  return WallNode.parse({
    parentId,
    visible: !object.hidden,
    start: [cx - dx, cz - dz],
    end: [cx + dx, cz + dz],
    thickness: size(alongWidth ? object.h : object.w),
    metadata: { ...legacyMetadata(object), locked: object.locked },
  });
}

function columnFrom(object: FloorPlanCanvasObject, parentId: string): SceneNode {
  const [cx, cz] = centre(object);
  return ColumnNode.parse({
    parentId,
    visible: !object.hidden,
    position: [cx, 0, cz],
    rotation: sceneRotation(object),
    crossSection: object.kind === "ellipse" ? "round" : "rectangular",
    width: size(object.w),
    depth: size(object.h),
    radius: Math.min(size(object.w), size(object.h)) / 2,
    metadata: { ...legacyMetadata(object), locked: object.locked },
  });
}

function eventPieceFields(object: FloorPlanCanvasObject, parentId: string, type: string) {
  const [cx, cz] = centre(object);
  return {
    id: `${type}_${crypto.randomUUID()}`,
    type,
    parentId,
    visible: !object.hidden,
    position: [cx, 0, cz] as [number, number, number],
    rotation: sceneRotation(object),
    width: size(object.w),
    depth: size(object.h),
    supplierIds: object.assignedSupplierIds ?? [],
    locked: object.locked,
    ...(object.label === undefined ? {} : { label: object.label }),
    metadata: legacyMetadata(object),
  };
}

function nodeFrom(object: FloorPlanCanvasObject, parentId: string): SceneNode {
  const mapping = legacyMapping(object);
  if (mapping.type === "wall") return wallFrom(object, parentId);
  if (mapping.type === "column") return columnFrom(object, parentId);
  const fields = eventPieceFields(object, parentId, mapping.type);
  if ("shape" in mapping) {
    const number = tableNumber(object.label);
    return prismTableNodeSchema.parse({
      ...fields,
      shape: mapping.shape,
      seats: mapping.shape === "cocktail" ? 0 : object.seats ?? 0,
      guestIds: object.assignedGuestIds ?? [],
      ...(number === undefined ? {} : { number }),
    });
  }
  return prismPieceNodeSchema.parse({ ...fields, variant: mapping.variant, locked: mapping.locked ?? object.locked });
}

function perimeterWalls(plan: LegacyPlan, parentId: string): SceneNode[] {
  const corners: [number, number][] = [[0, 0], [plan.widthM, 0], [plan.widthM, plan.heightM], [0, plan.heightM]];
  return corners.map((start, index) =>
    WallNode.parse({ parentId, start, end: corners[(index + 1) % corners.length], thickness: PERIMETER_WALL_THICKNESS, metadata: { perimeter: true } }),
  );
}

/**
 * Turns a legacy canvas plan into a Pascal scene: a site, building and level holding four walls around the room, and
 * one node per legacy object. The editor derives the floor, ceiling and zone from the walls when it loads the scene.
 */
export function convertLegacyPlan(plan: LegacyPlan, pascalVersion: string): FloorplanSceneDocument {
  const [w, h, m] = [plan.widthM, plan.heightM, SITE_MARGIN_M];
  const site = SiteNode.parse({ polygon: { type: "polygon", points: [[-m, -m], [w + m, -m], [w + m, h + m], [-m, h + m]] } });
  const building = BuildingNode.parse({ parentId: site.id, name: plan.name });
  const level = LevelNode.parse({ parentId: building.id, name: plan.name });
  const contents = [...perimeterWalls(plan, level.id), ...plan.objects.map((object) => nodeFrom(object, level.id))];

  const nodes: FloorplanSceneDocument["nodes"] = {
    [site.id]: { ...site, children: [building.id] },
    [building.id]: { ...building, children: [level.id] },
    [level.id]: { ...level, children: contents.map((node) => node.id) },
  };
  for (const node of contents) nodes[node.id] = node;
  return { format: FLOORPLAN_SCENE_FORMAT, pascalVersion, nodes, rootNodeIds: [site.id] };
}
