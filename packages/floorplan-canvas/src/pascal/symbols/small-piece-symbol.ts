import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismPieceNode } from "@prism/types";
import { DASH, LOOK, label, placed, shade, shadowOf } from "./symbol-kit";

/**
 * Every other piece drawn as itself from above, in the presentation colours of its 3D finish: a buffet's chafing dishes on
 * its cloth, a speaker's driver, a plant's leaves, the cross on a first aid point. Each drawing is centred on the piece,
 * its front (the guest side) toward +y. A piece with no drawing of its own is its footprint, filled and named.
 */

type Draw = (w: number, d: number) => FloorplanGeometry[];

const COLOR = {
  wood: "#a87b52",
  woodDark: "#7a573d",
  linen: "#fbfaf6",
  steel: "#c9ccd1",
  steelDark: "#8e949b",
  black: "#262325",
  glow: "#ffd58a",
  green: "#6f8f5c",
  greenDark: "#56704a",
  blossom: "#f1d3d3",
  blush: "#ecc9c6",
  gold: LOOK.gold,
  cream: "#efe6d0",
  red: "#c4242b",
  exit: "#1f8a4c",
  blue: "#2f6fb3",
  marking: "#1d6fd1",
  yellow: "#e8c22c",
  olive: "#56684a",
  boucle: "#e9e2d8",
  rug: "#d8cfc1",
  velvet: "#6b2335",
  white: "#ffffff",
  screen: "#fbfbfb",
  canvas: "#f4f1ea",
} as const;

const rect = (x: number, y: number, w: number, h: number, fill: string, extras: Record<string, unknown> = {}): FloorplanGeometry =>
  ({ kind: "rect", x: x - w / 2, y: y - h / 2, width: w, height: h, fill, stroke: shade(fill, 0.22), strokeWidth: 0.012, ...extras }) as FloorplanGeometry;
const disc = (cx: number, cy: number, r: number, fill: string, extras: Record<string, unknown> = {}): FloorplanGeometry =>
  ({ kind: "circle", cx, cy, r, fill, stroke: shade(fill, 0.22), strokeWidth: 0.01, ...extras }) as FloorplanGeometry;
const stroke = (x1: number, y1: number, x2: number, y2: number, color: string, width = 0.02): FloorplanGeometry =>
  ({ kind: "line", x1, y1, x2, y2, stroke: color, strokeWidth: width, strokeLinecap: "round" }) as FloorplanGeometry;
/** The whole footprint as the clickable body, with a soft shadow under it. */
const body = (w: number, d: number, fill: string, extras: Record<string, unknown> = {}): FloorplanGeometry[] => {
  const shape = { ...rect(0, 0, w, d, fill, extras), pointerEvents: "all" } as FloorplanGeometry;
  return [shadowOf(shape), shape];
};
const roundBody = (w: number, d: number, fill: string): FloorplanGeometry[] => {
  const shape = { ...disc(0, 0, Math.min(w, d) / 2, fill), pointerEvents: "all" } as FloorplanGeometry;
  return [shadowOf(shape), shape];
};
/** `count` evenly spaced positions across a span centred on 0. */
const across = (span: number, count: number) => Array.from({ length: count }, (_, index) => -span / 2 + (span * (index + 0.5)) / count);
const fit = (span: number, pitch: number) => Math.max(1, Math.min(12, Math.floor(span / pitch)));

/** A counter in wood with a lighter top along its front. */
const counter: Draw = (w, d) => [...body(w, d, COLOR.woodDark), rect(0, d * 0.12, w - 0.06, d * 0.6, COLOR.wood)];

/** A clothed serving table. */
const clothed: Draw = (w, d) => body(w, d, COLOR.linen);

