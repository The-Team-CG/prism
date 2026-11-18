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

export const LIBRARY_CATALOG: readonly LibrarySection[] = [
  {
    section: "Tables",
    items: [
      item("round-8", "prism-table", "Round · 8", "1.8 m · 8 seats", { shape: "round", width: 1.8, depth: 1.8, seats: 8 }),
      item("round-10", "prism-table", "Round · 10", "1.8 m · 10 seats", { shape: "round", width: 1.8, depth: 1.8, seats: 10 }),
      item("banquet-8", "prism-table", "Banquet · 8", "2.4 × 0.75 m · 8 seats", { shape: "rect", width: 2.4, depth: 0.75, seats: 8 }),
      item("cocktail", "prism-table", "Cocktail", "0.7 m · standing", { shape: "cocktail", width: 0.7, depth: 0.7, seats: 0 }),
    ],
  },
  {
    section: "Seating blocks",
    items: [
      item("theater-5x4", "prism-seating-block", "Theater 5 × 4", "20 seats", block("theater", 5, 4)),
      item("classroom-3x4", "prism-seating-block", "Classroom 3 × 4", "12 seats", block("classroom", 3, 4)),
    ],
  },
  {
    section: "Stage & floor",
    items: [
      item("stage", "prism-stage", "Stage with steps", "6 × 4 m · 0.6 m high", { variant: "stage", width: 6, depth: 4, steps: true, heightM: 0.6 }),
      item("dance-floor", "prism-dance-floor", "Dance floor", "6 × 6 m", { width: 6, depth: 6 }),
      item("registration", "prism-registration", "Registration desk", "2.4 × 0.8 m", { variant: "desk", width: 2.4, depth: 0.8 }),
      item("booth", "prism-booth", "Exhibit booth", "3 × 3 m", { variant: "booth", width: 3, depth: 3 }),
    ],
  },
  {
    section: "Food & bar",
    items: [
      item("bar", "prism-bar", "Bar", "3 × 0.8 m", { shape: "straight", width: 3, depth: 0.8 }),
      item("bar-l", "prism-bar", "L bar", "3 × 3 m", { shape: "l", width: 3, depth: 3 }),
      item("buffet", "prism-catering", "Buffet", "3 × 0.8 m", { variant: "buffet", width: 3, depth: 0.8 }),
      item("dessert", "prism-catering", "Dessert table", "1.8 × 0.8 m", { variant: "dessert", width: 1.8, depth: 0.8 }),
    ],
  },
  {
    section: "AV",
    items: [
      item("led-wall", "prism-av", "LED wall", "5 m", { variant: "led-wall", width: 5, depth: 0.3 }),
      item("speaker", "prism-av", "Speaker", "0.6 × 0.6 m", { variant: "speaker", width: 0.6, depth: 0.6 }),
      item("foh-desk", "prism-av", "FOH desk", "2 × 1.2 m", { variant: "foh-desk", width: 2, depth: 1.2 }),
    ],
  },
  {
    section: "Décor & safety",
    items: [
      item("floral-arch", "prism-decor", "Floral arch", "2 × 0.6 m", { variant: "arch", width: 2, depth: 0.6 }),
      item("photo-backdrop", "prism-decor", "Photo backdrop", "3 × 0.5 m", { variant: "backdrop", width: 3, depth: 0.5 }),
      item("extinguisher", "prism-safety", "Fire extinguisher", "0.4 m", { variant: "extinguisher", width: 0.4, depth: 0.4 }),
      item("first-aid", "prism-safety", "First aid point", "2 × 2 m", { variant: "first-aid", width: 2, depth: 2 }),
    ],
  },
  {
    section: "Zones",
    items: [item("supplier-zone", "prism-zone", "Supplier zone", "4 × 3 m", { label: "Supplier zone", width: 4, depth: 3 })],
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
