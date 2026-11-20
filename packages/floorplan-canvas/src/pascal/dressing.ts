/**
 * How event pieces are dressed: the chair styles, fabric colours and centrepieces a piece's card offers. The 3D designs,
 * the plan symbols and the card all read these, so a choice the card offers always has a look in both views.
 */

export const CHAIR_STYLES = ["chiavari", "tiffany", "banquet", "ghost", "cross-back", "covered"] as const;
export type ChairStyle = (typeof CHAIR_STYLES)[number];

/**
 * Fabric colours for linens, overlays, runners and sashes: `dye` is the colour the 3D cloth is woven in, `fill` the
 * colour the plan lays the table in.
 */
export const FABRICS = {
  white: { dye: "#f7f5f0", fill: "#ffffff" },
  ivory: { dye: "#efe6d0", fill: "#f3ecd8" },
  champagne: { dye: "#e2d1b0", fill: "#eadcc3" },
  black: { dye: "#262225", fill: "#4a4247" },
  blush: { dye: "#ecc9c6", fill: "#f0d6d6" },
  "dusty rose": { dye: "#c99592", fill: "#d9a9a6" },
  sage: { dye: "#a3b28f", fill: "#b9c4a7" },
  navy: { dye: "#27334f", fill: "#3b4a6b" },
  burgundy: { dye: "#5e1f2c", fill: "#7a3040" },
  gold: { dye: "#c9a356", fill: "#d8b55b" },
  silver: { dye: "#c3c6ca", fill: "#d4d6d9" },
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
