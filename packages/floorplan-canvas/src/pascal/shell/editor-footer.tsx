"use client";

import { useEditor } from "@pascal-app/editor";
import { roomSize } from "@prism/floorplan-scene";
import { usePrismFloorplan } from "../editor-context";
import { footerCounts, type FooterCounts } from "./footer-counts";
import { selectIssue, useLayoutChecks } from "./layout-check-list";
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

const Dot = () => <span aria-hidden className="text-foreground/20">·</span>;

/** The first layout check, which selects its pieces; the rest are listed in the inspector's Plan panel. */
function FirstCheck() {
  const issues = useLayoutChecks();
  const first = issues[0];
  if (!first) return null;
  const more = issues.length - 1;
  return (
    <button type="button" onClick={() => selectIssue(first)} className="ml-2 inline-flex min-w-0 items-center gap-1.5 text-amber-800 hover:text-amber-950">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-amber-600" />
      <span className="truncate">{first.message}</span>
      {more > 0 ? <span className="shrink-0 text-muted-foreground">+{more} more</span> : null}
    </button>
  );
}

/** The status bar: guests against seats, how many are seated, the first layout check, the room's size and the grid. */
export function EditorFooter() {
  const { guests, guestCount, seating, saveState, saveMessage, readOnly, presentation } = usePrismFloorplan();
  const scene = useLiveScene();
  const gridStep = useEditor((state) => state.gridSnapStep);
  const counts = footerCounts(scene, guests, guestCount);
  const capacity = capacityText(counts);
  const room = roomSize(scene);
  return (
    <footer className="flex h-7 shrink-0 items-center gap-2 border-t border-border bg-background px-3 text-[11px] tabular-nums text-muted-foreground">
      {presentation ? (
        <span>{counts.seats} seats</span>
      ) : (
        <span>
          {capacity.text}
          {capacity.spare ? <span className={capacity.short ? "text-destructive" : undefined}> · {capacity.spare}</span> : null}
        </span>
      )}
      {seating.allowed ? (
        <>
          <Dot />
          <span>
            Seated {counts.seated} of {counts.guests}
          </span>
        </>
      ) : null}
      {saveState === "failed" && saveMessage ? (
        <span role="alert" className="ml-2 min-w-0 truncate text-destructive" title={saveMessage}>
          Not saved: {saveMessage}
        </span>
      ) : readOnly ? null : (
        <FirstCheck />
      )}
      <span className="flex-1" />
      {room ? (
        <>
          <span>
            Room {metres(room.width)} × {metres(room.depth)} m
          </span>
          <Dot />
        </>
      ) : null}
      <span>Grid {gridStep} m</span>
    </footer>
  );
}
