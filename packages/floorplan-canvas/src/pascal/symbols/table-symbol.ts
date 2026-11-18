import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismTableNode } from "@prism/types";
import { CHAIR_DEPTH_M, INK, centredRect, chair, label, placed } from "./symbol-kit";

/** How far the linen hangs past the table top, and the gap between the linen and a chair. */
const LINEN_M = 0.06;
const CHAIR_GAP_M = 0.08;

function roundChairs(radius: number, seats: number): FloorplanGeometry[] {
  const ring = radius + LINEN_M + CHAIR_GAP_M + CHAIR_DEPTH_M / 2;
  return Array.from({ length: seats }, (_, index) => {
    const angle = (2 * Math.PI * index) / seats - Math.PI / 2;
    return chair(Math.cos(angle) * ring, Math.sin(angle) * ring, angle + Math.PI / 2);
  });
}

/** A banquet table seats its long sides, the extra seat on the near side when the count is odd. */
function banquetChairs(width: number, depth: number, seats: number): FloorplanGeometry[] {
  const offset = depth / 2 + LINEN_M + CHAIR_GAP_M + CHAIR_DEPTH_M / 2;
  const side = (count: number, y: number, angle: number) =>
    Array.from({ length: count }, (_, index) => chair(-width / 2 + (width * (index + 0.5)) / count, y, angle));
  const near = Math.ceil(seats / 2);
  return [...side(near, offset, 0), ...side(seats - near, -offset, Math.PI)];
}

function tableTop(node: PrismTableNode): FloorplanGeometry[] {
  if (node.shape === "rect") {
    return [centredRect(node.width + 2 * LINEN_M, node.depth + 2 * LINEN_M, { fill: INK.page, dashed: true }), centredRect(node.width, node.depth)];
  }
  const radius = node.width / 2;
  return [
    { kind: "circle", cx: 0, cy: 0, r: radius + LINEN_M, fill: INK.page, stroke: INK.muted, strokeWidth: 1, strokeDasharray: "4 3", vectorEffect: "non-scaling-stroke" },
    { kind: "circle", cx: 0, cy: 0, r: radius, fill: INK.surface, stroke: INK.line, strokeWidth: 1.25, vectorEffect: "non-scaling-stroke", pointerEvents: "all" } as FloorplanGeometry,
  ];
}

const tableName = (node: PrismTableNode) => (typeof node.label === "string" && node.label ? node.label : node.number ? `T${node.number}` : "");

/** A table from above: its chairs spaced by seat count, the linen edge, the top and its number. */
export function tableSymbol(node: PrismTableNode & { label?: unknown }): FloorplanGeometry {
  const chairs = node.shape === "rect" ? banquetChairs(node.width, node.depth, node.seats) : roundChairs(node.width / 2, node.seats);
  const name = tableName(node);
  return placed(node, [...chairs, ...tableTop(node), ...(name ? [label(name, 0, Math.min(0.4, node.width / 4))] : [])]);
}