const DRAWINGS: Record<string, Draw> = {
  desk: counter,
  "foh-desk": (w, d) => [...counter(w, d), ...across(w * 0.6, 3).map((x) => rect(x, -d * 0.15, 0.32, 0.22, COLOR.black))],
  "bag-check": (w, d) => [...counter(w, d * 0.55).map((shape) => ({ kind: "group", transform: { translate: [0, d * 0.22] }, children: [shape] }) as FloorplanGeometry), rect(0, -d * 0.33, w, d * 0.3, COLOR.wood), ...across(w, fit(w, 0.4)).map((x) => stroke(x, -d * 0.48, x, -d * 0.18, COLOR.woodDark, 0.012))],
  booth: (w, d) => [
    ...body(w, d, COLOR.canvas),
    rect(0, -d / 2 + 0.03, w, 0.06, COLOR.white),
    rect(-w / 2 + 0.03, 0, 0.06, d, COLOR.white),
    rect(w / 2 - 0.03, 0, 0.06, d, COLOR.white),
    rect(0, d / 2 - 0.03, w, 0.06, "#be185d"),
    rect(0, d / 2 - 0.35, w * 0.6, 0.5, COLOR.wood),
  ],
  buffet: (w, d) => [...clothed(w, d), ...across(w * 0.92, fit(w, 0.7)).map((x) => rect(x, d * 0.12, 0.48, 0.3, COLOR.steel, { rx: 0.08 })), rect(0, -d * 0.3, w * 0.8, 0.18, COLOR.steelDark)],
  dessert: (w, d) => [...clothed(w, d), ...across(w * 0.9, 3).flatMap((x) => [disc(x, 0, 0.16, COLOR.white), disc(x, 0, 0.1, COLOR.blush)])],
  "cake-table": (w, d) => [...roundBody(w, d, COLOR.linen), disc(0, 0, 0.22, COLOR.white), disc(0, 0, 0.16, "#fbf6ef"), disc(0, 0, 0.1, COLOR.blush)],
  grazing: (w, d) => [...clothed(w, d), rect(0, 0, w * 0.86, d * 0.6, COLOR.wood, { rx: 0.05 }), ...across(w * 0.8, fit(w, 0.25)).map((x, index) => disc(x, (index % 2 ? 0.08 : -0.08) * d, 0.07, index % 3 ? "#c98b4a" : COLOR.green))],
  carving: (w, d) => [...clothed(w, d), rect(0, 0, w * 0.75, d * 0.55, COLOR.wood, { rx: 0.05 }), rect(0, 0, w * 0.6, d * 0.36, "#8a4417", { rx: d * 0.18 })],
  "led-wall": (w, d) => [...body(w, d, COLOR.black), rect(0, d * 0.3, w - 0.04, d * 0.2, "#7d6cf0", { stroke: "none" })],
  "projection-screen": (w, d) => [...body(w, d * 0.35, COLOR.screen, { stroke: COLOR.black, strokeWidth: 0.03 }), stroke(-w / 2, 0, -w / 2, d * 0.45, COLOR.black, 0.03), stroke(w / 2, 0, w / 2, d * 0.45, COLOR.black, 0.03)],
  speaker: (w, d) => [...body(w, d, COLOR.black, { rx: 0.04 }), disc(0, d * 0.08, Math.min(w, d) * 0.3, "#3a3639"), disc(0, d * 0.08, Math.min(w, d) * 0.12, "#5a5559")],
  uplight: (w, d) => [disc(0, 0, Math.max(w, d) * 1.6, COLOR.glow, { fillOpacity: 0.28, stroke: "none" }), ...roundBody(w, d, COLOR.black)],
  "lighting-truss": (w, d) => [...body(w, d, COLOR.steel, { fill: "none", stroke: COLOR.steelDark, strokeWidth: 0.03 }), ...across(w, fit(w, 0.5)).map((x) => stroke(x - 0.25, -d / 2, x + 0.25, d / 2, COLOR.steelDark, 0.015)), ...across(w, fit(w, 1.5)).map((x) => disc(x, 0, 0.12, COLOR.black))],
  podium: (w, d) => [...body(w, d, COLOR.woodDark), rect(0, -d * 0.1, w * 0.85, d * 0.55, COLOR.wood)],
  "camera-riser": (w, d) => [...body(w, d, "#5a5157"), disc(0, 0, 0.14, COLOR.black), stroke(0, 0, 0, d * 0.35, COLOR.black, 0.03)],
  arch: (w, d) => [
    disc(-w / 2 + 0.06, 0, 0.07, COLOR.gold),
    disc(w / 2 - 0.06, 0, 0.07, COLOR.gold),
    { ...stroke(-w / 2 + 0.06, 0, w / 2 - 0.06, 0, COLOR.gold, 0.06), pointerEvents: "all" } as FloorplanGeometry,
    ...across(w, 7).flatMap((x, index) => [disc(x, index % 2 ? 0.07 : -0.07, 0.15, COLOR.green), disc(x, 0, 0.11, COLOR.blossom)]),
  ],
  backdrop: (w, d) => [...body(w, d, COLOR.blush), stroke(-w / 2, d / 2, w / 2, d / 2, COLOR.gold, 0.04)],
  "photo-booth": (w, d) => [...body(w, d, COLOR.canvas, { strokeDasharray: DASH }), rect(0, -d / 2 + 0.06, w, 0.1, COLOR.blush), rect(0, d / 2 - 0.4, 0.5, 0.4, COLOR.black, { rx: 0.05 }), disc(0, d / 2 - 0.25, 0.06, COLOR.glow)],
  lounge: (w, d) => [
    ...body(w, d, COLOR.rug, { rx: 0.08 }),
    rect(0, -d / 2 + 0.45, Math.min(2.2, w - 1.6), 0.8, COLOR.boucle, { rx: 0.12 }),
    rect(-w / 2 + 0.45, d / 2 - 0.75, 0.8, 0.8, COLOR.boucle, { rx: 0.12 }),
    rect(w / 2 - 0.45, d / 2 - 0.75, 0.8, 0.8, COLOR.boucle, { rx: 0.12 }),
    rect(0, d / 2 - 0.75, 0.9, 0.55, COLOR.wood, { rx: 0.05 }),
  ],
  plant: (w, d) => {
    const r = Math.min(w, d) / 2;
    const leaves: Array<[number, number, number]> = [[0, 0, 0.62], [0.36, 0.1, 0.48], [-0.34, 0.14, 0.46], [0.06, -0.36, 0.48], [-0.1, 0.36, 0.44]];
    return [...roundBody(w, d, COLOR.greenDark), ...leaves.map(([x, y, s]) => disc(x * r, y * r, s * r, COLOR.green))];
  },
  umbrella: (w, d) => {
    const r = Math.min(w, d) / 2;
    return [...roundBody(w, d, COLOR.cream), ...across(2 * Math.PI, 8).map((angle) => stroke(0, 0, Math.cos(angle) * r, Math.sin(angle) * r, shade(COLOR.cream, 0.2), 0.015)), disc(0, 0, 0.06, COLOR.woodDark)];
  },
  "string-lights": (w, d) => {
    const strands = Math.max(1, Math.min(6, Math.floor(d / 3)));
    const ys = across(d, strands);
    return [
      { ...rect(0, 0, w, d, COLOR.glow, { fillOpacity: 0.08, stroke: COLOR.glow, strokeDasharray: DASH }), pointerEvents: "all" } as FloorplanGeometry,
      ...ys.flatMap((y) => [stroke(-w / 2, y, w / 2, y, "#8a7a5a", 0.012), ...across(w, Math.min(16, Math.floor(w / 0.6))).map((x) => disc(x, y, 0.06, COLOR.glow, { stroke: "#c9a356" }))]),
    ];
  },
  throne: (w, d) => [...body(w, d, COLOR.gold, { rx: 0.06 }), rect(0, d * 0.08, w * 0.7, d * 0.62, COLOR.velvet, { rx: 0.06 }), rect(0, -d / 2 + 0.08, w, 0.16, COLOR.gold)],
  "gift-table": (w, d) => [...clothed(w, d), ...across(w * 0.8, fit(w, 0.35)).map((x, index) => rect(x, (index % 2 ? 0.08 : -0.06) * d, 0.24, 0.2, index % 2 ? COLOR.blush : COLOR.white)), rect(w * 0.35, 0, 0.18, 0.18, COLOR.gold)],
  "welcome-sign": (w, d) => [stroke(-w * 0.35, d * 0.3, 0, -d * 0.3, COLOR.woodDark, 0.03), stroke(w * 0.35, d * 0.3, 0, -d * 0.3, COLOR.woodDark, 0.03), { ...rect(0, 0, w * 0.9, 0.06, COLOR.white), pointerEvents: "all" } as FloorplanGeometry],
  extinguisher: (w, d) => [...roundBody(w, d, COLOR.red), disc(0, 0, Math.min(w, d) * 0.18, COLOR.black)],
  "first-aid": (w, d) => [...body(w, d, COLOR.white), rect(0, 0, Math.min(w, d) * 0.5, Math.min(w, d) * 0.16, COLOR.red, { stroke: "none" }), rect(0, 0, Math.min(w, d) * 0.16, Math.min(w, d) * 0.5, COLOR.red, { stroke: "none" })],
  "emergency-exit": (w, d) => [
    { ...rect(0, 0, w, d, COLOR.exit, { fillOpacity: 0.14, stroke: COLOR.exit, strokeDasharray: DASH }), pointerEvents: "all" } as FloorplanGeometry,
    stroke(0, d * 0.3, 0, -d * 0.3, COLOR.exit, 0.08),
    stroke(-w * 0.15, -d * 0.12, 0, -d * 0.32, COLOR.exit, 0.08),
    stroke(w * 0.15, -d * 0.12, 0, -d * 0.32, COLOR.exit, 0.08),
  ],
  stanchions: (w, d) => {
    const posts = across(w, fit(w, 1.2) + 1);
    return [{ ...stroke(posts[0]!, 0, posts[posts.length - 1]!, 0, COLOR.velvet, 0.05), pointerEvents: "all" } as FloorplanGeometry, ...posts.map((x) => disc(x, 0, Math.min(0.12, d / 2), COLOR.gold))];
  },
  barrier: (w, d) => [...body(w, d, "#e4e6e9"), ...across(w, fit(w, 0.25)).map((x) => stroke(x, -d / 2, x, d / 2, COLOR.steelDark, 0.012))],
  "wheelchair-space": (w, d) => [
    { ...rect(0, 0, w, d, COLOR.marking, { fillOpacity: 0.85 }), pointerEvents: "all" } as FloorplanGeometry,
    disc(0, -d * 0.18, Math.min(w, d) * 0.08, COLOR.white, { stroke: "none" }),
    disc(0, d * 0.12, Math.min(w, d) * 0.22, "none", { stroke: COLOR.white, strokeWidth: 0.04 }),
  ],
  ramp: (w, d) => [...body(w, d, "#b7b3ae"), ...across(d * 0.9, fit(d, 0.4)).flatMap((y) => [stroke(-w * 0.3, y + 0.1, 0, y - 0.1, COLOR.yellow, 0.03), stroke(w * 0.3, y + 0.1, 0, y - 0.1, COLOR.yellow, 0.03)])],
  tent: (w, d) => [...body(w, d, COLOR.white, { fillOpacity: 0.85 }), stroke(-w / 2, -d / 2, w / 2, d / 2, "#d6d2cc", 0.02), stroke(w / 2, -d / 2, -w / 2, d / 2, "#d6d2cc", 0.02), stroke(0, -d / 2, 0, d / 2, "#d6d2cc", 0.02)],
  "portable-toilets": (w, d) => [...body(w, d, COLOR.blue), ...across(w, fit(w, 1.2)).flatMap((x) => [rect(x, 0, 1.0, d - 0.12, COLOR.blue), rect(x, d / 2 - 0.08, 0.6, 0.06, COLOR.white, { stroke: "none" })])],
  generator: (w, d) => [...body(w, d, COLOR.olive, { rx: 0.05 }), ...across(w * 0.7, 6).map((x) => stroke(x, -d * 0.3, x, d * 0.3, shade(COLOR.olive, 0.3), 0.025)), disc(w / 2 - 0.2, -d / 2 + 0.2, 0.07, COLOR.black)],
  power: (w, d) => [{ ...rect(0, d / 2 - 0.15, 0.4, 0.3, COLOR.olive), pointerEvents: "all" } as FloorplanGeometry, rect(0, -0.15, 0.3, d - 0.3, COLOR.yellow, { stroke: "none" })],
};

