/**
 * How event pieces are dressed: the chair styles, fabric colours and centrepieces a piece's card offers. The 3D designs,
 * the plan symbols and the card all read these, so a choice the card offers always has a look in both views.
 */

export const CHAIR_STYLES = ["chiavari", "tiffany", "banquet", "ghost", "cross-back", "covered"] as const;
export type ChairStyle = (typeof CHAIR_STYLES)[number];

/**
 * Fabric colours for linens, overlays, runners and sashes: `ref` is Pascal's library material the 3D cloth wears, `fill`
 * the colour the plan lays in under the drawing.
 */
export const FABRICS = {
  white: { ref: "library:fabric-linen", fill: "#ffffff" },
  ivory: { ref: "library:preset-cream", fill: "#f3ecd8" },
  champagne: { ref: "library:preset-beige", fill: "#eadcc3" },
  black: { ref: "library:preset-nearblack", fill: "#4a4247" },
  blush: { ref: "library:preset-blush", fill: "#f0d6d6" },
  "dusty rose": { ref: "library:preset-dustyrose", fill: "#d9a9a6" },
  sage: { ref: "library:preset-sage", fill: "#b9c4a7" },
  navy: { ref: "library:preset-navy", fill: "#3b4a6b" },
  burgundy: { ref: "library:preset-oxblood", fill: "#7a3040" },
  gold: { ref: "library:preset-gold", fill: "#d8b55b" },
  silver: { ref: "library:preset-lightgrey", fill: "#d4d6d9" },
} as const;
export type Fabric = keyof typeof FABRICS;
export const FABRIC_NAMES = Object.keys(FABRICS) as Fabric[];

export const CENTERPIECES = ["none", "low floral", "tall floral", "candles"] as const;
export type Centerpiece = (typeof CENTERPIECES)[number];

const isOneOf = <T extends string>(values: readonly T[], value: string): value is T => (values as readonly string[]).includes(value);

export function chairStyleOf(value: string): ChairStyle {
  if (!isOneOf(CHAIR_STYLES, value)) throw new Error(`Unknown chair style "${value}"`);
  return value;
}

export function fabricOf(value: string): (typeof FABRICS)[Fabric] {
  if (!isOneOf(FABRIC_NAMES, value)) throw new Error(`Unknown fabric colour "${value}"`);
  return FABRICS[value];
}

/** A card's centrepiece; an unset one is a bare table. */
export function centerpieceOf(value: string | undefined): Centerpiece {
  if (value === undefined) return "none";
  if (!isOneOf(CENTERPIECES, value)) throw new Error(`Unknown centerpiece "${value}"`);
  return value;
}

/** A sash or overlay: unset or "none" for none, otherwise its fabric. */
export function accentOf(value: string | undefined): (typeof FABRICS)[Fabric] | null {
  return value === undefined || value === "none" ? null : fabricOf(value);
}
