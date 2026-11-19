import type { Material } from "three";
import { resolveProceduralFinishRef } from "@pascal-app/core/procedural-items";
import type { PrismEventPiece } from "@prism/types";
import { accentOf, chairStyleOf, fabricOf, type ChairStyle } from "../dressing";
import { dyed, finish, stained } from "./finishes";
import { isKey } from "./lookup";
import { designRuntime } from "./runtime";
import { SLOT_LOOKS, type SlotId } from "./palette";

/** Woven linen: Pascal's linen weave in any colour, fine enough to read as tablecloth at a table's scale. */
export const linen = (color: string) => dyed("fabric-linen", color, { repeat: 16, roughness: 0.9, relief: 0.45 });
/** Satin for overlays, runners and sashes: a tight weave with a soft sheen. */
export const satin = (color: string) => dyed("fabric-cotton", color, { repeat: 18, roughness: 0.34, relief: 0.35 });
/** Upholstery velvet with its pile. */
export const velvet = (color: string) => dyed("fabric-velvet", color, { repeat: 6, roughness: 0.6, relief: 0.7 });
/** A smooth glazed or lacquered surface with no texture: porcelain, painted resin, wax. */
export const glazed = (color: string, roughness: number) => finish({ library: "metal-chrome", mode: "dye", color, roughness, metalness: 0 });
/** Polished gold leaf, as on chiavari chairs, chargers and gilt frames. */
export const GOLD = finish({ library: "metal-brass", mode: "dye", color: "#d6ad62", roughness: 0.28, metalness: 0.9 });

/** Each chair style's look per chair slot. A covered chair wears the fixed chair cover instead. */
export const CHAIR_REFS: Record<ChairStyle, Partial<Record<SlotId, string>>> = {
  chiavari: { chair_frame: GOLD, chair_seat: linen("#efe6d0"), chair_back: GOLD },
  tiffany: { chair_frame: glazed("#f6f3ee", 0.28), chair_seat: linen("#f4efe4"), chair_back: glazed("#f6f3ee", 0.28) },
  banquet: { chair_frame: "library:metal-chrome", chair_seat: velvet("#5b2333"), chair_back: velvet("#5b2333") },
  ghost: { chair_frame: "library:preset-glass", chair_seat: "library:preset-glass", chair_back: "library:preset-glass" },
  "cross-back": { chair_frame: "library:wood-woodfine22", chair_seat: linen("#d9cbb3"), chair_back: "library:wood-woodfine22" },
  covered: { chair_frame: "library:metal-steel" },
};

/** Slots whose look is fixed rather than derived from the palette colour. */
const FIXED_REFS: Partial<Record<SlotId, string>> = {
  parquet: "library:wood-hungarianparquet2",
  stage_deck: stained("wood-woodplank48", "#4a403b", { repeat: 0.6 }),
  stage_skirt: velvet("#2a2629"),
  backdrop_fabric: velvet("#2a2629"),
  led_panel: "library:preset-nearblack",
  zone: "library:preset-glass-tinted",
  table_top: "library:wood-finewood27",
  pedestal: "library:metal-steel",
  linen: linen("#f7f5f0"),
  overlay: satin("#c9a356"),
  sash: satin("#c9a356"),
  napkin: linen("#f7f5f0"),
  charger: GOLD,
  china: glazed("#fbfaf6", 0.18),
  glassware: "library:preset-glass",
  cutlery: "library:metal-polished",
  chair_cover: dyed("fabric-cotton", "#f6f4ef", { repeat: 8, roughness: 0.7 }),
  aisle_runner: linen("#f7f5f0"),
  vase: "library:preset-glass",
  florals: dyed("fabric-suede", "#f1d3d3", { repeat: 12, roughness: 0.8 }),
  greenery: dyed("fabric-suede", "#5d7650", { repeat: 12, roughness: 0.75 }),
  candle: glazed("#f5efe0", 0.55),
  number_card: glazed("#fbfaf7", 0.6),
  dance_white: glazed("#f7f7f6", 0.12),
  dance_light: glazed("#f7f7f6", 0.15),
  dance_dark: glazed("#1d1b1d", 0.15),
  led_floor: "library:preset-glass-frosted",
  screen: "library:preset-white",
  light_body: "library:metal-black",
  light_beam: "library:preset-glass-frosted",
  bulb: "library:preset-glass-frosted",
  bar_wood: stained("wood-finewood27", "#8a6448"),
  bar_top: "library:flooring-statuarettowhite",
  sofa: "library:fabric-boucle",
  rug: "library:fabric-wool",
  canopy: "library:preset-softwhite",
  velvet: velvet("#6b2335"),
  throne: GOLD,
  barrier: "library:metal-chrome",
  rope: velvet("#6b2335"),
  ramp: "library:concrete-raw",
  truss: "library:metal-polished",
  rail: GOLD,
  stool_seat: "library:leather-black",
  lectern: stained("wood-finewood27", "#8a6448"),
  desk: stained("wood-finewood27", "#b08a63"),
  desk_top: stained("wood-finewood27", "#b08a63"),
  desk_body: stained("wood-finewood27", "#8a6448"),
  wood_board: "library:wood-finewood27",
};

/** A slot's default: its fixed look, the library finish nearest its palette colour, or the colour itself. */
function defaultRef(slot: SlotId): string {
  const fixed = FIXED_REFS[slot];
  if (fixed) return fixed;
  const { finish: kind, color } = SLOT_LOOKS[slot];
  return kind ? (resolveProceduralFinishRef(kind, color) ?? color) : color;
}

/** A table's cloths in its card's colours: linen, an overlay or runner, sashes, and napkins to match the accent. */
function tableClothRefs(piece: Extract<PrismEventPiece, { type: "prism-table" }>): Partial<Record<SlotId, string>> {
  const cloth = fabricOf(piece.linen).dye;
  const overlay = accentOf(piece.overlay);
  const sash = accentOf(piece.sash);
  return {
    linen: linen(cloth),
    napkin: linen(overlay?.dye ?? cloth),
    ...(overlay ? { overlay: satin(overlay.dye) } : {}),
    ...(sash ? { sash: satin(sash.dye) } : {}),
  };
}

/** The library reference for each slot a piece's card overrides: its linen, overlay, sash and chair style. */
export function slotRefsFor(piece: PrismEventPiece): Partial<Record<SlotId, string>> {
  if (piece.type === "prism-table") return { ...CHAIR_REFS[chairStyleOf(piece.chairStyle)], ...tableClothRefs(piece) };
  if (piece.type === "prism-seating-block") return CHAIR_REFS[chairStyleOf(piece.chairStyle)];
  return {};
}

/** The material for one slot of a piece, at the editor's current shading. */
export function slotMaterial(piece: PrismEventPiece, slot: string, shading: string): Material {
  if (!isKey(SLOT_LOOKS, slot)) throw new Error(`Unknown material slot "${slot}"`);
  return designRuntime().material(slotRefsFor(piece)[slot] ?? defaultRef(slot), shading);
}
