import type { Material } from "three";
import { resolveProceduralFinishRef } from "@pascal-app/core/procedural-items";
import type { PrismEventPiece } from "@prism/types";
import { accentOf, chairStyleOf, fabricOf, type ChairStyle } from "../dressing";
import { isKey } from "./lookup";
import { designRuntime } from "./runtime";
import { SLOT_LOOKS, type SlotId } from "./palette";

/** Each chair style's look per chair slot. A covered chair wears the fixed chair cover instead. */
export const CHAIR_REFS: Record<ChairStyle, Partial<Record<SlotId, string>>> = {
  chiavari: { chair_frame: "library:metal-brass", chair_seat: "library:preset-cream", chair_back: "library:metal-brass" },
  tiffany: { chair_frame: "library:preset-white", chair_seat: "library:preset-cream", chair_back: "library:preset-white" },
  banquet: { chair_frame: "library:metal-black", chair_seat: "library:fabric-velvet", chair_back: "library:fabric-velvet" },
  ghost: { chair_frame: "library:preset-glass", chair_seat: "library:preset-glass", chair_back: "library:preset-glass" },
  "cross-back": { chair_frame: "library:wood-finewood27", chair_seat: "library:fabric-linen", chair_back: "library:wood-finewood27" },
  covered: { chair_frame: "library:metal-steel" },
};

/** Slots whose look is fixed rather than derived from the palette colour. */
const FIXED_REFS: Partial<Record<SlotId, string>> = {
  parquet: "library:wood-hungarianparquet2",
  stage_deck: "library:preset-nearblack",
  stage_skirt: "library:preset-charcoal",
  backdrop_fabric: "library:preset-charcoal",
  led_panel: "library:preset-nearblack",
  zone: "library:preset-glass-tinted",
  table_top: "library:wood-finewood27",
  pedestal: "library:metal-steel",
  linen: "library:fabric-linen",
  overlay: "library:preset-gold",
  sash: "library:preset-gold",
  chair_cover: "library:fabric-cotton",
  aisle_runner: "library:fabric-linen",
  vase: "library:preset-glass",
  florals: "library:preset-petal",
  candle: "library:preset-cream",
  number_card: "library:preset-white",
  dance_white: "library:preset-white",
  dance_light: "library:preset-white",
  dance_dark: "library:preset-nearblack",
  led_floor: "library:preset-glass-frosted",
  screen: "library:preset-white",
  light_body: "library:metal-black",
  light_beam: "library:preset-glass-frosted",
  bulb: "library:preset-glass-frosted",
  sofa: "library:fabric-boucle",
  rug: "library:fabric-wool",
  canopy: "library:preset-softwhite",
  velvet: "library:fabric-velvet",
  throne: "library:metal-brass",
  barrier: "library:metal-chrome",
  rope: "library:preset-oxblood",
  ramp: "library:concrete-raw",
  truss: "library:metal-polished",
  rail: "library:metal-chrome",
  stool_seat: "library:leather-black",
};

/** A slot's default: its fixed look, the library finish nearest its palette colour, or the colour itself. */
function defaultRef(slot: SlotId): string {
  const fixed = FIXED_REFS[slot];
  if (fixed) return fixed;
  const { finish, color } = SLOT_LOOKS[slot];
  return finish ? (resolveProceduralFinishRef(finish, color) ?? color) : color;
}

/** The library reference for each slot a piece's card overrides: its linen, overlay, sash and chair style. */
export function slotRefsFor(piece: PrismEventPiece): Partial<Record<SlotId, string>> {
  if (piece.type === "prism-table") {
    return {
      ...CHAIR_REFS[chairStyleOf(piece.chairStyle)],
      linen: fabricOf(piece.linen).ref,
      ...(accentOf(piece.overlay) ? { overlay: accentOf(piece.overlay)!.ref } : {}),
      ...(accentOf(piece.sash) ? { sash: accentOf(piece.sash)!.ref } : {}),
    };
  }
  if (piece.type === "prism-seating-block") return CHAIR_REFS[chairStyleOf(piece.chairStyle)];
  return {};
}

/** The material for one slot of a piece, at the editor's current shading. */
export function slotMaterial(piece: PrismEventPiece, slot: string, shading: string): Material {
  if (!isKey(SLOT_LOOKS, slot)) throw new Error(`Unknown material slot "${slot}"`);
  return designRuntime().material(slotRefsFor(piece)[slot] ?? defaultRef(slot), shading);
}
