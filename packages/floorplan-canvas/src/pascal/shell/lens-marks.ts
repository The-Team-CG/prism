import { isHiddenInScene, layoutChecks } from "@prism/floorplan-scene";
import { isRoundTable } from "@prism/floorplan-scene";
import { isPrismEventPieceType, type FloorplanSceneDocument, type PrismLayoutIssue } from "@prism/types";
import { isCheckLens, tableFill, type PrismLens, type TableFill } from "../lens";

/** One shape the lens overlay draws over a piece: a table's fill, a muted piece, or an emphasised zone. */
export type LensMark = {
  id: string;
  look: TableFill | "muted" | "zone" | "issue";
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

function lookFor(piece: Piece, lens: PrismLens, flagged: ReadonlySet<string>): LensMark["look"] {
  if (isCheckLens(lens)) return flagged.has(piece.id) ? "issue" : "muted";
  if (lens === "supplier-zones") return piece.type === "prism-zone" ? "zone" : "muted";
  return piece.type === "prism-table" ? tableFill(piece.seats ?? 0, piece.guestIds?.length ?? 0) : "muted";
}

function markFor(piece: Piece, lens: PrismLens, flagged: ReadonlySet<string>): LensMark {
  const look = lookFor(piece, lens, flagged);
  const reach = (look === "muted" || look === "issue") && piece.type === "prism-table" ? CHAIR_REACH_M : 0;
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

/** What the layout checks find under a check lens: sight lines under Sightlines, everything else under Guest flow. */
export function lensIssues(scene: FloorplanSceneDocument, lens: PrismLens): PrismLayoutIssue[] {
  if (!isCheckLens(lens)) return [];
  return layoutChecks(scene).filter((issue) => (issue.kind === "sightline") === (lens === "sightlines"));
}

/**
 * What a lens draws over the plan. Seating fills each visible table by how full it is and mutes every other piece;
 * Supplier zones emphasises zones and mutes the rest; Sightlines and Guest flow mark the pieces their checks flag and mute
 * the rest. Layout draws nothing.
 */
export function lensMarks(scene: FloorplanSceneDocument, lens: PrismLens, issues: PrismLayoutIssue[] = lensIssues(scene, lens)): LensMark[] {
  if (lens === "layout") return [];
  const flagged = new Set(issues.flatMap((issue) => issue.pieceIds));
  return Object.values(scene.nodes as Record<string, unknown>)
    .map((node) => node as Piece)
    .filter((piece) => isPrismEventPieceType(piece.type) && !isHiddenInScene(scene, piece.id))
    .map((piece) => markFor(piece, lens, flagged));
}
