"use client";

import { useEditor } from "@pascal-app/editor";
import { usePrismFloorplan } from "../editor-context";
import { footerCounts, roomSize, type FooterCounts } from "./footer-counts";
import { useLiveScene } from "./use-live-scene";

const metres = (value: number) => `${Number(value.toFixed(1))}`;

function capacityText({ guests, seats }: FooterCounts): { text: string; spare: string | null; short: boolean } {
  if (seats === 0) return { text: `0 seats for ${guests} guests`, spare: null, short: false };
  const difference = seats - guests;
  return {
    text: `${guests} guests · ${seats} seats`,
    spare: difference === 0 ? null : difference > 0 ? `${difference} spare` : `${-difference} short`,
    short: difference < 0,
  };
}

/** Below the editor: guests against seats, how many are seated, the room's size and the snapping grid. */
export function EditorFooter() {
  const { guests, guestCount, seating } = usePrismFloorplan();
  const scene = useLiveScene();
  const gridStep = useEditor((state) => state.gridSnapStep);
  const counts = footerCounts(scene, guests, guestCount);
  const capacity = capacityText(counts);
  const room = roomSize(scene);
  return (
    <footer className="flex h-8 shrink-0 items-center gap-5 border-t border-border bg-background px-4 text-xs text-muted-foreground">
      <span>
        {capacity.text}
        {capacity.spare ? <span className={capacity.short ? "text-destructive" : undefined}> · {capacity.spare}</span> : null}
      </span>
      {seating.allowed ? <span>Seated {counts.seated} of {counts.guests}</span> : null}
      <span className="flex-1" />
      {room ? <span>Room {metres(room.width)} × {metres(room.depth)} m</span> : null}
      <span>Grid {gridStep} m</span>
    </footer>
  );
}
