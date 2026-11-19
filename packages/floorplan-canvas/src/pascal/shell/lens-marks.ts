import { isHiddenInScene } from "@prism/floorplan-scene";
import { isRoundTable } from "../table-layout";
import { isPrismEventPieceType, type FloorplanSceneDocument } from "@prism/types";
import { tableFill, type PrismLens, type TableFill } from "../lens";

/** One shape the lens overlay draws over a piece: a table's fill, a muted piece, or an emphasised zone. */
export type LensMark = {
  id: string;
  look: TableFill | "muted" | "zone";
  round: boolean;
  x: number;
  y: number;
  rotation: number;
  width: number;
  depth: number;
};

type Piece = { id: string; type: string; shape?: unknown; position: [number, number, number]; rotation: number; width: number; depth: number; seats?: number; guestIds?: string[] };

/** Chairs reach about this far past a table's edge; muting a table covers them too. */
const CHAIR_REACH_M = 0.9;

function lookFor(piece: Piece, lens: PrismLens): LensMark["look"] {
  if (lens === "supplier-zones") return piece.type === "prism-zone" ? "zone" : "muted";
  return piece.type === "prism-table" ? tableFill(piece.seats ?? 0, piece.guestIds?.length ?? 0) : "muted";
}

function markFor(piece: Piece, lens: PrismLens): LensMark {
  const look = lookFor(piece, lens);
  const reach = look === "muted" && piece.type === "prism-table" ? CHAIR_REACH_M : 0;
  return {
    id: piece.id,
    look,
    round: isRoundTable(piece),
    x: piece.position[0],
    y: piece.position[2],
    rotation: piece.rotation,
    width: piece.width + reach,
    depth: piece.depth + reach,
  };
}

/**
 * What a lens draws over the plan. Seating fills each visible table by how full it is and mutes every other piece;
 * Supplier zones emphasises zones and mutes the rest. Layout draws nothing.
 */
export function lensMarks(scene: FloorplanSceneDocument, lens: PrismLens): LensMark[] {
  if (lens === "layout") return [];
  return Object.values(scene.nodes as Record<string, unknown>)
    .map((node) => node as Piece)
    .filter((piece) => isPrismEventPieceType(piece.type) && !isHiddenInScene(scene, piece.id))
    .map((piece) => markFor(piece, lens));
}
