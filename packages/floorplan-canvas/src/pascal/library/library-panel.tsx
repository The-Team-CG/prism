"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { useEditor } from "@pascal-app/editor";
import { usePrismFloorplan } from "../editor-context";
import { searchCatalog, type LibraryItem } from "./catalog";
import { RoomPlanner } from "./room-planner";
import { tileGlyph } from "./tile-glyph";

/** The piece as the plan draws it, chairs and all. */
function TileSymbol({ tile }: { tile: LibraryItem }) {
  const glyph = useMemo(() => tileGlyph(tile), [tile]);
  return <svg viewBox={glyph.viewBox} className="prism-tile-glyph size-9" aria-hidden dangerouslySetInnerHTML={{ __html: glyph.body }} />;
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
  return { isArmed: (tile: LibraryItem) => armedId === tile.id && armedKind === tile.kind, arm, disarm, active: armedId !== null && armedKind !== null };
}

/** Sections open when the panel opens; the rest open on a click, so the list starts short. */
const OPEN_AT_START = 3;

function Tile({ tile, armed, onArm }: { tile: LibraryItem; armed: boolean; onArm(): void }) {
  return (
    <button
      type="button"
      aria-pressed={armed}
      onClick={onArm}
      title={`${tile.label} · ${tile.meta}`}
      className="flex h-[82px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-center hover:bg-muted aria-pressed:bg-primary/5 aria-pressed:shadow-[inset_0_0_0_1.5px_var(--primary)]"
    >
      <TileSymbol tile={tile} />
      <span className="mt-1 w-full truncate text-[11.5px] font-medium text-foreground">{tile.label}</span>
      <span className="w-full truncate text-[10.5px] text-muted-foreground">{tile.meta}</span>
    </button>
  );
}

/** The pieces a planner places by clicking a tile, then the plan. */
export function LibraryPanel() {
  const { readOnly } = usePrismFloorplan();
  const [query, setQuery] = useState("");
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
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
  const searching = query.trim() !== "";
  const isOpen = (index: number, section: string) => searching || (index < OPEN_AT_START) !== toggled.has(section);
  const toggle = (section: string) =>
    setToggled((current) => {
      const next = new Set(current);
      if (!next.delete(section)) next.add(section);
      return next;
    });
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 px-3 pb-3">
        <label className="flex h-8 items-center gap-2 rounded-lg bg-muted px-2.5 text-[13px]">
          <Search className="size-3.5 text-muted-foreground" aria-hidden />
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
          <p role="status" className="rounded-lg bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary">
            Click the plan to place · Esc
          </p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sections.length === 0 ? <p className="px-3 text-sm text-muted-foreground">No pieces match “{query}”.</p> : null}
        {sections.map(({ section, items }, index) => {
          const open = isOpen(index, section);
          return (
            <section key={section} aria-label={section} className="border-t border-border">
              <button type="button" aria-expanded={open} onClick={() => toggle(section)} className="flex h-9 w-full items-center justify-between px-3 text-[11.5px] font-semibold text-foreground">
                {section}
                <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                  {items.length}
                  <ChevronRight className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
                </span>
              </button>
              {open ? (
                <div className="grid grid-cols-3 gap-1 px-2 pb-2">
                  {items.map((tile) => (
                    <Tile key={tile.id} tile={tile} armed={isArmed(tile)} onArm={() => arm(tile)} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
