import type { FloorplanGeometry } from "@pascal-app/core";

/** PRISM token colours (`@prism/tokens`), written out because Pascal draws the plan as plain SVG attributes. */
export const INK = { line: "#3a2f37", muted: "#9a8a93", surface: "#ffffff", tint: "#f4e5e0", page: "#fff8f2", accent: "#c01867" } as const;

export const CHAIR_WIDTH_M = 0.45;
export const CHAIR_DEPTH_M = 0.4;

const outline = { stroke: INK.line, strokeWidth: 1.25, vectorEffect: "non-scaling-stroke" } as const;

type Placed = { position: [number, number, number]; rotation: number };

/** A rectangle centred on the origin; `pointerEvents: all` keeps the whole piece clickable on the plan. */
export function centredRect(width: number, depth: number, style: Partial<{ fill: string; dashed: boolean }> = {}): FloorplanGeometry {
  return {
    kind: "rect",
    x: -width / 2,
    y: -depth / 2,
    width,
    height: depth,
    fill: style.fill ?? INK.surface,
    ...outline,
    ...(style.dashed ? { strokeDasharray: "6 4" } : {}),
    pointerEvents: "all",
  } as FloorplanGeometry;
}

/** One chair, centred at (x, y) and turned to face `angle`. */
export function chair(x: number, y: number, angle: number): FloorplanGeometry {
  return {
    kind: "group",
    transform: { translate: [x, y], rotate: angle },
    metadata: { part: "chair" },
    children: [{ kind: "rect", x: -CHAIR_WIDTH_M / 2, y: -CHAIR_DEPTH_M / 2, width: CHAIR_WIDTH_M, height: CHAIR_DEPTH_M, rx: 0.06, fill: INK.tint, ...outline } as FloorplanGeometry],
  };
}

/** Text that reads upright on screen however the plan is turned. */
export function label(text: string, y = 0, fontSize = 0.32): FloorplanGeometry {
  return { kind: "text", x: 0, y, text, fontSize, fill: INK.line, fontWeight: 600, textAnchor: "middle", dominantBaseline: "central", upright: true };
}

/** Places a symbol drawn about its centre at the piece's position and rotation. */
export function placed(node: Placed, children: FloorplanGeometry[]): FloorplanGeometry {
  return { kind: "group", transform: { translate: [node.position[0], node.position[2]], rotate: -node.rotation }, children };
}
