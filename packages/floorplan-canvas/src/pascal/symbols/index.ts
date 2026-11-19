import type { FloorplanGeometry, FloorplanPalette } from "@pascal-app/core";
import type { PrismEventPiece } from "@prism/types";
import { barSymbol, danceFloorSymbol } from "./floor-and-bar-symbol";
import { seatingBlockSymbol } from "./seating-block-symbol";
import { smallPieceSymbol } from "./small-piece-symbol";
import { stageSymbol } from "./stage-symbol";
import { tableSymbol } from "./table-symbol";
import { zoneSymbol } from "./zone-symbol";

/** What Pascal tells a kind about how the piece is shown: selected, highlighted or hovered, and the plan's palette. */
export type SymbolView = { selected?: boolean; highlighted?: boolean; hovered?: boolean; palette?: Partial<FloorplanPalette> };

function symbolOf(node: PrismEventPiece, fallbackName: string): FloorplanGeometry {
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

/** A selected or highlighted piece takes Pascal's selection outline and tint; a hovered one its hover stroke. */
function viewChrome(node: PrismEventPiece, view: SymbolView | undefined): FloorplanGeometry | null {
  const active = Boolean(view?.selected || view?.highlighted);
  const stroke = active ? (view?.palette?.selectedStroke ?? "#3b82f6") : view?.hovered ? (view.palette?.wallHoverStroke ?? "#93c5fd") : null;
  if (!stroke) return null;
  const round = node.type === "prism-table" && node.shape !== "rect";
  const style = { stroke, strokeWidth: 2, vectorEffect: "non-scaling-stroke", pointerEvents: "none", fill: active ? (view?.palette?.selectedFill ?? stroke) : "none", fillOpacity: 0.12 } as const;
  const pad = node.type === "prism-table" ? 0.75 : 0.05;
  return round
    ? ({ kind: "circle", cx: 0, cy: 0, r: node.width / 2 + pad, ...style } as FloorplanGeometry)
    : ({ kind: "rect", x: -node.width / 2 - pad, y: -node.depth / 2 - pad, width: node.width + 2 * pad, height: node.depth + 2 * pad, rx: 0.08, ...style } as FloorplanGeometry);
}

/** A piece's top-down event symbol, placed at its position and rotation, with Pascal's selection or hover chrome. */
export function eventSymbol(node: PrismEventPiece, fallbackName: string, view?: SymbolView): FloorplanGeometry {
  const symbol = symbolOf(node, fallbackName);
  const chrome = viewChrome(node, view);
  return chrome && symbol.kind === "group" ? { ...symbol, children: [...symbol.children, chrome] } : symbol;
}
