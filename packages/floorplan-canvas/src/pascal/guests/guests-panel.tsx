"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useScene, type AnyNode } from "@pascal-app/core";
import { useViewer } from "@pascal-app/viewer";
import { prismTableNodeSchema, type FloorplanSceneDocument, type PrismTableNode } from "@prism/types";
import { usePrismFloorplan } from "../editor-context";
import { useSeatingTarget } from "../inspector/host-state";
import { useLiveScene } from "../shell/use-live-scene";
import { seatGuest, unseatedGuestGroups } from "./seating";

type Table = PrismTableNode & { label?: unknown };

/** The table guests are seated at: the one selected on the plan, else the one "Seat guests" opened the panel for. */
function useTargetTable(scene: FloorplanSceneDocument): Table | null {
  const selectedIds = useViewer((state) => state.selection.selectedIds);
  const requested = useSeatingTarget();
  const id = selectedIds.length === 1 ? selectedIds[0] : requested;
  const parsed = id ? prismTableNodeSchema.safeParse(scene.nodes[id]) : null;
  return parsed?.success ? parsed.data : null;
}

const tableName = (table: Table) => (typeof table.label === "string" && table.label) || (table.number ? `T${table.number}` : "this table");

/** The event's guests still to seat, seated at the target table with a click when the event can seat guests. */
export function GuestsPanel() {
  const { guests, seating, readOnly } = usePrismFloorplan();
  const scene = useLiveScene();
  const target = useTargetTable(scene);
  const [query, setQuery] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const canSeat = seating.allowed && !readOnly && target !== null;
  const groups = unseatedGuestGroups(scene, guests, query);

  const seat = (guestId: string) => {
    if (!target) return;
    const result = seatGuest(scene, guests, target.id, guestId);
    if ("refusal" in result) return setRefusal(result.refusal);
    setRefusal(null);
    useScene.getState().updateNode(target.id as AnyNode["id"], { guestIds: result.guestIds } as Partial<AnyNode>);
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3 text-sm">
      {seating.allowed ? (
        <p className="text-xs text-muted-foreground">
          {target ? `Seating at ${tableName(target)} · ${target.guestIds.length} of ${target.seats}` : "Select a table on the plan to seat guests."}
        </p>
      ) : (
        <p className="rounded-md bg-muted px-2.5 py-2 text-xs text-foreground">{seating.reason ?? "Guests cannot be seated for this event."}</p>
      )}
      {refusal ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          {refusal}
        </p>
      ) : null}
      <label className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search guests"
          aria-label="Search guests"
          className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {guests.length === 0 ? <p className="text-xs text-muted-foreground">No guests are on this event&apos;s guest list yet.</p> : null}
        {groups.map(({ group, guests: members }) => (
          <section key={group} aria-label={group}>
            <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{group}</h3>
            <ul className="space-y-0.5">
              {members.map((guest) => {
                const label = (
                  <>
                    <span className="min-w-0 flex-1 truncate text-foreground">{guest.name}</span>
                    {guest.dietary ? <span className="truncate text-xs text-muted-foreground">{guest.dietary}</span> : null}
                    {guest.rsvp === "pending" ? <span className="text-xs text-muted-foreground">RSVP pending</span> : null}
                  </>
                );
                return (
                  <li key={guest.id}>
                    {canSeat ? (
                      <button type="button" onClick={() => seat(guest.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted">
                        {label}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-1">{label}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
