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

/**
 * Presentation colours: each piece drawn in what it is made of, as event planning tools lay out a room, matching the
 * 3D materials. Linework stays in ink; fills carry the finish.
 */
export const LOOK = {
  shadow: "#18131a",
  stage: "#3a3238",
  stageStep: "#5a5157",
  stageDrop: "#1f1b1e",
  onDark: "#ffffff",
  barWood: "#7a573d",
  barTop: "#ece9e4",
  parquet: "#dcc3a1",
  parquetLine: "#c6a47b",
  checker: "#2a2629",
  led: "#ece8f6",
  number: "#3d332d",
  gold: "#d6ad62",
  china: "#ffffff",
} as const;

/** A colour darkened toward black by `amount` (0–1): a cloth's edge line from its fill. */
export function shade(hex: string, amount: number): string {
  const channel = (offset: number) => Math.round(parseInt(hex.slice(offset, offset + 2), 16) * (1 - amount));
  return `#${[1, 3, 5].map((offset) => channel(offset).toString(16).padStart(2, "0")).join("")}`;
}

/** A soft drop shadow under a piece: the same outline, offset and laid in at low opacity. */
export function shadowOf(geometry: FloorplanGeometry): FloorplanGeometry {
  return { kind: "group", transform: { translate: [0.05, 0.08] }, children: [{ ...geometry, fill: LOOK.shadow, fillOpacity: 0.12, stroke: "none" } as FloorplanGeometry] };
}


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

/** What a chair of each style looks like from above: its seat, and the frame that outlines it and forms its back. */
const CHAIR_PAINT: Record<ChairStyle, { seat: string; frame: string; seatOpacity?: number }> = {
  chiavari: { seat: "#efe6d0", frame: "#b8913f" },
  tiffany: { seat: "#f4efe4", frame: "#cfc8bd" },
  banquet: { seat: "#5b2333", frame: "#9aa0a6" },
  ghost: { seat: "#dfe7ec", frame: "#9fb0ba", seatOpacity: 0.55 },
  "cross-back": { seat: "#d9cbb3", frame: "#a87b52" },
  covered: { seat: "#f6f4ef", frame: "#cfc7bb" },
};

type Paint = (typeof CHAIR_PAINT)[ChairStyle];
const frameStroke = (paint: Paint) => ({ stroke: paint.frame, strokeWidth: 0.014 });

const seatRect = (paint: Paint, rx = 0.06): FloorplanGeometry =>
  ({ kind: "rect", x: -CHAIR_WIDTH_M / 2, y: -CHAIR_DEPTH_M / 2, width: CHAIR_WIDTH_M, height: CHAIR_DEPTH_M, rx, fill: paint.seat, fillOpacity: paint.seatOpacity ?? 1, ...frameStroke(paint) }) as FloorplanGeometry;
const seatDisc = (paint: Paint): FloorplanGeometry =>
  ({ kind: "circle", cx: 0, cy: 0, r: CHAIR_DEPTH_M / 2, fill: paint.seat, fillOpacity: paint.seatOpacity ?? 1, ...frameStroke(paint) }) as FloorplanGeometry;
/** The chair back: a bar in the frame's colour along the chair's edge away from the table (+y in the chair's frame). */
const back = (paint: Paint): FloorplanGeometry =>
  ({ kind: "rect", x: -CHAIR_WIDTH_M / 2 + 0.02, y: CHAIR_DEPTH_M / 2 - 0.03, width: CHAIR_WIDTH_M - 0.04, height: 0.06, rx: 0.025, fill: paint.frame }) as FloorplanGeometry;
const line = (paint: Paint, x1: number, y1: number, x2: number, y2: number): FloorplanGeometry => ({ kind: "line", x1, y1, x2, y2, stroke: paint.frame, strokeWidth: 0.012 }) as FloorplanGeometry;
const cross = (paint: Paint): FloorplanGeometry[] => [line(paint, -0.12, -0.1, 0.12, 0.1), line(paint, 0.12, -0.1, -0.12, 0.1)];
const spindles = (paint: Paint): FloorplanGeometry[] => [-0.08, 0, 0.08].map((x) => line(paint, x, 0.04, x, CHAIR_DEPTH_M / 2 - 0.03));
/** A sash's bow: a small filled knot on the chair's back. */
const bow = (fill: string): FloorplanGeometry => ({ kind: "circle", cx: 0, cy: CHAIR_DEPTH_M / 2 + 0.03, r: 0.055, fill, stroke: shade(fill, 0.25), strokeWidth: 0.008 }) as FloorplanGeometry;

/**
 * How each chair style reads from above, in its own colours: chiavari a round ivory cushion on gold, tiffany a round seat
 * with its spindles, ghost a clear round seat, banquet a square padded seat, cross-back a square seat with its X, and a
 * covered chair a soft square cover.
 */
const CHAIR_LOOKS: Record<ChairStyle, (paint: Paint) => FloorplanGeometry[]> = {
  chiavari: (paint) => [seatDisc(paint), back(paint)],
  tiffany: (paint) => [seatDisc(paint), ...spindles(paint), back(paint)],
  ghost: (paint) => [seatDisc(paint), back(paint)],
  banquet: (paint) => [seatRect(paint), back(paint)],
  "cross-back": (paint) => [seatRect(paint), ...cross(paint), back(paint)],
  covered: (paint) => [seatRect(paint, 0.12), back(paint)],
};

/** The turn that points a chair's back (+y in its frame) along (dx, dy); the plan's rotate is clockwise in y-down space. */
export const facingAway = (dx: number, dy: number) => Math.atan2(-dx, dy);

/** One chair, centred at (x, y), turned by `angle` (see `facingAway`) and drawn in its style, with its sash's bow. */
export function chair(x: number, y: number, angle: number, style: ChairStyle, sashFill?: string): FloorplanGeometry {
  const children = [...CHAIR_LOOKS[style](CHAIR_PAINT[style]), ...(sashFill ? [bow(sashFill)] : [])];
  return { kind: "group", transform: { translate: [x, y], rotate: angle }, metadata: { part: "chair", style }, children };
}

/** Text that reads upright on screen however the plan is turned. */
export function label(text: string, y = 0, fontSize = 0.32, look: { fill?: string; weight?: number } = {}): FloorplanGeometry {
  return { kind: "text", x: 0, y, text, fontSize, fill: look.fill ?? INK.text, fontWeight: look.weight ?? 500, textAnchor: "middle", dominantBaseline: "central", upright: true };
}

/** Places a symbol drawn about its centre at the piece's position and rotation. */
export function placed(node: Placed, children: FloorplanGeometry[]): FloorplanGeometry {
  return { kind: "group", transform: { translate: [node.position[0], node.position[2]], rotate: -node.rotation }, children };
}
