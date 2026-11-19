"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PrismFloorplanSeatingGuest, PrismFloorplanSupplier, SceneSaveState } from "@prism/types";

/** The event facts and save callbacks the host passes in, read by the header, footer, rail panels and cards. */
export type PrismFloorplanContextValue = {
  readOnly: boolean;
  guests: readonly PrismFloorplanSeatingGuest[];
  suppliers: readonly PrismFloorplanSupplier[];
  seating: { allowed: boolean; reason: string | null };
  /** The event's guest count, shown while the roster is empty. */
  guestCount: number;
  saveState: SceneSaveState;
  /** Why the last save failed, as the API said it, while `saveState` is "failed". */
  saveMessage?: string | null;
  onRetrySave(): void;
  onReload(): void;
  /**
   * A finished plan shown to someone who did not draw it, such as a client reading the official layout: the planner's
   * aids (layout checks and their lenses, capacity estimates, the guest list) stay out, and the plan is what remains.
   */
  presentation?: boolean;
};

const PrismFloorplanContext = createContext<PrismFloorplanContextValue | null>(null);

export function PrismFloorplanProvider({ value, children }: { value: PrismFloorplanContextValue; children: ReactNode }) {
  return <PrismFloorplanContext.Provider value={value}>{children}</PrismFloorplanContext.Provider>;
}

export function usePrismFloorplan(): PrismFloorplanContextValue {
  const value = useContext(PrismFloorplanContext);
  if (!value) throw new Error("usePrismFloorplan must be used inside PrismFloorplanEditor.");
  return value;
}
