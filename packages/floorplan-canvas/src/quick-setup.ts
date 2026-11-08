import { ASSETS, uid } from "./assetLibrary";
import type { CanvasObject } from "./types";

/** FR-82: how guests are seated in a preset. */
type Seating = "rounds" | "theatre" | "classroom" | "ushape" | "cocktail" | "long" | "booths" | "standing";

export interface QuickSetupPreset {
  id: string;
  group: "Weddings" | "Private celebrations" | "Corporate meetings" | "Launches and activations" | "Concerts and public events" | "Galas and awards";
  name: string;
  seating: Seating;
  stage: boolean;
  ledWall: boolean;
  registration: boolean;
  buffet: boolean;
}

const preset = (group: QuickSetupPreset["group"], name: string, seating: Seating, extras: Partial<Pick<QuickSetupPreset, "stage" | "ledWall" | "registration" | "buffet">> = {}): QuickSetupPreset => ({
  id: `${group}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  group, name, seating, stage: extras.stage ?? true, ledWall: extras.ledWall ?? false, registration: extras.registration ?? true, buffet: extras.buffet ?? false,
});

/** Eighteen presets: three for each PMCM event-type group. */
export const QUICK_SETUP_PRESETS: readonly QuickSetupPreset[] = [
  preset("Weddings", "Reception banquet", "rounds", { buffet: true }),
  preset("Weddings", "Ceremony with aisle", "theatre", { registration: false }),
  preset("Weddings", "Cocktail reception", "cocktail", { stage: false, buffet: true }),
  preset("Private celebrations", "Debut or birthday banquet", "rounds", { ledWall: true, buffet: true }),
  preset("Private celebrations", "Family-style long tables", "long", { buffet: true }),
  preset("Private celebrations", "Cocktail party", "cocktail", { buffet: true }),
  preset("Corporate meetings", "Plenary theatre", "theatre", { ledWall: true }),
  preset("Corporate meetings", "Training classroom", "classroom", { ledWall: true }),
  preset("Corporate meetings", "Boardroom U-shape", "ushape", { stage: false }),
  preset("Launches and activations", "Product reveal", "standing", { ledWall: true }),
  preset("Launches and activations", "Expo booths", "booths", { stage: false }),
  preset("Launches and activations", "Press briefing", "theatre", { ledWall: true }),
  preset("Concerts and public events", "Standing concert", "standing", { ledWall: true }),
  preset("Concerts and public events", "Seated show", "theatre", { ledWall: true }),
  preset("Concerts and public events", "Fair or fun-run village", "booths", { stage: true }),
  preset("Galas and awards", "Awards banquet", "rounds", { ledWall: true }),
  preset("Galas and awards", "Gala dinner with VIP table", "rounds", { buffet: true }),
  preset("Galas and awards", "Cocktail gala", "cocktail", { buffet: true }),
];

const asset = (id: string) => {
  const found = ASSETS.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown asset ${id}`);
  return found;
};

function place(assetId: string, x: number, y: number, extra: Partial<CanvasObject> = {}): CanvasObject {
  const a = asset(assetId);
  return {
    id: uid(assetId), name: a.name, kind: a.kind, category: a.category, x, y, w: a.w, h: a.h, rotation: 0,
    fill: a.fill, stroke: a.stroke, strokeWidth: 0.04, ...(a.seats ? { seats: a.seats } : {}), locked: false, hidden: false, ...extra,
  };
}

type Area = { x: number; y: number; w: number; h: number };

/** Fills an area with a grid of one asset, row by row, up to `count` items. */
function grid(assetId: string, area: Area, count: number, gap: number, extra: (index: number) => Partial<CanvasObject> = () => ({})): CanvasObject[] {
  const a = asset(assetId);
  const columns = Math.max(1, Math.floor((area.w + gap) / (a.w + gap)));
  const rows = Math.max(0, Math.floor((area.h + gap) / (a.h + gap)));
  const total = Math.min(count, columns * rows);
  const used = Math.min(columns, total) * (a.w + gap) - gap;
  const left = area.x + Math.max(0, (area.w - used) / 2);
  return Array.from({ length: total }, (_, index) => place(assetId, left + (index % columns) * (a.w + gap), area.y + Math.floor(index / columns) * (a.h + gap), extra(index)));
}

const SEATING: Record<Seating, (area: Area, pax: number) => CanvasObject[]> = {
  rounds: (area, pax) => grid("round-banquet", area, Math.ceil(pax / 10), 1.4, (index) => ({ label: `T${index + 1}` })),
  long: (area, pax) => grid("rect-banquet", area, Math.ceil(pax / 8), 1.2, (index) => ({ label: `T${index + 1}` })),
  theatre: (area, pax) => [...grid("chair", { ...area, w: area.w / 2 - 0.75 }, Math.ceil(pax / 2), 0.35), ...grid("chair", { ...area, x: area.x + area.w / 2 + 0.75, w: area.w / 2 - 0.75 }, Math.floor(pax / 2), 0.35)],
  classroom: (area, pax) => grid("classroom", area, Math.ceil(pax / 2), 0.9),
  ushape: (area, pax) => grid("rect-banquet", { x: area.x, y: area.y, w: area.w, h: Math.min(area.h, 3) }, Math.ceil(pax / 8), 0.1),
  cocktail: (area, pax) => grid("cocktail", area, Math.ceil(pax / 6), 2.2),
  booths: (area, pax) => grid("booth", area, Math.max(4, Math.ceil(pax / 40)), 1.5),
  standing: (area) => grid("cocktail", area, 8, 4),
};

const seatsOf = (objects: CanvasObject[], seating: Seating) => {
  if (seating === "theatre") return objects.filter((object) => object.name === "Chair").length;
  if (seating === "cocktail" || seating === "booths" || seating === "standing") return Number.POSITIVE_INFINITY;
  return objects.reduce((sum, object) => sum + (object.seats ?? 0), 0);
};

/**
 * Lays a preset out on the venue: stage and LED wall at the top, registration by the entrance at the bottom, buffet
 * along the right wall, and the seating style filling what is left. Reports guests the room cannot seat.
 */
export function arrangeQuickSetup(chosen: QuickSetupPreset, venue: { widthM: number; heightM: number; pax: number }): { objects: CanvasObject[]; shortfall: number } {
  const margin = 1;
  const objects: CanvasObject[] = [];
  let top = margin;
  if (chosen.stage) {
    const stage = asset("stage");
    objects.push(place("stage", (venue.widthM - stage.w) / 2, top));
    if (chosen.ledWall) objects.push(place("led-wall", (venue.widthM - asset("led-wall").w) / 2, top + 0.2));
    top += stage.h + 2;
  }
  const bottom = chosen.registration ? venue.heightM - margin - asset("reg-desk").h - 2 : venue.heightM - margin;
  if (chosen.registration) objects.push(place("reg-desk", (venue.widthM - asset("reg-desk").w) / 2, venue.heightM - margin - asset("reg-desk").h));
  const right = chosen.buffet ? venue.widthM - margin - asset("buffet").w - 1.5 : venue.widthM - margin;
  if (chosen.buffet) objects.push(place("buffet", venue.widthM - margin - asset("buffet").w, top));
  const seating = SEATING[chosen.seating]({ x: margin, y: top, w: Math.max(0, right - margin), h: Math.max(0, bottom - top) }, Math.max(0, venue.pax));
  return { objects: [...objects, ...seating], shortfall: Math.max(0, venue.pax - seatsOf(seating, chosen.seating)) };
}
