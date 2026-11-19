"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useEditor } from "@pascal-app/editor";
import { usePrismFloorplan } from "../editor-context";
import { searchCatalog, type LibraryItem } from "./catalog";
import { RoomPlanner } from "./room-planner";

/** A top-down outline in the tile's real proportions: round tables as circles, everything else as a rectangle. */
function TileSymbol({ tile }: { tile: LibraryItem }) {
  const { shape, width = 1, depth = 1 } = tile.preset as { shape?: string; width?: number; depth?: number };
  const scale = 28 / Math.max(width, depth);
  const [w, d] = [Math.max(width * scale, 4), Math.max(depth * scale, 4)];
  const round = shape === "round" || shape === "cocktail";
  return (
    <svg viewBox="0 0 32 32" className="size-8 text-muted-foreground" aria-hidden>
      {round ? (
        <circle cx="16" cy="16" r={w / 2} fill="none" stroke="currentColor" strokeWidth="1.5" />
      ) : (
        <rect x={16 - w / 2} y={16 - d / 2} width={w} height={d} rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      )}
    </svg>
  );
}

function useArmedTile() {
  const [armedId, setArmedId] = useState<string | null>(null);
  const armedKind = useEditor((state) => (state.mode === "build" ? state.tool : null));
  const disarm = () => {
    useEditor.getState().setTool(null);
    setArmedId(null);
  };
  const arm = (tile: LibraryItem) => {
    useEditor.getState().setToolDefaults(tile.kind, tile.preset);
    useEditor.getState().armToolMode({ mode: "build", tool: tile.kind });
    setArmedId(tile.id);
  };
  return { armed: armedId, isArmed: (tile: LibraryItem) => armedId === tile.id && armedKind === tile.kind, arm, disarm, active: armedId !== null && armedKind !== null };
}

/** The pieces a planner places by clicking a tile, then the plan. */
export function LibraryPanel() {
  const { readOnly } = usePrismFloorplan();
  const [query, setQuery] = useState("");
  const { isArmed, arm, disarm, active } = useArmedTile();

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") disarm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (readOnly) return null;
  const sections = searchCatalog(query);
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <label className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-sm">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pieces"
          aria-label="Search pieces"
          className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      <RoomPlanner />
      {active ? (
        <p role="status" className="rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary">
          Click the plan to place · Esc
        </p>
      ) : null}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {sections.length === 0 ? <p className="text-sm text-muted-foreground">No pieces match “{query}”.</p> : null}
        {sections.map(({ section, items }) => (
          <section key={section} aria-label={section}>
            <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">{section}</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  aria-pressed={isArmed(tile)}
                  onClick={() => arm(tile)}
                  className="flex flex-col items-center gap-1 rounded-md border border-border p-2 text-center hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/5"
                >
                  <TileSymbol tile={tile} />
                  <span className="text-xs font-medium text-foreground">{tile.label}</span>
                  <span className="text-[11px] text-muted-foreground">{tile.meta}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