/** Pieces whose drawing already says what they are, at a size where a name would only crowd it. */
const SELF_EVIDENT = new Set(["uplight", "plant", "extinguisher", "power", "first-aid", "wheelchair-space", "stanchions", "umbrella", "speaker", "arch", "welcome-sign"]);

const WORDS: Record<string, string> = { led: "LED", foh: "FOH", av: "AV" };

function variantName(variant: string): string {
  const words = variant.split(/[-_\s]+/).filter(Boolean).map((word) => WORDS[word.toLowerCase()] ?? word.toLowerCase());
  const [first = "", ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

/** A piece's drawing and, unless the drawing says it plainly, its name from its label or variant ("led-wall" → "LED wall"). */
export function smallPieceSymbol(node: PrismPieceNode, fallback: string): FloorplanGeometry {
  const draw = DRAWINGS[node.variant] ?? ((w: number, d: number) => body(w, d, "#e9e4dc"));
  const name = node.label || variantName(node.variant) || fallback;
  const fontSize = Math.max(0.12, Math.min(0.3, node.width / Math.max(name.length, 1), node.depth * 0.6));
  const named = !SELF_EVIDENT.has(node.variant) || node.label;
  return placed(node, [...draw(node.width, node.depth), ...(named ? [label(name, 0, fontSize, { fill: LOOK.number, weight: 600 })] : [])]);
}
