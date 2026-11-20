/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { roomScene } from "@prism/floorplan-scene";
import type { FloorplanSceneDocument } from "@prism/types";
import { PrismFloorplanProvider, type PrismFloorplanContextValue } from "../editor-context";

const viewer = vi.hoisted(() => ({ selectedIds: [] as string[], setSelection: vi.fn() }));
const live = vi.hoisted(() => ({ scene: null as unknown }));

vi.mock("@pascal-app/viewer", () => ({
  useViewer: Object.assign((select: (state: unknown) => unknown) => select({ selection: { selectedIds: viewer.selectedIds } }), {
    getState: () => ({ setSelection: viewer.setSelection }),
  }),
}));
vi.mock("./use-live-scene", () => ({ useLiveScene: () => live.scene }));

const { PlanPanel } = await import("./plan-panel");

/** A 20 × 15 m ballroom with two round tables 1.4 m apart, one short of the 1.5 m a seated pair needs. */
function ballroom(): FloorplanSceneDocument {
  const { scene, levelId } = roomScene({ name: "Ballroom", widthM: 20, heightM: 15 }, "1.1.6");
  const table = (id: string, x: number) => ({ id, type: "prism-table", parentId: levelId, visible: true, label: id, rotation: 0, shape: "round", position: [x, 0, 6], width: 1.8, depth: 1.8, seats: 8, guestIds: [] });
  const level = scene.nodes[levelId]!;
  return { ...scene, nodes: { ...scene.nodes, A: table("A", 4), B: table("B", 7.2), [levelId]: { ...level, children: [...(level.children as string[]), "A", "B"] } } };
}

const context = { readOnly: false, guests: [], suppliers: [], seating: { allowed: true, reason: null }, guestCount: 20, saveState: "saved", onRetrySave: () => undefined, onReload: () => undefined } as unknown as PrismFloorplanContextValue;

function openPanel(overrides: Partial<PrismFloorplanContextValue> = {}) {
  render(
    <PrismFloorplanProvider value={{ ...context, ...overrides }}>
      <PlanPanel />
    </PrismFloorplanProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  viewer.selectedIds = [];
});

describe("the Plan panel", () => {
  it("shows the room, its seats and every layout check, and a check selects the pieces it is about", () => {
    live.scene = ballroom();
    openPanel();
    expect(screen.getByText("Room 20 × 15 m")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Seats" })).getByText("16")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("region", { name: "Checks" })).getByRole("button", { name: /A and B are 1.4 m apart/ }));
    expect(viewer.setSelection).toHaveBeenCalledWith({ selectedIds: ["A", "B"] });
  });

  it("shows a presented plan without the planner's checks, capacity estimates or guest count", () => {
    live.scene = ballroom();
    openPanel({ readOnly: true, presentation: true });
    expect(screen.getByText("Room 20 × 15 m")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Seats" })).getByText("16")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Checks" })).toBeNull();
    expect(screen.queryByText("The room holds")).toBeNull();
    expect(screen.queryByText("Guests")).toBeNull();
  });

  it("steps aside while something is selected, so the inspector shows the selection", () => {
    live.scene = ballroom();
    viewer.selectedIds = ["A"];
    openPanel();
    expect(screen.queryByText("Room 20 × 15 m")).toBeNull();
  });
});
