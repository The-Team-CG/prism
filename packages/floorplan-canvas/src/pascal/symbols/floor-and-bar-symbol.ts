import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismBarNode, PrismDanceFloorNode } from "@prism/types";
import { CHAIR_STROKE, INK, LOOK, PIECE_STROKE, centredRect, label, placed, shadowOf } from "./symbol-kit";

const MAX_TILES = 8;

/** The panel lines of a dance floor, a metre apart. */
function panelLines(node: PrismDanceFloorNode): FloorplanGeometry[] {
  const lines = (count: number, along: "x" | "y"): FloorplanGeometry[] =>
    Array.from({ length: Math.max(0, Math.ceil(count) - 1) }, (_, index) => {
      const at = -count / 2 + index + 1;
      const [x1, y1, x2, y2] = along === "x" ? [at, -node.depth / 2, at, node.depth / 2] : [-node.width / 2, at, node.width / 2, at];
      return { kind: "line", x1, y1, x2, y2, stroke: node.finish === "parquet" ? LOOK.parquetLine : INK.muted, strokeWidth: 0.008 };
    });
  return [...lines(node.width, "x"), ...lines(node.depth, "y")];
}

/** A checked floor's dark tiles, as its 3D design lays them (about a metre square, at most eight a side). */
function darkTiles(node: PrismDanceFloorNode): FloorplanGeometry[] {
  const columns = Math.min(MAX_TILES, Math.max(1, Math.ceil(node.width)));
  const rows = Math.min(MAX_TILES, Math.max(1, Math.ceil(node.depth)));
  const [w, d] = [node.width / columns, node.depth / rows];
  return Array.from({ length: columns * rows }, (_, index) => [index % columns, Math.floor(index / columns)] as const)
    .filter(([column, row]) => (column + row) % 2 === 1)
    .map(([column, row]) => ({ kind: "rect", x: -node.width / 2 + column * w, y: -node.depth / 2 + row * d, width: w, height: d, fill: LOOK.checker, fillOpacity: 0.9 }) as FloorplanGeometry);
}

const FLOOR_FILLS = { parquet: LOOK.parquet, white: INK.surface, led: LOOK.led, checker: INK.surface } as const;

/** A dance floor in its finish: its panels, or its checks. */
export function danceFloorSymbol(node: PrismDanceFloorNode): FloorplanGeometry {
  const pattern = node.finish === "checker" ? darkTiles(node) : panelLines(node);
  const floor = centredRect(node.width, node.depth, { fill: FLOOR_FILLS[node.finish] });
  const name = node.finish === "led" ? "LED dance floor" : "Dance floor";
  return placed(node, [floor, ...pattern, label(name, 0, 0.32, { fill: node.finish === "checker" ? LOOK.onDark : LOOK.number, weight: 600 })]);
}

/** A bar's stools along its guest side, as its 3D design stands them. */
function stools(node: PrismBarNode): FloorplanGeometry[] {
  const counter = Math.min(0.8, node.width / 2, node.depth / 2);
  const lShape = node.shape === "l";
  const [start, span] = lShape ? [-node.width / 2 + counter, node.width - counter] : [-node.width / 2, node.width];
  const y = (lShape ? -node.depth / 2 + counter : node.depth / 2) + 0.4;
  return Array.from({ length: node.stools }, (_, index) => ({ kind: "circle", cx: start + (span * (index + 0.5)) / node.stools, cy: y, r: 0.19, fill: "#2b2b2b", stroke: LOOK.gold, strokeWidth: 0.02 }) as FloorplanGeometry);
}

/** A back bar behind the bartenders, a service gap behind the counter. */
const backBar = (node: PrismBarNode): FloorplanGeometry[] =>
  node.backBar ? [{ kind: "group", transform: { translate: [0, -node.depth / 2 - 1.15] }, children: [centredRect(node.width, 0.5, { fill: LOOK.barWood })] }] : [];

/** A straight bar, or an L whose arms are the bar's width and depth, each as deep as a counter; its stools and back bar. */
export function barSymbol(node: PrismBarNode): FloorplanGeometry {
  const extras = [...stools(node), ...backBar(node)];
  if (node.shape === "straight") {
    const counter = { ...centredRect(node.width, node.depth, { fill: LOOK.barTop }), stroke: LOOK.barWood, strokeWidth: 0.05 } as FloorplanGeometry;
    return placed(node, [...extras, shadowOf(counter), counter, label("Bar", 0, 0.4, { fill: LOOK.barWood, weight: 600 })]);
  }
  const counter = Math.min(0.8, node.width / 2, node.depth / 2);
  const [w, d] = [node.width / 2, node.depth / 2];
  const points: [number, number][] = [[-w, -d], [w, -d], [w, -d + counter], [-w + counter, -d + counter], [-w + counter, d], [-w, d]];
  return placed(node, [
    ...extras,
    shadowOf({ kind: "polygon", points } as FloorplanGeometry),
    { kind: "polygon", points, fill: LOOK.barTop, stroke: LOOK.barWood, strokeWidth: 0.05, pointerEvents: "all" } as FloorplanGeometry,
    label("Bar", -d + counter / 2, 0.4, { fill: LOOK.barWood, weight: 600 }),
  ]);
}
