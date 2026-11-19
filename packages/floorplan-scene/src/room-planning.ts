import { isPrismEventPieceType, prismEventPieceSchemaFor, type FloorplanSceneDocument, type PrismEventPiece, type PrismEventPieceType } from "@prism/types";
import { footprint, gapBetween, type Footprint, type Point } from "./footprints.js";
import { planDrawing } from "./plan-drawing.js";
import { isHiddenInScene } from "./scene-visibility.js";
import { CHAIR_CENTRE_OUTSET_M, isRoundTable } from "./seat-layout.js";

/**
 * Room planning: how many guests a room holds in each seating style, and a first layout that seats a guest count.
 * Densities are the usual planning figures for floor space per guest, aisles and service included.
 */
export const SEATING_STYLES = {
  rounds: { label: "Banquet rounds", squareMetresPerGuest: 1.1 },
  theater: { label: "Theater", squareMetresPerGuest: 0.75 },
  classroom: { label: "Classroom", squareMetresPerGuest: 1.6 },
  cocktail: { label: "Cocktail", squareMetresPerGuest: 0.8 },
} as const;
export type SeatingStyle = keyof typeof SEATING_STYLES;

/** A piece the planner lays out, as its kind and the fields it is created with. */
export type PlannedPiece = { type: PrismEventPieceType; fields: Record<string, unknown> };
export type RoomFill = { pieces: PlannedPiece[]; seats: number; short: number };

const ROUND_DIAMETER_M = 1.8;
const ROUND_SEATS = 10;
const COCKTAIL_GUESTS = 8;
const WALL_CLEARANCE_M = 1;
const WALKWAY_M = 0.9;
const SEATED_GAP_M = 1.5;
const STAGE_GAP_M = 2;
const CHAIR_REACH_M = CHAIR_CENTRE_OUTSET_M + 0.2;
/** Seat pitch across and row pitch front to back, by block style, and the widest a row may run before it needs an aisle. */
const BLOCK_PITCH = { theater: { across: 0.5, row: 0.9 }, classroom: { across: 0.6, row: 1.2 } } as const;
const SEATS_WITHOUT_AISLE = 14;
const AISLE_M = 1.2;
const TOLERANCE_M = 0.01;

type Room = { minX: number; minY: number; width: number; depth: number };
type Standing = { piece: PrismEventPiece; occupied: Footprint };

function standing(scene: FloorplanSceneDocument): Standing[] {
  return Object.values(scene.nodes).flatMap((node) => {
    if (!isPrismEventPieceType(node.type) || isHiddenInScene(scene, node.id) || node.type === "prism-zone" || node.type === "prism-shape") return [];
    const piece = prismEventPieceSchemaFor(node.type).parse(node) as PrismEventPiece;
    const seated = piece.type === "prism-table" && piece.seats > 0;
    return [{ piece, occupied: footprint(piece, isRoundTable(piece), seated ? CHAIR_REACH_M : 0) }];
  });
}

/** The floor left for seating: the room less everything already standing in it that is not seating. */
function freeFloor(room: Room, pieces: Standing[]): number {
  const taken = pieces
    .filter(({ piece }) => piece.type !== "prism-table" && piece.type !== "prism-seating-block")
    .reduce((sum, { piece }) => sum + piece.width * piece.depth, 0);
  return Math.max(0, room.width * room.depth - taken);
}

/** How many guests the room holds in each style, on the floor not already taken by staging, bars and the like. */
export function roomCapacity(scene: FloorplanSceneDocument): Array<{ style: SeatingStyle; label: string; guests: number }> {
  const floor = freeFloor(planDrawing(scene).room, standing(scene));
  return (Object.keys(SEATING_STYLES) as SeatingStyle[]).map((style) => ({
    style,
    label: SEATING_STYLES[style].label,
    guests: Math.floor(floor / SEATING_STYLES[style].squareMetresPerGuest),
  }));
}

/** Whether a new footprint keeps `gap` from every other footprint. */
/** Gaps within a centimetre of a rule pass it: footprints are drawn to the centimetre, not the micron. */
const clearOf = (candidate: Footprint, others: Footprint[], gap: number) => others.every((other) => gapBetween(candidate, other) >= gap - TOLERANCE_M);

const isSeatedTable = (piece: PrismEventPiece) => piece.type === "prism-table" && piece.seats > 0;

/** The stage, if the room has one: tables fill from it outward and a block faces it. */
const stageOf = (pieces: Standing[]) => pieces.find(({ piece }) => piece.type === "prism-stage" && "variant" in piece && piece.variant === "stage")?.piece;

/** Grid spots across the room at `pitch`, nearest the stage (or the room's top edge) first. */
function gridSpots(room: Room, pitch: number, inset: number, stage: PrismEventPiece | undefined): Point[] {
  const columns = Math.max(0, Math.floor((room.width - 2 * inset) / pitch) + 1);
  const rows = Math.max(0, Math.floor((room.depth - 2 * inset) / pitch) + 1);
  const [spanX, spanZ] = [(columns - 1) * pitch, (rows - 1) * pitch];
  const [x0, z0] = [room.minX + (room.width - spanX) / 2, room.minY + (room.depth - spanZ) / 2];
  const spots = Array.from({ length: columns * rows }, (_, index): Point => [x0 + (index % columns) * pitch, z0 + Math.floor(index / columns) * pitch]);
  const anchor: Point = stage ? [stage.position[0], stage.position[2]] : [room.minX + room.width / 2, room.minY];
  return spots.sort((a, b) => Math.hypot(a[0] - anchor[0], a[1] - anchor[1]) - Math.hypot(b[0] - anchor[0], b[1] - anchor[1]));
}

