import { placeableEventPieceSchemaFor, type PrismEventPiece } from "@prism/types";
import { eventPieceDefaults } from "../event-layout-plugin";
import { geometrySvg } from "../shell/print-documents";
import { eventSymbol } from "../symbols";
import type { LibraryItem } from "./catalog";

export type TileGlyph = { viewBox: string; body: string };

/** Room around the piece's footprint for the chairs drawn outside it. */
const CHAIR_ROOM_M = 0.7;

/**
 * The tile's piece as the plan draws it, centred and framed: a tile shows the real outline, chairs and all, so the
 * Library reads like the plan. Labels are left off at this size.
 */
export function tileGlyph(tile: LibraryItem): TileGlyph {
  const piece = placeableEventPieceSchemaFor(tile.kind).parse({ ...eventPieceDefaults(tile.kind), ...tile.preset, position: [0, 0, 0] }) as PrismEventPiece;
  const reach = Math.max(piece.width, piece.depth) / 2 + CHAIR_ROOM_M;
  const body = geometrySvg(eventSymbol(piece, "")).replace(/<text[^>]*>[^<]*<\/text>/g, "");
  return { viewBox: `${-reach} ${-reach} ${2 * reach} ${2 * reach}`, body };
}
