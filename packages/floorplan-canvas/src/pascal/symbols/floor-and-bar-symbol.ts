import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismBarNode, PrismDanceFloorNode } from "@prism/types";
import { CHAIR_STROKE, INK, PIECE_STROKE, centredRect, label, placed } from "./symbol-kit";

/** A dance floor drawn as its 1 m panels. */
export function danceFloorSymbol(node: PrismDanceFloorNode): FloorplanGeometry {
  const lines = (count: number, along: "x" | "y"): FloorplanGeometry[] =>
    Array.from({ length: Math.max(0, Math.ceil(count) - 1) }, (_, index) => {
      const at = -count / 2 + index + 1;
      const [x1, y1, x2, y2] = along === "x" ? [at, -node.depth / 2, at, node.depth / 2] : [-node.width / 2, at, node.width / 2, at];
      return { kind: "line", x1, y1, x2, y2, ...CHAIR_STROKE };
    });
  return placed(node, [centredRect(node.width, node.depth, { fill: INK.page }), ...lines(node.width, "x"), ...lines(node.depth, "y"), label("Dance floor")]);
}

/** A straight bar, or an L whose arms are the bar's width and depth, each as deep as a counter. */
export function barSymbol(node: PrismBarNode): FloorplanGeometry {
  if (node.shape === "straight") return placed(node, [centredRect(node.width, node.depth, { fill: INK.tint }), label("Bar", 0, 0.4)]);
  const counter = Math.min(0.8, node.width / 2, node.depth / 2);
  const [w, d] = [node.width / 2, node.depth / 2];
  const points: [number, number][] = [[-w, -d], [w, -d], [w, -d + counter], [-w + counter, -d + counter], [-w + counter, d], [-w, d]];
  return placed(node, [
    { kind: "polygon", points, fill: INK.tint, ...PIECE_STROKE, pointerEvents: "all" } as FloorplanGeometry,
    label("Bar", -d + counter / 2, 0.4),
  ]);
}