/**
 * Tables at grid spots, nearest the stage first, until `count` fit. A seated table keeps 1.5 m from other seated tables'
 * edges and a walkway from everything else; a standing table keeps a walkway from everything.
 */
function tablesAt(room: Room, pieces: Standing[], count: number, table: { width: number; seats: number; shape: string }, pitch: number): PlannedPiece[] {
  const seated = table.seats > 0;
  const tableBodies = pieces.filter(({ piece }) => isSeatedTable(piece)).map(({ piece }) => footprint(piece, isRoundTable(piece)));
  const others = pieces.filter(({ piece }) => !seated || !isSeatedTable(piece)).map(({ occupied }) => occupied);
  const reach = seated ? CHAIR_REACH_M : 0;
  const placed: PlannedPiece[] = [];
  for (const [x, z] of gridSpots(room, pitch, WALL_CLEARANCE_M + table.width / 2 + reach, stageOf(pieces))) {
    if (placed.length >= count) break;
    const position = [x, 0, z];
    const body = footprint({ position, rotation: 0, width: table.width, depth: table.width }, true);
    const occupied = footprint({ position, rotation: 0, width: table.width, depth: table.width }, true, reach);
    if (!clearOf(occupied, others, WALKWAY_M) || (seated && !clearOf(body, tableBodies, SEATED_GAP_M))) continue;
    (seated ? tableBodies : others).push(seated ? body : occupied);
    placed.push({ type: "prism-table", fields: { shape: table.shape, width: table.width, depth: table.width, seats: table.seats, position, rotation: 0 } });
  }
  return placed;
}

/** The direction from the room's centre to the stage, snapped to the nearest side; toward the top edge with no stage. */
function towardStage(room: Room, stage: PrismEventPiece | undefined): Point {
  if (!stage) return [0, -1];
  const [dx, dz] = [stage.position[0] - (room.minX + room.width / 2), stage.position[2] - (room.minY + room.depth / 2)];
  return Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz) || -1];
}

/** Where a block of `depth` stands: behind the stage's front with room to present, or near the room's top edge. */
function blockCentre(room: Room, stage: PrismEventPiece | undefined, [dx, dz]: Point, depth: number): Point {
  if (!stage) return [room.minX + room.width / 2, room.minY + WALL_CLEARANCE_M + STAGE_GAP_M + depth / 2];
  const distance = (dx === 0 ? stage.depth : stage.width) / 2 + STAGE_GAP_M + depth / 2;
  return [stage.position[0] - dx * distance, stage.position[2] - dz * distance];
}

/** One block of rows facing the stage, an aisle down its middle when its rows would run past 14 seats. */
function blockFor(room: Room, pieces: Standing[], style: "theater" | "classroom", guests: number): PlannedPiece[] {
  const pitch = BLOCK_PITCH[style];
  const stage = stageOf(pieces);
  const toward = towardStage(room, stage);
  const across = (toward[0] === 0 ? room.width : room.depth) - 2 * WALL_CLEARANCE_M;
  const aisle = Math.min(Math.floor(across / pitch.across), guests) > SEATS_WITHOUT_AISLE ? AISLE_M : 0;
  const columns = Math.max(1, Math.min(Math.floor((across - aisle) / pitch.across), guests));
  const rows = Math.ceil(guests / columns);
  const [width, depth] = [columns * pitch.across + aisle, rows * pitch.row];
  const [x, z] = blockCentre(room, stage, toward, depth);
  const placement = { position: [x, 0, z], rotation: Math.atan2(-toward[0], -toward[1]), width, depth };
  if (!clearOf(footprint(placement, false), pieces.map(({ occupied }) => occupied), WALKWAY_M)) return [];
  return [{ type: "prism-seating-block", fields: { style, rows, columns, aisle, ...placement } }];
}

const seatsOf = (planned: PlannedPiece[]) => planned.reduce((sum, { fields }) => sum + Number(fields.seats ?? Number(fields.rows ?? 0) * Number(fields.columns ?? 0)), 0);

/**
 * A first layout seating `guests` in a style, in the floor the room has left: banquet rounds of ten at 1.5 m apart, one
 * block of theater or classroom rows facing the stage, or a cocktail table per eight guests. Nothing already placed
 * moves; `short` says how many guests did not fit.
 */
export function fillRoom(scene: FloorplanSceneDocument, style: SeatingStyle, guests: number): RoomFill {
  const room = planDrawing(scene).room;
  const pieces = standing(scene);
  if (style === "theater" || style === "classroom") {
    const planned = blockFor(room, pieces, style, guests);
    return { pieces: planned, seats: seatsOf(planned), short: Math.max(0, guests - seatsOf(planned)) };
  }
  if (style === "cocktail") {
    const count = Math.ceil(guests / COCKTAIL_GUESTS);
    const planned = tablesAt(room, pieces, count, { shape: "cocktail", width: 0.7, seats: 0 }, 2.5);
    return { pieces: planned, seats: 0, short: Math.max(0, guests - planned.length * COCKTAIL_GUESTS) };
  }
  const planned = tablesAt(room, pieces, Math.ceil(guests / ROUND_SEATS), { shape: "round", width: ROUND_DIAMETER_M, seats: ROUND_SEATS }, ROUND_DIAMETER_M + SEATED_GAP_M);
  return { pieces: planned, seats: seatsOf(planned), short: Math.max(0, guests - seatsOf(planned)) };
}
