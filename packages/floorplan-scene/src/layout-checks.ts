import { ColumnNode } from "@pascal-app/core";
import {
  isPrismEventPieceType,
  prismEventPieceSchemaFor,
  type FloorplanSceneDocument,
  type PrismEventPiece,
  type PrismLayoutIssue,
  type PrismSeatingBlockNode,
  type PrismTableNode,
} from "@prism/types";
import { blocks, footprint, gapBetween, onPlan, reachOf, type Footprint, type Point } from "./footprints.js";
import { pieceName, roomSize } from "./plan-drawing.js";
import { isHiddenInScene } from "./scene-visibility.js";
import { CHAIR_CENTRE_OUTSET_M, blockSeatSpots, isRoundTable, seatSpots } from "./seat-layout.js";

/**
 * The layout rules a planner checks a room against. Seated tables need about 1.5 m (60 in) between their edges for
 * chairs to push back and staff to pass; a seating aisle needs 1.2 m; a row needs an aisle within 14 seats.
 */
export const LAYOUT_RULES = { seatedTableGapM: 1.5, aisleM: 1.2, seatsWithoutAisle: 14 } as const;

/** How far a seated chair reaches past a table's edge: its centre's outset plus half its depth. */
const CHAIR_REACH_M = CHAIR_CENTRE_OUTSET_M + 0.2;
/** Pieces hung or spread overhead, which share the floor with what stands under them. */
const OVERHEAD = new Set(["tent", "string-lights"]);
/** Pieces that stand on a round footprint. */
const ROUND = new Set(["cake-table", "plant", "umbrella", "uplight", "extinguisher"]);
/** Pieces tall enough to block a seated guest's view of the stage. */
const TALL = new Set(["speaker", "led-wall", "projection-screen", "arch", "backdrop", "photo-booth", "plant", "booth", "bag-check", "portable-toilets", "throne"]);
/** What guests look at, in order of preference: the stage, else a screen. */
const FOCAL = ["stage", "led-wall", "projection-screen"];

type Placed = { piece: PrismEventPiece; name: string; centre: Point; body: Footprint; occupied: Footprint; reach: number };

const variantOf = (piece: PrismEventPiece): string => ("variant" in piece && typeof piece.variant === "string" ? piece.variant : "");
const seatedTable = (piece: PrismEventPiece): piece is PrismTableNode => piece.type === "prism-table" && piece.shape !== "cocktail" && piece.seats > 0;
const metres = (value: number) => `${Math.round(value * 10) / 10} m`;

function place(piece: PrismEventPiece, node: FloorplanSceneDocument["nodes"][string]): Placed {
  const round = isRoundTable(piece) || ROUND.has(variantOf(piece));
  const body = footprint(piece, round);
  const occupied = seatedTable(piece) ? footprint(piece, round, CHAIR_REACH_M) : body;
  const centre: Point = [piece.position[0], piece.position[2]];
  return { piece, name: pieceName(node as never), centre, body, occupied, reach: reachOf(occupied, centre) };
}

/** Every visible event piece that stands on the floor: zones, drawn shapes and overhead pieces are left out. */
function standing(scene: FloorplanSceneDocument): Placed[] {
  return Object.values(scene.nodes).flatMap((node) => {
    if (!isPrismEventPieceType(node.type) || isHiddenInScene(scene, node.id)) return [];
    const piece = prismEventPieceSchemaFor(node.type).parse(node) as PrismEventPiece;
    if (piece.type === "prism-zone" || piece.type === "prism-shape" || OVERHEAD.has(variantOf(piece))) return [];
    return [place(piece, node)];
  });
}

const isExit = (placed: Placed) => variantOf(placed.piece) === "emergency-exit";

/** Two pieces on top of each other, or two seated tables too close for chairs and service. */
function pairIssue(a: Placed, b: Placed): PrismLayoutIssue | null {
  if (isExit(a) || isExit(b)) return null;
  if (Math.hypot(a.centre[0] - b.centre[0], a.centre[1] - b.centre[1]) > a.reach + b.reach + LAYOUT_RULES.seatedTableGapM) return null;
  const ids = [a.piece.id, b.piece.id];
  if (gapBetween(a.body, b.body) === 0) return { kind: "overlap", pieceIds: ids, message: `${a.name} and ${b.name} overlap.` };
  if (gapBetween(a.occupied, b.occupied) === 0) return { kind: "overlap", pieceIds: ids, message: `The chairs at ${a.name} and ${b.name} run into each other.` };
  if (!seatedTable(a.piece) || !seatedTable(b.piece)) return null;
  const gap = gapBetween(a.body, b.body);
  if (gap >= LAYOUT_RULES.seatedTableGapM) return null;
  return { kind: "tight", pieceIds: ids, message: `${a.name} and ${b.name} are ${metres(gap)} apart; seated tables need ${metres(LAYOUT_RULES.seatedTableGapM)} for chairs and service.` };
}

function pairIssues(pieces: Placed[]): PrismLayoutIssue[] {
  return pieces.flatMap((a, index) => pieces.slice(index + 1).flatMap((b) => pairIssue(a, b) ?? []));
}

