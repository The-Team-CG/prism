import { useSyncExternalStore } from "react";

/** How the plan is coloured: as laid out, by how full each table is, or by supplier zone. */
export type PrismLens = "layout" | "seating" | "supplier-zones";

let current: PrismLens = "layout";
const listeners = new Set<() => void>();

/** The plan's lens, shared by the lens switch and the overlay that draws it. */
export const prismLens = {
  get: (): PrismLens => current,
  set(lens: PrismLens) {
    if (lens === current) return;
    current = lens;
    for (const listener of [...listeners]) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const usePrismLens = () => useSyncExternalStore(prismLens.subscribe, prismLens.get, prismLens.get);

export type TableFill = "empty" | "part" | "full";

/** A table with nobody seated is empty, one with every seat taken is full, and anything between is part-full. */
export function tableFill(seats: number, seated: number): TableFill {
  if (seated <= 0) return "empty";
  return seated >= seats ? "full" : "part";
}
