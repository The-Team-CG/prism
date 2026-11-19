/**
 * Every material slot the event designs use. A slot names what a surface is made of; the materials that colour it
 * live in `materials.ts`, and a piece's card (linen, chair style) picks the instance per slot.
 */
export const SLOT_PALETTE = {
  table_top: { label: "Table top", color: "#d9cfc4", finish: "wood" },
  pedestal: { label: "Pedestal", color: "#9aa0a6", finish: "metal" },
  linen: { label: "Linen", color: "#ffffff" },
  centerpiece: { label: "Centerpiece", color: "#6f8f5c" },
  chair_frame: { label: "Chair frame", color: "#c8a24a", finish: "metal" },
  chair_seat: { label: "Chair seat", color: "#6b4c80" },
  chair_back: { label: "Chair back", color: "#6b4c80" },
  stage_deck: { label: "Stage deck", color: "#1f1a1d" },
  stage_skirt: { label: "Stage skirt", color: "#2a2428" },
  parquet: { label: "Parquet", color: "#b98a5a", finish: "wood" },
  bar_wood: { label: "Bar wood", color: "#5a3a2a", finish: "wood" },
  bar_top: { label: "Bar top", color: "#9aa0a6", finish: "metal" },
  led_panel: { label: "LED panel", color: "#111418", finish: "glass" },
  zone: { label: "Zone tint", color: "#40a0d0", finish: "glass" },
  av_body: { label: "AV body", color: "#2b2630" },
  av_driver: { label: "AV driver", color: "#555b61", finish: "metal" },
  catering_body: { label: "Catering body", color: "#e9e2d8" },
  catering_top: { label: "Catering top", color: "#9aa0a6", finish: "metal" },
  cake: { label: "Cake", color: "#e8c4c4" },
  desk_body: { label: "Desk body", color: "#5a3a2a", finish: "wood" },
  desk_top: { label: "Desk top", color: "#8a5a3b", finish: "wood" },
  booth_wall: { label: "Booth wall", color: "#f4f0ea" },
  booth_fascia: { label: "Booth fascia", color: "#c01867" },
  decor_frame: { label: "Decor frame", color: "#9aa0a6", finish: "metal" },
  decor_fabric: { label: "Decor fabric", color: "#e8c4c4" },
  greenery: { label: "Greenery", color: "#6f8f5c" },
  safety_body: { label: "Safety body", color: "#f4f0ea" },
  safety_red: { label: "Safety red", color: "#c01867" },
  piece_body: { label: "Piece body", color: "#c9b8d6" },
  desk: { label: "Desk", color: "#8a5a3b", finish: "wood" },
} as const;

export type SlotId = keyof typeof SLOT_PALETTE;

export type SlotFinish = "glass" | "metal" | "wood";

/** The palette read as plain entries, so an entry without a finish types as one with `finish` unset. */
export const SLOT_LOOKS: Record<SlotId, { label: string; color: string; finish?: SlotFinish }> = SLOT_PALETTE;
