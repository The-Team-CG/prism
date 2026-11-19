import type { FloorplanGeometry } from "@pascal-app/core";
import type { ChairStyle } from "../dressing";

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
const line = (x1: number, y1: number, x2: number, y2: number): FloorplanGeometry => ({ kind: "line", x1, y1, x2, y2, ...CHAIR_STROKE }) as FloorplanGeometry;
const cross = (): FloorplanGeometry[] => [line(-0.12, -0.1, 0.12, 0.1), line(0.12, -0.1, -0.12, 0.1)];
const spindles = (): FloorplanGeometry[] => [-0.08, 0, 0.08].map((x) => line(x, 0.04, x, CHAIR_DEPTH_M / 2 - 0.02));
/** A sash's bow: a small filled knot on the chair's back. */
const bow = (fill: string): FloorplanGeometry => ({ kind: "circle", cx: 0, cy: CHAIR_DEPTH_M / 2 + 0.03, r: 0.05, fill, ...CHAIR_STROKE }) as FloorplanGeometry;

/**
 * How each chair style reads from above, by shape alone as a drafting symbol: chiavari is a round seat, tiffany a round
 * seat with its spindles, ghost a dashed round seat, banquet a square padded seat, cross-back a square seat with its X,
 * and a covered chair a square seat drawn with a heavier rounded cover.
 */
const CHAIR_LOOKS: Record<ChairStyle, () => FloorplanGeometry[]> = {
  chiavari: () => [seatDisc(), back()],
  tiffany: () => [seatDisc(), ...spindles(), back()],
  ghost: () => [seatDisc({ strokeDasharray: "0.04 0.03" }), back()],
  banquet: () => [seatRect(), back()],
  "cross-back": () => [seatRect(), ...cross(), back()],
  covered: () => [{ ...seatRect(), rx: 0.12, fill: INK.page } as FloorplanGeometry, back()],
};

/** The turn that points a chair's back (+y in its frame) along (dx, dy); the plan's rotate is clockwise in y-down space. */
export const facingAway = (dx: number, dy: number) => Math.atan2(-dx, dy);

/** One chair, centred at (x, y), turned by `angle` (see `facingAway`) and drawn in its style, with its sash's bow. */
export function chair(x: number, y: number, angle: number, style: ChairStyle, sashFill?: string): FloorplanGeometry {
  const children = [...CHAIR_LOOKS[style](), ...(sashFill ? [bow(sashFill)] : [])];
  return { kind: "group", transform: { translate: [x, y], rotate: angle }, metadata: { part: "chair", style }, children };
}

/** Text that reads upright on screen however the plan is turned. */
export function label(text: string, y = 0, fontSize = 0.32): FloorplanGeometry {
  return { kind: "text", x: 0, y, text, fontSize, fill: INK.text, fontWeight: 500, textAnchor: "middle", dominantBaseline: "central", upright: true };
}

/** Places a symbol drawn about its centre at the piece's position and rotation. */
export function placed(node: Placed, children: FloorplanGeometry[]): FloorplanGeometry {
  return { kind: "group", transform: { translate: [node.position[0], node.position[2]], rotate: -node.rotation }, children };
}
