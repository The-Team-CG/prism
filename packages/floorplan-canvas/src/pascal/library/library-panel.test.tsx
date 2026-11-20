/** @vitest-environment jsdom */
import { useSyncExternalStore } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PrismFloorplanProvider, type PrismFloorplanContextValue } from "../editor-context";

const editor = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let state: { mode: string; tool: string | null } = { mode: "select", tool: null };
  const update = (next: Partial<typeof state>) => {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  };
  const actions = {
    setToolDefaults: vi.fn(),
    armToolMode: vi.fn((next: { mode: string; tool?: string }) => update({ mode: next.mode, tool: next.tool ?? null })),
    setTool: vi.fn((tool: string | null) => update({ tool })),
  };
  return {
    actions,
    reset: () => update({ mode: "select", tool: null }),
    subscribe: (listener: () => void) => (listeners.add(listener), () => listeners.delete(listener)),
    snapshot: () => state,
  };
});

vi.mock("@pascal-app/editor", () => ({
  useEditor: Object.assign(
    (select: (state: unknown) => unknown) => select(useSyncExternalStore(editor.subscribe, editor.snapshot)),
    { getState: () => ({ ...editor.snapshot(), ...editor.actions }) },
  ),
}));

const { LibraryPanel } = await import("./library-panel");

function openLibrary(readOnly = false) {
  const context: PrismFloorplanContextValue = {
    readOnly,
    guests: [],
    suppliers: [],
    seating: { allowed: true, reason: null },
    guestCount: 0,
    saveState: "saved",
    onRetrySave: () => undefined,
    onReload: () => undefined,
  };
  render(
    <PrismFloorplanProvider value={context}>
      <LibraryPanel />
    </PrismFloorplanProvider>,
  );
}

afterEach(() => {
  cleanup();
  editor.reset();
  vi.clearAllMocks();
});

describe("the Library panel", () => {
  it("arms placement with the tile's kind and values, shows how to place, and Esc ends it", () => {
    openLibrary();
    fireEvent.click(screen.getByRole("button", { name: /Round · 8/ }));

    expect(editor.actions.setToolDefaults).toHaveBeenCalledWith("prism-table", { shape: "round", width: 1.8, depth: 1.8, seats: 8 });
    expect(editor.actions.armToolMode).toHaveBeenCalledWith({ mode: "build", tool: "prism-table" });
    expect(screen.getByRole("status").textContent).toBe("Click the plan to place · Esc");
    expect(screen.getByRole("button", { name: /Round · 8/ }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(editor.actions.setTool).toHaveBeenCalledWith(null);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("filters the tiles by the search", () => {
    openLibrary();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search pieces" }), { target: { value: "round" } });
    const tables = screen.getByRole("region", { name: "Tables" });
    expect(within(tables).getAllByRole("button", { pressed: false }).map((tile) => tile.textContent)).toEqual(["Round · 81.8 m · 8 seats", "Round · 101.8 m · 10 seats"]);
    expect(screen.queryByRole("region", { name: "AV & lighting" })).toBeNull();
  });

  it("offers nothing to place on a read-only plan", () => {
    openLibrary(true);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(editor.actions.armToolMode).not.toHaveBeenCalled();
  });
});
