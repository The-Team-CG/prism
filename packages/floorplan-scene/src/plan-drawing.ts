import { isPrismEventPieceType, prismEventPieceSchemaFor, type FloorplanSceneDocument, type PrismEventPiece } from "@prism/types";
import { isHiddenInScene } from "./scene-visibility.js";
import { joinedRuns, RUN_DEPTH_M } from "./seat-layout.js";

type SceneNode = FloorplanSceneDocument["nodes"][string] & Record<string, unknown>;

/** A box centred at (x, y) in a piece's own frame, before the piece turns. */
export type PieceBox = { x: number; y: number; width: number; depth: number };

/** How a piece is outlined: its box, the ellipse inside it, or (a U or hollow square) the boxes of its joined runs. */
export type PieceOutline = { shape: "rect" } | { shape: "circle" } | { shape: "runs"; runs: PieceBox[] };

export type PlanDrawing = {
  room: { minX: number; minY: number; width: number; depth: number };
  walls: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>;
  pieces: Array<{ id: string; type: string; name: string; cx: number; cy: number; width: number; depth: number; rotation: number } & PieceOutline>;
};

type Extent = { minX: number; minY: number; width: number; depth: number };
type Point = [number, number];

const isPoint = (value: unknown): value is Point => Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number";

function visibleNodes(scene: FloorplanSceneDocument): SceneNode[] {
  return Object.values(scene.nodes as Record<string, SceneNode>).filter((node) => !isHiddenInScene(scene, node.id));
}

/** The visible walls as end points, skipping any wall without two valid points. */
function visibleWallEnds(scene: FloorplanSceneDocument): Array<{ id: string; start: Point; end: Point }> {
  return visibleNodes(scene).flatMap((node) =>
    node.type === "wall" && isPoint(node.start) && isPoint(node.end) ? [{ id: node.id, start: node.start, end: node.end }] : [],
  );
}

/** The box around the visible walls in metres, or null for a scene without walls. */
function wallExtent(scene: FloorplanSceneDocument): Extent | null {
  const points = visibleWallEnds(scene).flatMap((wall) => [wall.start, wall.end]);
  if (points.length === 0) return null;
  const xs = points.map(([x]) => x);
  const zs = points.map(([, z]) => z);
  const minX = Math.min(...xs);
  const minY = Math.min(...zs);
  return { minX, minY, width: Math.max(...xs) - minX, depth: Math.max(...zs) - minY };
}

/** The room's size in metres, measured from its visible walls; null when there are none. */
export function roomSize(scene: FloorplanSceneDocument): { width: number; depth: number } | null {
  const extent = wallExtent(scene);
  return extent && { width: extent.width, depth: extent.depth };
}

/** The name a piece shows on a plan: its label, then a table's number, then its variant, then its kind. */
export function pieceName(node: SceneNode): string {
  const label = typeof node.label === "string" ? node.label.trim() : "";
  if (label) return label;
  if (node.type === "prism-table" && typeof node.number === "number") return `T${node.number}`;
  if (typeof node.variant === "string" && node.variant) return node.variant.replaceAll("-", " ");
  return node.type.replace(/^prism-/, "");
}

function outlineOf(piece: PrismEventPiece): PieceOutline {
  if (piece.type !== "prism-table") return { shape: "rect" };
  if (piece.shape === "round" || piece.shape === "cocktail") return { shape: "circle" };
  if (piece.shape !== "u-shape" && piece.shape !== "hollow-square") return { shape: "rect" };
  const runs = joinedRuns(piece).map(({ length, centre: [x, y], alongZ }) =>
    alongZ ? { x, y, width: RUN_DEPTH_M, depth: length } : { x, y, width: length, depth: RUN_DEPTH_M },
  );
  return { shape: "runs", runs };
}

/** A visible event piece as a drawable shape, or null when it is not an event piece or fails its schema. */
function drawnPiece(node: SceneNode): PlanDrawing["pieces"][number] | null {
  if (!isPrismEventPieceType(node.type)) return null;
  const parsed = prismEventPieceSchemaFor(node.type).safeParse(node);
  if (!parsed.success) return null;
  const piece = parsed.data;
  return {
    id: node.id,
    type: node.type,
    name: pieceName(node),
    ...outlineOf(piece),
    cx: piece.position[0],
    cy: piece.position[2],
    width: piece.width,
    depth: piece.depth,
    rotation: piece.rotation,
  };
}

/**
 * What a 2D view needs to draw a Pascal scene: the room box from its visible walls, each visible wall as a line, and
 * each visible event piece as a shape (a U or hollow square as its runs). Hidden nodes, and anything under a hidden node, are left out. Throws for a
 * scene without walls, since every PRISM plan has a room.
 */
export function planDrawing(scene: FloorplanSceneDocument): PlanDrawing {
  const extent = wallExtent(scene);
  if (!extent) throw new Error("This floor plan has no walls");
  return {
    room: extent,
    walls: visibleWallEnds(scene).map((wall) => ({ id: wall.id, x1: wall.start[0], y1: wall.start[1], x2: wall.end[0], y2: wall.end[1] })),
    pieces: visibleNodes(scene).flatMap((node) => drawnPiece(node) ?? []),
  };
}
