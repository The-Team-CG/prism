import { useSyncExternalStore } from "react";

/** The tabs of the editor's left panel. */
export type PanelTab = "library" | "guests" | "layers";

/**
 * Host facts that Pascal's node callbacks read outside React (quick actions run from Pascal's action bar), the table
 * the Guests panel seats guests at, and the left panel's open tab.
 */
type HostState = { seatingAllowed: boolean; readOnly: boolean; seatingTarget: string | null; panelTab: PanelTab };

let state: HostState = { seatingAllowed: false, readOnly: true, seatingTarget: null, panelTab: "library" };
const listeners = new Set<() => void>();

function update(next: Partial<HostState>) {
  state = { ...state, ...next };
  for (const listener of [...listeners]) listener();
}

export const hostState = {
  get: (): HostState => state,
  setFacts: (facts: Pick<HostState, "seatingAllowed" | "readOnly">) => update(facts),
  setSeatingTarget: (tableId: string | null) => update({ seatingTarget: tableId }),
  setPanelTab: (panelTab: PanelTab) => update({ panelTab }),
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const seatingTarget = () => state.seatingTarget;
export const useSeatingTarget = () => useSyncExternalStore(hostState.subscribe, seatingTarget, seatingTarget);

const panelTab = () => state.panelTab;
export const usePanelTab = () => useSyncExternalStore(hostState.subscribe, panelTab, panelTab);

/** Opens the Guests tab to seat guests at `tableId`. */
export function openSeating(tableId: string) {
  update({ seatingTarget: tableId, panelTab: "guests" });
}
