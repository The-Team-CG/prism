import type { FloorplanGeometry } from "@pascal-app/core";

/**
 * Pascal's drafting palette (`item/plan-symbols` in `@pascal-app/nodes`), so event pieces read as the same drawing as
 * Pascal's own furniture: near-black linework for the pieces, thin light grey for chairs, white fills, grey tints.
 */
export const INK = { line: "#1f2937", muted: "#9ca3af", surface: "#ffffff", tint: "#f3f4f6", page: "#f9fafb", text: "#111827" } as const;

/** Stroke weights in plan metres, as Pascal draws them; they scale with the plan like its walls. */
export const PIECE_STROKE = { stroke: INK.line, strokeWidth: 0.012 } as const;
export const CHAIR_STROKE = { stroke: INK.muted, strokeWidth: 0.008 } as const;
export const DASH = "0.08 0.05";

export const CHAIR_WIDTH_M = 0.45;
export const CHAIR_DEPTH_M = 0.4;


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
    ...PIECE_STROKE,
    ...(style.dashed ? { strokeDasharray: DASH } : {}),
    pointerEvents: "all",
  } as FloorplanGeometry;
}

export const CHAIR_STYLES = ["chiavari", "banquet", "ghost", "cross-back"] as const;
export type ChairStyle = (typeof CHAIR_STYLES)[number];

export function isChairStyle(value: string): value is ChairStyle {
  return (CHAIR_STYLES as readonly string[]).includes(value);
}

const seatRect = (extras: { strokeDasharray?: string } = {}): FloorplanGeometry =>
  ({ kind: "rect", x: -CHAIR_WIDTH_M / 2, y: -CHAIR_DEPTH_M / 2, width: CHAIR_WIDTH_M, height: CHAIR_DEPTH_M, rx: 0.06, fill: INK.surface, ...CHAIR_STROKE, ...extras }) as FloorplanGeometry;
const seatDisc = (extras: { strokeDasharray?: string } = {}): FloorplanGeometry =>
  ({ kind: "circle", cx: 0, cy: 0, r: CHAIR_DEPTH_M / 2, fill: INK.surface, ...CHAIR_STROKE, ...extras }) as FloorplanGeometry;
/** The chair back: a bar along the chair's edge away from the table (+y in the chair's frame). */
const back = (): FloorplanGeometry =>
  ({
    kind: "rect",
    x: -CHAIR_WIDTH_M / 2 + 0.02,
    y: CHAIR_DEPTH_M / 2 - 0.02,
    width: CHAIR_WIDTH_M - 0.04,
    height: 0.05,
    rx: 0.02,
    fill: INK.tint,
    ...CHAIR_STROKE,
  }) as FloorplanGeometry;
const cross = (): FloorplanGeometry[] =>
  [1, -1].map((sign) => ({ kind: "line", x1: -0.12 * sign, y1: -0.1, x2: 0.12 * sign, y2: 0.1, ...CHAIR_STROKE }) as FloorplanGeometry);

/**
 * How each chair style reads from above, by shape alone as a drafting symbol: chiavari is a round seat, ghost a dashed
 * round seat, banquet a square padded seat, cross-back a square seat with its X.
 */
const CHAIR_LOOKS: Record<ChairStyle, () => FloorplanGeometry[]> = {
  chiavari: () => [seatDisc(), back()],
  ghost: () => [seatDisc({ strokeDasharray: "0.04 0.03" }), back()],
  banquet: () => [seatRect(), back()],
  "cross-back": () => [seatRect(), ...cross(), back()],
};

/** One chair, centred at (x, y), turned to face `angle` and drawn in its style. */
export function chair(x: number, y: number, angle: number, style: ChairStyle): FloorplanGeometry {
  return { kind: "group", transform: { translate: [x, y], rotate: angle }, metadata: { part: "chair", style }, children: CHAIR_LOOKS[style]() };
}

/** Text that reads upright on screen however the plan is turned. */
export function label(text: string, y = 0, fontSize = 0.32): FloorplanGeometry {
  return { kind: "text", x: 0, y, text, fontSize, fill: INK.text, fontWeight: 500, textAnchor: "middle", dominantBaseline: "central", upright: true };
}

/** Places a symbol drawn about its centre at the piece's position and rotation. */
export function placed(node: Placed, children: FloorplanGeometry[]): FloorplanGeometry {
  return { kind: "group", transform: { translate: [node.position[0], node.position[2]], rotate: -node.rotation }, children };
}
