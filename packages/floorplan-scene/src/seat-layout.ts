import type { PrismSeatingBlockNode, PrismTableNode } from "@prism/types";

/**
 * Where a table's or a seating block's chairs go, in the piece's own frame (x across, z toward its front). The 3D design,
 * the plan symbol and the layout checks all place chairs from here, so every view seats a piece the same way.
 */

/** How far a chair's centre stands out from the table edge: clear of the linen and the seat's depth. */
export const CHAIR_CENTRE_OUTSET_M = 0.45;
/** A banquet run's depth, for the runs a U or hollow square is made of. */
export const RUN_DEPTH_M = 0.75;
const CRESCENT_ARC = (4 * Math.PI) / 3;

/**
 * One straight run of table, `length` long, centred at `centre` and lying along x or (with `alongZ`) z. Its chairs sit on
 * its `outward` side (+1 or −1 across the run).
 */
export type TableRun = { id: string; length: number; centre: [number, number]; alongZ: boolean; outward: 1 | -1 };

/** A seated run: its chairs, and how far their centres stand from the run's centre line. */
export type SeatedRun = { run: TableRun; seats: number; offset: number };

/** `seats` shared across runs of the given lengths in proportion, the remainders going to the largest shares first. */
export function seatsAlong(seats: number, lengths: number[]): number[] {
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const shares = lengths.map((length) => (total > 0 ? (seats * length) / total : 0));
  const counts = shares.map(Math.floor);
  const order = shares.map((share, index) => ({ index, rest: share - Math.floor(share) })).sort((a, b) => b.rest - a.rest);
  const left = seats - counts.reduce((sum, value) => sum + value, 0);
  for (const { index } of order.slice(0, left)) counts[index]! += 1;
  return counts;
}

const alongX = (id: string, length: number, z: number, outward: 1 | -1): TableRun => ({ id, length, centre: [0, z], alongZ: false, outward });
const alongZ = (id: string, length: number, x: number, z: number, outward: 1 | -1): TableRun => ({ id, length, centre: [x, z], alongZ: true, outward });

/** The runs of a U (open at the front, +z) or a hollow square, each seated on its outside. */
export function joinedRuns(node: PrismTableNode): TableRun[] {
  const [halfW, halfD, inset] = [node.width / 2, node.depth / 2, RUN_DEPTH_M / 2];
  const square = node.shape === "hollow-square";
  const sideLength = node.depth - RUN_DEPTH_M * (square ? 2 : 1);
  const sideZ = square ? 0 : RUN_DEPTH_M / 2;
  const runs = [alongX("back", node.width, -halfD + inset, -1), alongZ("left", sideLength, -halfW + inset, sideZ, -1), alongZ("right", sideLength, halfW - inset, sideZ, 1)];
  return square ? [...runs, alongX("front", node.width, halfD - inset, 1)] : runs;
}

/**
 * A rectangular table's seated runs. `both` seats its long sides (the near side, +z, takes the odd seat), `one` its far
 * side only, facing the room as a presidential or sweetheart table, and `around` its sides and one seat at each end.
 */
export function banquetRuns(node: PrismTableNode): SeatedRun[] {
  const ends = node.seatSides === "around" && node.seats >= 2 ? 1 : 0;
  const sides = node.seats - 2 * ends;
  const near = node.seatSides === "one" ? 0 : Math.ceil(sides / 2);
  const [side, end] = [node.depth / 2 + CHAIR_CENTRE_OUTSET_M, node.width / 2 + CHAIR_CENTRE_OUTSET_M];
  return [
    { run: alongX("near", node.width, 0, 1), seats: near, offset: side },
    { run: alongX("far", node.width, 0, -1), seats: sides - near, offset: side },
    { run: alongZ("left", 0, 0, 0, -1), seats: ends, offset: end },
    { run: alongZ("right", 0, 0, 0, 1), seats: ends, offset: end },
  ];
}

/** A U's or hollow square's runs, its seats shared along them. */
export function joinedSeatedRuns(node: PrismTableNode): SeatedRun[] {
  const runs = joinedRuns(node);
  const seats = seatsAlong(node.seats, runs.map((run) => run.length));
  return runs.map((run, index) => ({ run, seats: seats[index]!, offset: RUN_DEPTH_M / 2 + CHAIR_CENTRE_OUTSET_M }));
}

/** The angle of a round table's first chair and the arc its chairs share: the whole ring, or a crescent open at +z. */
export function roundArc(node: PrismTableNode): { start: number; arc: number } {
  if (!node.crescent) return { start: 0, arc: 2 * Math.PI };
  return { start: (5 * Math.PI) / 6 + CRESCENT_ARC / (2 * Math.max(node.seats, 1)), arc: CRESCENT_ARC };
}

/** One chair: where its seat's centre stands and the unit direction its back faces (away from the table). */
export type SeatSpot = { x: number; z: number; away: [number, number] };

function runSpots({ run, seats, offset }: SeatedRun): SeatSpot[] {
  const [x, z] = run.centre;
  return Array.from({ length: seats }, (_, index) => {
    const along = -run.length / 2 + (run.length * (index + 0.5)) / seats;
    const out = run.outward * offset;
    return run.alongZ ? { x: x + out, z: z + along, away: [run.outward, 0] } : { x: x + along, z: z + out, away: [0, run.outward] };
  });
}

/** Every chair of a table, the way its 3D design seats them. A cocktail table has none. */
export function seatSpots(node: PrismTableNode): SeatSpot[] {
  switch (node.shape) {
    case "cocktail":
      return [];
    case "rect":
      return banquetRuns(node).flatMap(runSpots);
    case "u-shape":
    case "hollow-square":
      return joinedSeatedRuns(node).flatMap(runSpots);
    default: {
      const { start, arc } = roundArc(node);
      const reach = node.width / 2 + CHAIR_CENTRE_OUTSET_M;
      return Array.from({ length: node.seats }, (_, index) => {
        const angle = start + (arc * index) / node.seats;
        const [dx, dz] = [Math.cos(angle), Math.sin(angle)];
        return { x: reach * dx, z: reach * dz, away: [dx, dz] };
      });
    }
  }
}

/** Whether a table stands on a round footprint (a round dining or cocktail table). */
export const isRoundTable = (node: { type: string; shape?: unknown }) => node.type === "prism-table" && (node.shape === "round" || node.shape === "cocktail");

/** A classroom block's chairs sit a little behind their row's centre line, clear of the desk in front. */
const CLASSROOM_SETBACK = 0.12;

/**
 * Every chair of a seating block, rows front (−z) to back, columns split by the aisle, all facing the front with their
 * backs to the rear (+z).
 */
export function blockSeatSpots(node: PrismSeatingBlockNode): SeatSpot[] {
  const pitch = node.depth / node.rows;
  const across = (node.width - node.aisle) / node.columns;
  const half = Math.floor(node.columns / 2);
  const setback = node.style === "classroom" ? pitch * CLASSROOM_SETBACK : 0;
  return Array.from({ length: node.rows * node.columns }, (_, index) => {
    const [row, column] = [Math.floor(index / node.columns), index % node.columns];
    const aisle = column >= half && node.aisle > 0 ? node.aisle : 0;
    return { x: -node.width / 2 + across * (column + 0.5) + aisle, z: -node.depth / 2 + pitch * (row + 0.5) + setback, away: [0, 1] };
  });
}
