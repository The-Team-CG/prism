/**
 * A finish made from one of Pascal's textured library materials in a colour of our choosing. Pascal's fabrics and woods
 * bake one colour into their albedo texture; a finish keeps the texture's relief (normal, roughness and ao maps) and
 * either drops the baked colour for ours (`dye`: a fabric in any colour) or multiplies it (`stain`: a wood darkened or
 * warmed). Designs name finishes as plain strings, so they stay data; the editor's runtime builds the material.
 */
export type FinishMode = "dye" | "stain";

export type Finish = {
  /** The Pascal library material whose texture the finish keeps, e.g. `fabric-linen`. */
  library: string;
  mode: FinishMode;
  /** The colour as `#rrggbb`. */
  color: string;
  roughness?: number;
  metalness?: number;
  /** How many times the texture repeats per metre of the piece; finer weaves repeat more. */
  repeat?: number;
  /** How strongly the texture's relief shows, 1 being as Pascal ships it. */
  relief?: number;
  /** How see-through the surface is, 1 being solid; only a library material that is already transparent honours it. */
  opacity?: number;
  /** Light the surface gives off itself, for bulbs, screens and flames: its colour and strength (1 matches its own colour). */
  glow?: { color: string; intensity: number };
};

const PREFIX = "prism-finish:";

/** The reference a design names a finish by. */
export function finish(spec: Finish): string {
  return `${PREFIX}${JSON.stringify(spec)}`;
}

export const dyed = (library: string, color: string, extras: Omit<Finish, "library" | "mode" | "color"> = {}) => finish({ library, mode: "dye", color, ...extras });
export const stained = (library: string, color: string, extras: Omit<Finish, "library" | "mode" | "color"> = {}) => finish({ library, mode: "stain", color, ...extras });

/** The finish a reference names, or null for a plain library reference or colour. */
export function parseFinish(ref: string): Finish | null {
  if (!ref.startsWith(PREFIX)) return null;
  return JSON.parse(ref.slice(PREFIX.length)) as Finish;
}
