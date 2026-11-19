import type { Material } from "three";
import { resolveProceduralFinishRef } from "@pascal-app/core/procedural-items";
import type { PrismEventPiece } from "@prism/types";
import { isKey } from "./lookup";
import { designRuntime } from "./runtime";
import { SLOT_LOOKS, type SlotId } from "./palette";

/** Linen by the table card's choice. */
export const LINEN_REFS = {
  white: "library:fabric-linen",
  ivory: "library:preset-cream",
  black: "library:preset-nearblack",
  blush: "library:preset-blush",
} as const;

/** Each chair style's look per chair slot. */
export const CHAIR_REFS = {
  chiavari: { chair_frame: "library:metal-brass", chair_seat: "library:preset-cream", chair_back: "library:metal-brass" },
  banquet: { chair_frame: "library:metal-black", chair_seat: "library:fabric-velvet", chair_back: "library:fabric-velvet" },
  ghost: { chair_frame: "library:preset-glass", chair_seat: "library:preset-glass", chair_back: "library:preset-glass" },
  "cross-back": { chair_frame: "library:wood-finewood27", chair_seat: "library:fabric-linen", chair_back: "library:wood-finewood27" },
} as const;

/** Slots whose look is fixed rather than derived from the palette colour. */
const FIXED_REFS: Partial<Record<SlotId, string>> = {
  parquet: "library:wood-hungarianparquet2",
  stage_deck: "library:preset-nearblack",
  stage_skirt: "library:preset-charcoal",
  led_panel: "library:preset-nearblack",
  zone: "library:preset-glass-tinted",
  table_top: "library:wood-finewood27",
  pedestal: "library:metal-steel",
};

/** A slot's default: its fixed look, the library finish nearest its palette colour, or the colour itself. */
function defaultRef(slot: SlotId): string {
  const fixed = FIXED_REFS[slot];
  if (fixed) return fixed;
  const { finish, color } = SLOT_LOOKS[slot];
  return finish ? (resolveProceduralFinishRef(finish, color) ?? color) : color;
}

function chairRefs(style: string) {
  if (!isKey(CHAIR_REFS, style)) throw new Error(`Unknown chair style "${style}"`);
  return CHAIR_REFS[style];
}

function linenRef(linen: string) {
  if (!isKey(LINEN_REFS, linen)) throw new Error(`Unknown linen "${linen}"`);
  return LINEN_REFS[linen];
}

/** The library reference for each slot a piece overrides: its card's linen and chair style. */
export function slotRefsFor(piece: PrismEventPiece): Partial<Record<SlotId, string>> {
  if (piece.type === "prism-table") return { linen: linenRef(piece.linen), ...chairRefs(piece.chairStyle) };
  if (piece.type === "prism-seating-block") return CHAIR_REFS.banquet;
  return {};
}

/** The material for one slot of a piece, at the editor's current shading. */
export function slotMaterial(piece: PrismEventPiece, slot: string, shading: string): Material {
  if (!isKey(SLOT_LOOKS, slot)) throw new Error(`Unknown material slot "${slot}"`);
  return designRuntime().material(slotRefsFor(piece)[slot] ?? defaultRef(slot), shading);
}
