import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismTableNode } from "@prism/types";
import { CHAIR_DEPTH_M, CHAIR_STROKE, DASH, INK, PIECE_STROKE, centredRect, chair, isChairStyle, label, placed, type ChairStyle } from "./symbol-kit";

/** How far the linen hangs past the table top, and the gap between the linen and a chair. */
const LINEN_M = 0.06;
const CHAIR_GAP_M = 0.08;
const LINEN_OPACITY = 0.5;

/** The linen ring's colour by the card's linen, laid in lightly so the plan stays a drawing; black is lifted a little. */
export const LINEN_FILLS = { white: "#ffffff", ivory: "#f3ecd8", black: "#4a4247", blush: "#f0d6d6" } as const;

function linenFill(linen: string): string {
  if (!Object.hasOwn(LINEN_FILLS, linen)) throw new Error(`Unknown linen "${linen}"`);
  return LINEN_FILLS[linen as keyof typeof LINEN_FILLS];
}

function chairStyle(style: string): ChairStyle {
  if (!isChairStyle(style)) throw new Error(`Unknown chair style "${style}"`);
  return style;
}

function roundChairs(radius: number, seats: number, style: ChairStyle): FloorplanGeometry[] {
  const ring = radius + LINEN_M + CHAIR_GAP_M + CHAIR_DEPTH_M / 2;
  return Array.from({ length: seats }, (_, index) => {
    const angle = (2 * Math.PI * index) / seats - Math.PI / 2;
    return chair(Math.cos(angle) * ring, Math.sin(angle) * ring, angle + Math.PI / 2, style);
  });
}

/** A banquet table seats its long sides, the extra seat on the near side when the count is odd. */
function banquetChairs(width: number, depth: number, seats: number, style: ChairStyle): FloorplanGeometry[] {
  const offset = depth / 2 + LINEN_M + CHAIR_GAP_M + CHAIR_DEPTH_M / 2;
  const side = (count: number, y: number, angle: number) =>
    Array.from({ length: count }, (_, index) => chair(-width / 2 + (width * (index + 0.5)) / count, y, angle, style));
  const near = Math.ceil(seats / 2);
  return [...side(near, offset, 0), ...side(seats - near, -offset, Math.PI)];
}

function tableTop(node: PrismTableNode): FloorplanGeometry[] {
  const linen = linenFill(node.linen);
  if (node.shape === "rect") {
    return [{ ...centredRect(node.width + 2 * LINEN_M, node.depth + 2 * LINEN_M, { fill: linen, dashed: true }), ...CHAIR_STROKE, fillOpacity: LINEN_OPACITY } as FloorplanGeometry, centredRect(node.width, node.depth)];
  }
  const radius = node.width / 2;
  return [
    { kind: "circle", cx: 0, cy: 0, r: radius + LINEN_M, fill: linen, fillOpacity: LINEN_OPACITY, ...CHAIR_STROKE, strokeDasharray: DASH },
    { kind: "circle", cx: 0, cy: 0, r: radius, fill: INK.surface, ...PIECE_STROKE, pointerEvents: "all" } as FloorplanGeometry,
  ];
}

const tableName = (node: PrismTableNode) => (typeof node.label === "string" && node.label ? node.label : node.number ? `T${node.number}` : "");

/** A table from above: its chairs spaced by seat count in their style, the linen in its colour, the top and its number. */
export function tableSymbol(node: PrismTableNode & { label?: unknown }): FloorplanGeometry {
  const style = chairStyle(node.chairStyle);
  const chairs = node.shape === "rect" ? banquetChairs(node.width, node.depth, node.seats, style) : roundChairs(node.width / 2, node.seats, style);
  const name = tableName(node);
  return placed(node, [...chairs, ...tableTop(node), ...(name ? [label(name, 0, Math.min(0.4, node.width / 4))] : [])]);
}
