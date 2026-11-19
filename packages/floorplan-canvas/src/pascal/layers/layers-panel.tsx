"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, LockOpen } from "lucide-react";
import { useScene, type AnyNode } from "@pascal-app/core";
import { useViewer } from "@pascal-app/viewer";
import { usePrismFloorplan } from "../editor-context";
import { useLiveScene } from "../shell/use-live-scene";
import { hideRefusal, layerGroups, type LayerGroupId } from "./layer-groups";

type Row = { id: string; type: string; visible: boolean; label?: unknown; name?: unknown; number?: unknown; variant?: unknown; locked?: unknown; guestIds?: unknown };

/** A row's name: the planner's label, the table number, the piece's variant, or its kind. */
function rowName(row: Row): string {
  for (const candidate of [row.label, row.name]) if (typeof candidate === "string" && candidate) return candidate;
  if (typeof row.number === "number") return `T${row.number}`;
  if (typeof row.variant === "string" && row.variant) return row.variant.replace(/[-_]/g, " ");
  return row.type.replace(/^prism-/, "").replace(/-/g, " ");
}

const update = (id: string, patch: Record<string, unknown>) => useScene.getState().updateNode(id as AnyNode["id"], patch as Partial<AnyNode>);
const iconButton = "rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground";

function LayerRow({ row, venue, editable, selected, onRefused }: { row: Row; venue: boolean; editable: boolean; selected: boolean; onRefused(message: string): void }) {
  const toggleVisible = () => {
    const refusal = row.visible ? hideRefusal(row) : null;
    if (refusal) return onRefused(refusal);
    update(row.id, { visible: !row.visible });
  };
  const locked = venue || row.locked === true;
  return (
    <li className={`flex items-center gap-1 rounded-md pr-1 ${selected ? "bg-muted" : ""}`}>
      <button
        type="button"
        onClick={() => useViewer.getState().setSelection({ selectedIds: [row.id as AnyNode["id"]] })}
        className={`min-w-0 flex-1 truncate px-2 py-1 text-left capitalize ${row.visible ? "text-foreground" : "text-muted-foreground line-through"}`}
      >
        {rowName(row)}
      </button>
      {editable && !venue ? (
        <>
          <button type="button" onClick={toggleVisible} aria-label={row.visible ? `Hide ${rowName(row)}` : `Show ${rowName(row)}`} className={iconButton}>
            {row.visible ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
          </button>
          <button type="button" onClick={() => update(row.id, { locked: !locked })} aria-label={locked ? `Unlock ${rowName(row)}` : `Lock ${rowName(row)}`} className={iconButton}>
            {locked ? <Lock className="size-3.5" aria-hidden /> : <LockOpen className="size-3.5" aria-hidden />}
          </button>
        </>
      ) : locked ? (
        <Lock className="mx-1 size-3.5 text-muted-foreground" aria-label="Locked" />
      ) : null}
    </li>
  );
}

/** Every wall, column and piece in the room, grouped for event layouts: select, show or hide, lock. */
export function LayersPanel() {
  const { readOnly } = usePrismFloorplan();
  const scene = useLiveScene();
  const selectedIds = useViewer((state) => state.selection.selectedIds);
  const [refusal, setRefusal] = useState<string | null>(null);
  const groups = layerGroups(scene);
  const rowOf = (id: string) => scene.nodes[id] as Row;
  const isVenue = (id: LayerGroupId) => id === "venue";
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
      {refusal ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          {refusal}
        </p>
      ) : null}
      {groups.length === 0 ? <p className="text-xs text-muted-foreground">Nothing in the room yet.</p> : null}
      {groups.map((group) => (
        <section key={group.id} aria-label={group.label}>
          <h3 className="mb-1 text-xs font-semibold text-muted-foreground">
            {group.label} <span className="font-normal">{group.nodeIds.length}</span>
          </h3>
          <ul className="space-y-0.5">
            {group.nodeIds.map((id) => (
              <LayerRow key={id} row={rowOf(id)} venue={isVenue(group.id)} editable={!readOnly} selected={selectedIds.includes(id as AnyNode["id"])} onRefused={setRefusal} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