/** Anything standing in an emergency exit's clear area. */
function exitIssues(pieces: Placed[]): PrismLayoutIssue[] {
  return pieces.filter(isExit).flatMap((exit) =>
    pieces
      .filter((other) => other !== exit && !isExit(other) && gapBetween(other.occupied, exit.body) === 0)
      .map((other) => ({ kind: "exit-blocked" as const, pieceIds: [other.piece.id, exit.piece.id], message: `${other.name} stands in the clear area of ${exit.name}.` })),
  );
}

/** Pieces whose centre is outside the room's walls. */
function outsideIssues(scene: FloorplanSceneDocument, pieces: Placed[]): PrismLayoutIssue[] {
  const walls = Object.values(scene.nodes).flatMap((node) => (node.type === "wall" && !isHiddenInScene(scene, node.id) ? [node as unknown as { start: Point; end: Point }] : []));
  if (!roomSize(scene) || walls.length === 0) return [];
  const xs = walls.flatMap((wall) => [wall.start[0], wall.end[0]]);
  const zs = walls.flatMap((wall) => [wall.start[1], wall.end[1]]);
  const inside = ([x, z]: Point) => x >= Math.min(...xs) && x <= Math.max(...xs) && z >= Math.min(...zs) && z <= Math.max(...zs);
  return pieces.filter((placed) => !inside(placed.centre)).map((placed) => ({ kind: "outside-room" as const, pieceIds: [placed.piece.id], message: `${placed.name} is outside the room.` }));
}

/** A seating block's aisle narrower than the rule, or rows too long with no aisle at all. */
function aisleIssue(placed: Placed): PrismLayoutIssue | null {
  const block = placed.piece as PrismSeatingBlockNode;
  const ids = [block.id];
  if (block.aisle > 0 && block.aisle < LAYOUT_RULES.aisleM) {
    return { kind: "aisle", pieceIds: ids, message: `${placed.name}'s aisle is ${metres(block.aisle)}; keep it at least ${metres(LAYOUT_RULES.aisleM)} wide.` };
  }
  if (block.aisle === 0 && block.columns > LAYOUT_RULES.seatsWithoutAisle) {
    return { kind: "aisle", pieceIds: ids, message: `${placed.name} has ${block.columns} seats in a row with no aisle; split it with an aisle.` };
  }
  return null;
}

/** Where each chair of a seated piece is on the plan. */
function seatsOnPlan(piece: PrismEventPiece): Point[] {
  const spots = piece.type === "prism-table" ? seatSpots(piece) : piece.type === "prism-seating-block" ? blockSeatSpots(piece) : [];
  return spots.map(({ x, z }) => onPlan(piece, [x, z]));
}

/** Seats whose straight view of the stage (or, with no stage, the screen) passes through something tall. */
function sightlineIssues(pieces: Placed[], columns: Footprint[]): PrismLayoutIssue[] {
  const focal = FOCAL.map((variant) => pieces.find((placed) => variantOf(placed.piece) === variant)).find(Boolean);
  if (!focal) return [];
  const blockers = [
    ...pieces.filter((placed) => placed !== focal && TALL.has(variantOf(placed.piece))).map((placed) => ({ name: placed.name, body: placed.body })),
    ...columns.map((body) => ({ name: "a column", body })),
  ];
  return pieces.flatMap((placed) => {
    const blocked = seatsOnPlan(placed.piece).map((seat) => blockers.find((blocker) => blocks(blocker.body, seat, focal.centre))).filter((blocker) => blocker !== undefined);
    if (blocked.length === 0) return [];
    const message = `${placed.name}: ${blocked.length} seat${blocked.length === 1 ? "" : "s"} cannot see ${focal.name} past ${blocked[0]!.name}.`;
    return [{ kind: "sightline" as const, pieceIds: [placed.piece.id], message }];
  });
}

/** The room's columns, read with Pascal's own column schema. */
function columnFootprints(scene: FloorplanSceneDocument): Footprint[] {
  return Object.values(scene.nodes).flatMap((node) => {
    if (node.type !== "column" || isHiddenInScene(scene, node.id)) return [];
    const column = ColumnNode.parse(node);
    return [footprint(column, column.crossSection === "round")];
  });
}

/**
 * Checks a plan against how a room has to work on the day: nothing on top of anything else, seated tables far enough
 * apart for chairs and service, every piece inside the room, every emergency exit clear, seating aisles wide enough and
 * rows not too long, and every seat able to see the stage. Hidden pieces are not checked.
 */
export function layoutChecks(scene: FloorplanSceneDocument): PrismLayoutIssue[] {
  const pieces = standing(scene);
  return [
    ...pairIssues(pieces),
    ...exitIssues(pieces),
    ...outsideIssues(scene, pieces),
    ...pieces.filter((placed) => placed.piece.type === "prism-seating-block").flatMap((placed) => aisleIssue(placed) ?? []),
    ...sightlineIssues(pieces, columnFootprints(scene)),
  ];
}
