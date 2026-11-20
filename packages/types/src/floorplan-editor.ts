import type { GuestRosterRsvp } from "./schemas/operations-guest-inputs.js";

/** A guest the floor plan editor can seat: one eligible entry on the event's guest roster. */
export interface PrismFloorplanSeatingGuest {
  id: string;
  name: string;
  /** The roster's category, shown as the guest's group. */
  group: string | null;
  rsvp: GuestRosterRsvp;
  dietary: string | null;
}

/** A supplier booked on the event, which a supplier zone may name. */
export interface PrismFloorplanSupplier {
  id: string;
  name: string;
  kind: string;
}

/** Where the editor's autosave stands: a 409 conflict stops autosave until the plan is reloaded. */
export type SceneSaveState = "saved" | "saving" | "failed" | "conflict";
