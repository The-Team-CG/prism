"use client";

import { useScene, type AnyNode } from "@pascal-app/core";
import { useViewer } from "@pascal-app/viewer";
import type { PrismFloorplanSeatingGuest, PrismTableNode } from "@prism/types";
import { usePrismFloorplan } from "../editor-context";
import { openSeating } from "./host-state";

function useSelectedTable(): PrismTableNode | null {
  const selectedIds = useViewer((state) => state.selection.selectedIds);
  const node = useScene((state) => (selectedIds.length === 1 ? state.nodes[selectedIds[0] as AnyNode["id"]] : undefined));
  return (node as { type?: string } | undefined)?.type === "prism-table" ? (node as unknown as PrismTableNode) : null;
}

/** A guest the API would refuse at this table is called out, so the planner can unseat them. */
function detail(guest: PrismFloorplanSeatingGuest | undefined): { text: string; refused: boolean } {
  if (!guest) return { text: "Not on the guest list", refused: true };
  if (guest.rsvp === "declined") return { text: "Declined", refused: true };
  return { text: guest.group || guest.dietary || "", refused: false };
}

function unseat(table: PrismTableNode, guestId: string) {
  useScene.getState().updateNode(table.id as AnyNode["id"], { guestIds: table.guestIds.filter((id) => id !== guestId) } as Partial<AnyNode>);
}

/** Below a selected table's card: who sits at each seat, the open seats, and a way to seat more. */
export function SeatedGuestsFooter() {
  const table = useSelectedTable();
  const { guests, seating, readOnly } = usePrismFloorplan();
  if (!table) return null;
  const byId = new Map(guests.map((guest) => [guest.id, guest]));
  const open = Math.max(0, table.seats - table.guestIds.length);
  // Unseating stays open even when seating has closed, so a refused seat can always be cleared.
  const editable = !readOnly;
  return (
    <section aria-label="Seated guests" className="space-y-2 border-t border-border px-3 py-2.5 text-sm">
      <p className="flex justify-between text-xs font-semibold text-muted-foreground">
        <span>Seated</span>
        <span>
          {table.guestIds.length} of {table.seats}
        </span>
      </p>
      <ol className="space-y-1">
        {table.guestIds.map((guestId, index) => {
          const guest = byId.get(guestId);
          const about = detail(guest);
          return (
            <li key={guestId} className="flex items-center gap-2">
              <span className="w-5 text-xs text-muted-foreground">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-foreground">{guest?.name ?? "Unknown guest"}</span>
              <span className={`truncate text-xs ${about.refused ? "text-destructive" : "text-muted-foreground"}`}>{about.text}</span>
              {editable ? (
                <button type="button" onClick={() => unseat(table, guestId)} className="text-xs text-muted-foreground hover:text-foreground" aria-label={`Unseat ${guest?.name ?? "guest"}`}>
                  Unseat
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">{open === 0 ? (table.seats > 0 ? "Full · Unseat guests first to remove seats" : "No seats") : `${open} open ${open === 1 ? "seat" : "seats"}`}</p>
      {editable && seating.allowed && open > 0 ? (
        <button type="button" onClick={() => openSeating(table.id)} className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          Seat guests
        </button>
      ) : null}
    </section>
  );
}
