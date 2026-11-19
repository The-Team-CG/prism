"use client";

import { CircleCheck, LayoutDashboard, TriangleAlert } from "lucide-react";
import { useViewer } from "@pascal-app/viewer";
import { roomCapacity, roomSize } from "@prism/floorplan-scene";
import type { PrismLayoutIssue } from "@prism/types";
import { usePrismFloorplan } from "../editor-context";
import { footerCounts } from "./footer-counts";
import { selectIssue, useLayoutChecks } from "./layout-check-list";
import { useLiveScene } from "./use-live-scene";

const metres = (value: number) => `${Number(value.toFixed(1))}`;
const number = new Intl.NumberFormat("en");

function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="border-t border-border px-3 py-3">
      <h3 className="mb-2 flex items-center justify-between text-[11.5px] font-semibold text-foreground">
        {title}
        {aside ? <span className="font-medium text-muted-foreground">{aside}</span> : null}
      </h3>
      {children}
    </section>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <p className="flex h-7 items-center justify-between text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="tabular-nums text-foreground">{value}</span>
  </p>
);

/** Every layout check, each one selecting the pieces it is about. */
function Checks({ issues }: { issues: PrismLayoutIssue[] }) {
  if (issues.length === 0) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CircleCheck className="size-3.5 text-emerald-600" aria-hidden />
        Tables, aisles, exits and sightlines are clear.
      </p>
    );
  }
  return (
    <ul className="-mx-1.5 space-y-0.5">
      {issues.map((issue) => (
        <li key={`${issue.kind}:${issue.pieceIds.join()}`}>
          <button type="button" onClick={() => selectIssue(issue)} className="flex w-full gap-2 rounded-md px-1.5 py-1.5 text-left text-xs text-foreground hover:bg-muted">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
            {issue.message}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * What the inspector shows with nothing selected, as Figma shows the file's own properties: the room, how many it
 * holds, the seats against the guests, and every layout check.
 */
export function PlanPanel() {
  const selected = useViewer((state) => state.selection.selectedIds.length);
  const { guests, guestCount, seating, presentation } = usePrismFloorplan();
  const scene = useLiveScene();
  const issues = useLayoutChecks();
  if (selected > 0) return null;
  const room = roomSize(scene);
  const counts = footerCounts(scene, guests, guestCount);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" aria-label="Plan">
      <header className="flex h-12 shrink-0 items-center gap-2.5 px-3">
        <span className="inline-grid size-[30px] place-items-center rounded-lg bg-muted text-muted-foreground">
          <LayoutDashboard className="size-4" aria-hidden />
        </span>
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold text-foreground">Plan</span>
          <span className="block text-[11px] text-muted-foreground">{room ? `Room ${metres(room.width)} × ${metres(room.depth)} m` : "No room drawn yet"}</span>
        </span>
      </header>
      <Section title="Seats">
        <Row label="Seats placed" value={number.format(counts.seats)} />
        {presentation ? null : <Row label="Guests" value={number.format(counts.guests)} />}
        {seating.allowed ? <Row label="Seated" value={`${number.format(counts.seated)} of ${number.format(counts.guests)}`} /> : null}
      </Section>
      {room && !presentation ? (
        <Section title="The room holds">
          {roomCapacity(scene).map((entry) => (
            <Row key={entry.style} label={entry.label} value={`about ${number.format(entry.guests)}`} />
          ))}
        </Section>
      ) : null}
      {presentation ? null : (
        <Section title="Checks" aside={issues.length > 0 ? String(issues.length) : undefined}>
          <Checks issues={issues} />
        </Section>
      )}
    </div>
  );
}
