import type { PrismEventPieceType } from "@prism/types";

/** A Library tile: a piece kind and the values the next placed piece starts with. */
export type LibraryItem = {
  id: string;
  kind: PrismEventPieceType;
  label: string;
  /** Its real size or seats, shown under the name. */
  meta: string;
  preset: Record<string, unknown>;
};

export type LibrarySection = { section: string; items: LibraryItem[] };

const item = (id: string, kind: PrismEventPieceType, label: string, meta: string, preset: Record<string, unknown>): LibraryItem => ({
  id,
  kind,
  label,
  meta,
  preset,
});

/** Theater chairs sit 0.5 m apart on 0.9 m rows; classroom places sit 0.6 m apart behind 1.2 m desk rows. */
const block = (style: "theater" | "classroom", rows: number, columns: number) => {
  const [across, row] = style === "theater" ? [0.5, 0.9] : [0.6, 1.2];
  return { style, rows, columns, aisle: 0, width: columns * across, depth: rows * row };
};

const zone = (id: string, label: string, width: number, depth: number) => item(id, "prism-zone", label, `${width} × ${depth} m`, { label, width, depth });

export const LIBRARY_CATALOG: readonly LibrarySection[] = [
  {
    section: "Tables",
    items: [
      item("round-8", "prism-table", "Round · 8", "1.8 m · 8 seats", { shape: "round", width: 1.8, depth: 1.8, seats: 8 }),
      item("round-10", "prism-table", "Round · 10", "1.8 m · 10 seats", { shape: "round", width: 1.8, depth: 1.8, seats: 10 }),
      item("crescent-6", "prism-table", "Crescent · 6", "1.8 m · faces the stage", { shape: "round", width: 1.8, depth: 1.8, seats: 6, crescent: true }),
      item("banquet-8", "prism-table", "Banquet · 8", "2.4 × 0.75 m · 8 seats", { shape: "rect", width: 2.4, depth: 0.75, seats: 8 }),
      item("presidential", "prism-table", "Presidential", "4.8 × 0.75 m · 8 facing out", { shape: "rect", width: 4.8, depth: 0.75, seats: 8, seatSides: "one" }),
      item("sweetheart", "prism-table", "Sweetheart", "1.5 × 0.75 m · 2 seats", { shape: "rect", width: 1.5, depth: 0.75, seats: 2, seatSides: "one" }),
      item("boardroom", "prism-table", "Boardroom", "4.8 × 1.2 m · 12 seats", { shape: "rect", width: 4.8, depth: 1.2, seats: 12, seatSides: "around", chairStyle: "banquet" }),
      item("u-shape", "prism-table", "U-shape", "6 × 5 m · 18 seats", { shape: "u-shape", width: 6, depth: 5, seats: 18, chairStyle: "banquet" }),
      item("hollow-square", "prism-table", "Hollow square", "6 × 6 m · 24 seats", { shape: "hollow-square", width: 6, depth: 6, seats: 24, chairStyle: "banquet" }),
      item("cocktail", "prism-table", "Cocktail", "0.7 m · standing", { shape: "cocktail", width: 0.7, depth: 0.7, seats: 0 }),
    ],
  },
  {
    section: "Seating blocks",
    items: [
      item("theater-5x4", "prism-seating-block", "Theater 5 × 4", "20 seats", block("theater", 5, 4)),
      item("classroom-3x4", "prism-seating-block", "Classroom 3 × 4", "12 seats", block("classroom", 3, 4)),
      item("ceremony-8x6", "prism-seating-block", "Ceremony 8 × 6", "48 seats · aisle runner", { ...block("theater", 8, 6), style: "ceremony", aisle: 1.5, width: 4.5, chairStyle: "tiffany" }),
    ],
  },
  {
    section: "Stage & floor",
    items: [
      item("stage", "prism-stage", "Stage with steps", "6 × 4 m · 0.6 m high", { variant: "stage", width: 6, depth: 4, steps: true, heightM: 0.6 }),
      item("stage-backdrop", "prism-stage", "Stage with backdrop", "8 × 4 m · truss and drape", { variant: "stage", width: 8, depth: 4, steps: true, heightM: 0.8, backdrop: true }),
      item("podium", "prism-stage", "Podium", "0.6 × 0.5 m", { variant: "podium", width: 0.6, depth: 0.5 }),
      item("camera-riser", "prism-stage", "Camera riser", "2 × 2 m · 0.4 m high", { variant: "camera-riser", width: 2, depth: 2 }),
      item("dance-floor", "prism-dance-floor", "Dance floor", "6 × 6 m", { width: 6, depth: 6 }),
      item("dance-floor-checker", "prism-dance-floor", "Checkered floor", "6 × 6 m", { width: 6, depth: 6, finish: "checker" }),
      item("dance-floor-led", "prism-dance-floor", "LED dance floor", "5 × 5 m", { width: 5, depth: 5, finish: "led" }),
      item("registration", "prism-registration", "Registration desk", "2.4 × 0.8 m", { variant: "desk", width: 2.4, depth: 0.8 }),
      item("bag-check", "prism-registration", "Bag check", "2.4 × 1.2 m", { variant: "bag-check", width: 2.4, depth: 1.2 }),
      item("booth", "prism-booth", "Exhibit booth", "3 × 3 m", { variant: "booth", width: 3, depth: 3 }),
    ],
  },
  {
    section: "Food & bar",
    items: [
      item("bar", "prism-bar", "Bar", "3 × 0.8 m", { shape: "straight", width: 3, depth: 0.8 }),
      item("bar-stools", "prism-bar", "Bar with stools", "4 × 0.8 m · 6 stools", { shape: "straight", width: 4, depth: 0.8, stools: 6, backBar: true }),
      item("bar-l", "prism-bar", "L bar", "3 × 3 m", { shape: "l", width: 3, depth: 3 }),
      item("buffet", "prism-catering", "Buffet", "3 × 0.8 m", { variant: "buffet", width: 3, depth: 0.8 }),
      item("dessert", "prism-catering", "Dessert table", "1.8 × 0.8 m", { variant: "dessert", width: 1.8, depth: 0.8 }),
      item("cake-table", "prism-catering", "Cake table", "1.2 m · three tiers", { variant: "cake-table", width: 1.2, depth: 1.2 }),
      item("grazing", "prism-catering", "Grazing table", "3.6 × 1 m", { variant: "grazing", width: 3.6, depth: 1 }),
      item("lechon", "prism-catering", "Lechon station", "1.8 × 0.9 m", { variant: "carving", width: 1.8, depth: 0.9, label: "Lechon station" }),
    ],
  },
  {
    section: "AV & lighting",
    items: [
      item("led-wall", "prism-av", "LED wall", "5 m", { variant: "led-wall", width: 5, depth: 0.3 }),
      item("projection-screen", "prism-av", "Projection screen", "3 m wide", { variant: "projection-screen", width: 3, depth: 0.6 }),
      item("speaker", "prism-av", "Speaker", "0.6 × 0.6 m", { variant: "speaker", width: 0.6, depth: 0.6 }),
      item("foh-desk", "prism-av", "FOH desk", "2 × 1.2 m", { variant: "foh-desk", width: 2, depth: 1.2 }),
      item("uplight", "prism-av", "Uplight", "0.3 m", { variant: "uplight", width: 0.3, depth: 0.3 }),
      item("lighting-truss", "prism-av", "Lighting truss", "6 m · moving heads", { variant: "lighting-truss", width: 6, depth: 0.5 }),
    ],
  },
  {
    section: "Décor",
    items: [
      item("floral-arch", "prism-decor", "Floral arch", "2 × 0.6 m", { variant: "arch", width: 2, depth: 0.6 }),
      item("photo-backdrop", "prism-decor", "Photo backdrop", "3 × 0.5 m", { variant: "backdrop", width: 3, depth: 0.5 }),
      item("photo-booth", "prism-decor", "Photo booth", "3 × 2.5 m", { variant: "photo-booth", width: 3, depth: 2.5 }),
      item("lounge", "prism-decor", "Lounge set", "3.5 × 3 m", { variant: "lounge", width: 3.5, depth: 3 }),
      item("throne", "prism-decor", "Debutante's chair", "0.9 × 0.8 m", { variant: "throne", width: 0.9, depth: 0.8 }),
      item("gift-table", "prism-decor", "Gift table", "1.8 × 0.75 m", { variant: "gift-table", width: 1.8, depth: 0.75 }),
      item("welcome-sign", "prism-decor", "Welcome sign", "0.7 × 0.5 m", { variant: "welcome-sign", width: 0.7, depth: 0.5 }),
      item("plant", "prism-decor", "Potted plant", "0.6 m", { variant: "plant", width: 0.6, depth: 0.6 }),
      item("string-lights", "prism-decor", "String lights", "10 × 9 m", { variant: "string-lights", width: 10, depth: 9 }),
    ],
  },
  {
    section: "Outdoor & services",
    items: [
      item("tent", "prism-fixture", "Frame tent", "10 × 10 m", { variant: "tent", width: 10, depth: 10 }),
      item("umbrella", "prism-decor", "Umbrella", "2.5 m", { variant: "umbrella", width: 2.5, depth: 2.5 }),
      item("toilets", "prism-fixture", "Portable toilets", "3 cabins", { variant: "portable-toilets", width: 3.6, depth: 1.3 }),
      item("generator", "prism-fixture", "Generator", "2.5 × 1.1 m", { variant: "generator", width: 2.5, depth: 1.1 }),
      item("power", "prism-fixture", "Power point", "with cable cover", { variant: "power", width: 0.4, depth: 2 }),
    ],
  },
  {
    section: "Safety & guest flow",
    items: [
      item("emergency-exit", "prism-safety", "Emergency exit", "keep 1.8 m clear", { variant: "emergency-exit", width: 1.8, depth: 1.5 }),
      item("extinguisher", "prism-safety", "Fire extinguisher", "0.4 m", { variant: "extinguisher", width: 0.4, depth: 0.4 }),
      item("first-aid", "prism-safety", "First aid point", "2 × 2 m", { variant: "first-aid", width: 2, depth: 2 }),
      item("queue-line", "prism-safety", "Queue line", "4 m of stanchions", { variant: "stanchions", width: 4, depth: 0.4 }),
      item("barrier", "prism-safety", "Crowd barrier", "6 m", { variant: "barrier", width: 6, depth: 0.7 }),
      item("wheelchair", "prism-safety", "Wheelchair space", "0.9 × 1.4 m", { variant: "wheelchair-space", width: 0.9, depth: 1.4 }),
      item("ramp", "prism-fixture", "Ramp", "1.2 × 3.6 m", { variant: "ramp", width: 1.2, depth: 3.6 }),
    ],
  },
  {
    section: "Zones",
    items: [
      zone("supplier-zone", "Supplier zone", 4, 3),
      zone("catering-prep", "Catering prep", 6, 4),
      zone("green-room", "Green room", 4, 4),
      zone("storage", "Storage", 3, 3),
      zone("security", "Security check", 4, 2),
    ],
  },
];

/** The sections whose tiles match every word of the query by name, size or section; empty sections drop out. */
export function searchCatalog(query: string, catalog: readonly LibrarySection[] = LIBRARY_CATALOG): LibrarySection[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return catalog
    .map(({ section, items }) => ({
      section,
      items: items.filter((tile) => words.every((word) => `${section} ${tile.label} ${tile.meta}`.toLowerCase().includes(word))),
    }))
    .filter(({ items }) => items.length > 0);
}
