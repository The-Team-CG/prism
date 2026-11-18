import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismEventPiece } from "@prism/types";
import { barSymbol, danceFloorSymbol } from "./floor-and-bar-symbol";
import { seatingBlockSymbol } from "./seating-block-symbol";
import { smallPieceSymbol } from "./small-piece-symbol";
import { stageSymbol } from "./stage-symbol";
import { tableSymbol } from "./table-symbol";
import { zoneSymbol } from "./zone-symbol";

/** A piece's top-down event symbol, drawn about its centre and placed at its position and rotation. */
export function eventSymbol(node: PrismEventPiece, fallbackName: string): FloorplanGeometry {
  switch (node.type) {
    case "prism-table":
      return tableSymbol(node);
    case "prism-seating-block":
      return seatingBlockSymbol(node);
    case "prism-dance-floor":
      return danceFloorSymbol(node);
    case "prism-bar":
      return barSymbol(node);
    case "prism-zone":
      return zoneSymbol(node);
    case "prism-stage":
      return stageSymbol(node);
    default:
      return smallPieceSymbol(node, fallbackName);
  }
}
