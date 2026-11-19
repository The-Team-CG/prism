"use client";

import { useState } from "react";
import { ChevronDown, Wand2 } from "lucide-react";
import { useScene, type AnyNode } from "@pascal-app/core";
import { fillRoom, roomCapacity, roomSize, SEATING_STYLES, type SeatingStyle } from "@prism/floorplan-scene";
import type { FloorplanSceneDocument } from "@prism/types";
import { usePrismFloorplan } from "../editor-context";
import { eventPieceDefaults } from "../event-layout-plugin";
import { footerCounts } from "../shell/footer-counts";
import { useLiveScene } from "../shell/use-live-scene";
import { placeNode } from "../tools/place-node";

/** The level the room's walls stand on, which the fill places its pieces on. */
const roomLevel = (scene: FloorplanSceneDocument) => Object.values(scene.nodes).find((node) => node.type === "wall")?.parentId ?? null;

/** What a fill placed, in a planner's words. */
function outcome(style: SeatingStyle, placed: number, short: number): string {
  const what = style === "theater" || style === "classroom" ? "a seating block" : `${placed} ${style === "cocktail" ? "cocktail" : "round"} table${placed === 1 ? "" : "s"}`;
  if (placed === 0) return "Nothing fits in the floor left. Move or remove pieces and try again.";
  return short > 0 ? `Placed ${what}; ${short} guests did not fit.` : `Placed ${what}.`;
}

/** Adds the fill's pieces as one change, numbering tables after the room's highest. */
function placeFill(scene: FloorplanSceneDocument, style: SeatingStyle, guests: number, levelId: string): string {
  const fill = fillRoom(scene, style, guests);
  const nodes: Record<string, unknown> = { ...useScene.getState().nodes };
  const ops = fill.pieces.map(({ type, fields }) => {
    const node = placeNode(type, { ...eventPieceDefaults(type), ...fields }, fields.position as [number, number, number], nodes, levelId);
    nodes[node.id] = node;
    return { node: node as unknown as AnyNode, parentId: levelId as AnyNode["id"] };
  });
  if (ops.length > 0) useScene.getState().createNodes(ops);
  return outcome(style, fill.pieces.length, fill.short);
}

/**
 * How many guests the room holds in each seating style, and a first layout for the event's guests in one click. What is
 * already placed stays where it is; the fill takes the floor left, and undo takes it back in one step.
 */
export function RoomPlanner() {
  const scene = useLiveScene();
  const { guests, guestCount } = usePrismFloorplan();
  const levelId = roomLevel(scene);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<SeatingStyle>("rounds");
  const [count, setCount] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  if (!roomSize(scene) || !levelId) return null;
  const capacity = roomCapacity(scene);
  const target = count ?? footerCounts(scene, guests, guestCount).guests;
  return (
    <section aria-label="Plan the room" className="rounded-md border border-border">
      <button type="button" aria-expanded={open} onClick={() => setOpen((shown) => !shown)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm font-medium text-foreground">
        <Wand2 className="size-4 text-muted-foreground" aria-hidden />
        <span className="flex-1">Plan the room</span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-border px-2.5 py-2">
          <div role="radiogroup" aria-label="Seating style" className="grid grid-cols-2 gap-1">
            {capacity.map((entry) => (
              <button
                key={entry.style}
                type="button"
                role="radio"
                aria-checked={style === entry.style}
                onClick={() => setStyle(entry.style)}
                className="rounded border border-border px-2 py-1 text-left aria-checked:border-primary aria-checked:bg-primary/5"
              >
                <span className="block text-xs font-medium text-foreground">{entry.label}</span>
                <span className="block text-[11px] text-muted-foreground">holds about {entry.guests}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Guests
            <input
              type="number"
              min={1}
              value={target}
              onChange={(event) => setCount(Math.max(1, Number(event.target.value) || 1))}
              className="w-20 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={() => setResult(placeFill(scene, style, target, levelId))}
            className="w-full rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Fill with {SEATING_STYLES[style].label.toLowerCase()}
          </button>
          {result ? (
            <p role="status" className="text-xs text-muted-foreground">
              {result}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
