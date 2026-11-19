import { useSyncExternalStore } from "react";

/**
 * Host facts that Pascal's node callbacks read outside React (quick actions run from Pascal's action bar), and the
 * table the Guests panel seats guests at.
 */
type HostState = { seatingAllowed: boolean; readOnly: boolean; seatingTarget: string | null };

let state: HostState = { seatingAllowed: false, readOnly: true, seatingTarget: null };
const listeners = new Set<() => void>();
/** Set by the editor host, which owns Pascal's side menu; this module stays free of Pascal's editor runtime. */
let openGuestsPanel: () => void = () => undefined;

function update(next: Partial<HostState>) {
  state = { ...state, ...next };
  for (const listener of [...listeners]) listener();
}

export const hostState = {
  get: (): HostState => state,
  setFacts: (facts: Pick<HostState, "seatingAllowed" | "readOnly">) => update(facts),
  setSeatingTarget: (tableId: string | null) => update({ seatingTarget: tableId }),
  setGuestsPanelOpener(open: () => void) {
    openGuestsPanel = open;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const seatingTarget = () => state.seatingTarget;
export const useSeatingTarget = () => useSyncExternalStore(hostState.subscribe, seatingTarget, seatingTarget);

/** Opens the Guests panel to seat guests at `tableId`. */
export function openSeating(tableId: string) {
  hostState.setSeatingTarget(tableId);
  openGuestsPanel();
}
