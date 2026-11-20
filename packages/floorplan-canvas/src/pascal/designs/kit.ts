import type { Expr, Recipe } from "@pascal-app/core/procedural-items";
import { SLOT_LOOKS, type SlotId } from "./palette";

/**
 * Building blocks for Pascal procedural designs. Designs are version 2 recipes: version 2 adds part frames, `when` gates,
 * bool parameters and revolved profiles, which the event pieces need. Pascal renders them through its builder.
 */

export type Parameter = Recipe["parameters"][number];
export type Part = Recipe["parts"][number];
export type Shape = Part["shapes"][number];
export type Vec3 = [Expr, Expr, Expr];
export type Profile = [Expr, Expr][];

const TAU = 2 * Math.PI;
export const PI = Math.PI;
export const HALF_PI = Math.PI / 2;

const binary = (op: "add" | "sub" | "mul" | "div" | "min" | "max", args: Expr[]): Expr => ({ op, args });
export const add = (...args: Expr[]): Expr => binary("add", args);
export const sub = (left: Expr, right: Expr): Expr => binary("sub", [left, right]);
export const mul = (...args: Expr[]): Expr => binary("mul", args);
export const div = (left: Expr, right: Expr): Expr => binary("div", [left, right]);
export const min = (...args: Expr[]): Expr => binary("min", args);
export const max = (...args: Expr[]): Expr => binary("max", args);
export const mod = (left: Expr, right: Expr): Expr => ({ op: "mod", args: [left, right] });
export const floor = (value: Expr): Expr => ({ op: "floor", args: [value] });
export const ceil = (value: Expr): Expr => ({ op: "ceil", args: [value] });
export const sin = (value: Expr): Expr => ({ op: "sin", args: [value] });
export const cos = (value: Expr): Expr => ({ op: "cos", args: [value] });

/** The repeat index of a part, the 0-based count inside `part.count`. */
export const INDEX: Expr = "index";

/** The angle of repeat `index` around a ring of `count` equal steps. */
export const ringAngle = (count: Expr): Expr => mul(TAU, div(INDEX, count));

export function param(id: string, label: string, value: number, min: number, max: number, unit: Parameter["unit"], step = 0.05): Parameter {
  return { id, label, default: value, min, max, step, unit };
}

/** A whole-number count, or a 0/1 flag, that Pascal validates as an integer. */
export const count = (id: string, label: string, value: number, min: number, max: number): Parameter =>
  param(id, label, value, min, max, "count", 1);
export const flag = (id: string, label: string): Parameter => param(id, label, 0, 0, 1, "bool", 1);
export const metres = (id: string, label: string, value: number, min: number, max: number): Parameter =>
  param(id, label, value, min, max, "m", 0.01);

export function box(id: string, slot: SlotId, size: Vec3, position: Vec3, extras: { rotation?: Vec3; when?: Expr } = {}): Shape {
  return { id, primitive: "box", slot, size, position, ...extras };
}

/** A box with rounded edges of `radius`: cushions, rails and padded panels. */
export function roundedBox(id: string, slot: SlotId, size: Vec3, position: Vec3, radius: Expr, extras: { rotation?: Vec3; when?: Expr } = {}): Shape {
  return { id, primitive: "roundedBox", slot, size, position, radius, ...extras };
}

export function ellipsoid(id: string, slot: SlotId, size: Vec3, position: Vec3, extras: { when?: Expr } = {}): Shape {
  return { id, primitive: "ellipsoid", slot, size, position, ...extras };
}

export function cylinder(
  id: string,
  slot: SlotId,
  size: Vec3,
  position: Vec3,
  extras: { rotation?: Vec3; segments?: number; inner?: number; when?: Expr } = {},
): Shape {
  return { id, primitive: "cylinder", slot, size, position, ...extras };
}

/** A solid of revolution about the local Y axis; its profile is `[radius, height]` points. */
export function revolve(id: string, slot: SlotId, profile: Profile, position: Vec3, extras: { rotation?: Vec3; segments?: number; when?: Expr } = {}): Shape {
  return { id, primitive: "revolve", slot, profile, position, ...extras };
}

export function part(id: string, label: string, repeat: Expr, shapes: Shape[], extras: { frame?: { position: Vec3; rotation?: Vec3 }; when?: Expr } = {}): Part {
  return { id, label, count: repeat, shapes, ...extras };
}

/** The slots a design's parts use, each with its palette entry, in first-use order. */
function slotsOf(parts: Part[]): Recipe["slots"] {
  const used = new Set<SlotId>();
  for (const shape of parts.flatMap((candidate) => candidate.shapes)) used.add(shape.slot as SlotId);
  return [...used].map((id) => {
    const { label, color, finish } = SLOT_LOOKS[id];
    return { id, label, color, ...(finish ? { finish } : {}) };
  });
}

export type DesignInput = { name: string; description: string; parameters: Parameter[]; parts: Part[] };

export function designOf({ name, description, parameters, parts }: DesignInput): Recipe {
  return { version: 2, name, description, parameters, slots: slotsOf(parts), parts, constraints: [] };
}

/**
 * Pulls each value into its declared range and rounds counts and flags. A node can hold a value past a design's range
 * (a 40-seat table on a 24-seat design); the design builds at its limit rather than failing.
 */
export function clampedValues(recipe: Recipe, values: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    recipe.parameters.map((parameter) => {
      const raw = values[parameter.id] ?? parameter.default;
      const clamped = Math.min(parameter.max, Math.max(parameter.min, raw));
      return [parameter.id, parameter.unit === "count" || parameter.unit === "bool" ? Math.round(clamped) : clamped];
    }),
  );
}

export type EventDesign = { recipe: Recipe; values: Record<string, number> };
