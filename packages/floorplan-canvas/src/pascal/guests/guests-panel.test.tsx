/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PrismFloorplanSeatingGuest } from "@prism/types";
import { PrismFloorplanProvider, type PrismFloorplanContextValue } from "../editor-context";

const scene = vi.hoisted(() => ({ nodes: {} as Record<string, unknown>, selected: [] as string[], updateNode: vi.fn() }));

vi.mock("@pascal-app/core", () => ({
  useScene: Object.assign((select: (state: unknown) => unknown) => select({ nodes: scene.nodes, rootNodeIds: ["level"] }), {
    getState: () => ({ nodes: scene.nodes, updateNode: scene.updateNode }),
  }),
}));
vi.mock("@pascal-app/viewer", () => ({ useViewer: (select: (state: unknown) => unknown) => select({ selection: { selectedIds: scene.selected } }) }));

const { GuestsPanel } = await import("./guests-panel");

const guest = (id: string, name: string, rsvp: PrismFloorplanSeatingGuest["rsvp"] = "confirmed"): PrismFloorplanSeatingGuest => ({
  id,
  name,
  group: "Family",
  rsvp,
  dietary: null,
});
const roster = [guest("g1", "Ana Reyes"), guest("g2", "Ben Cruz"), guest("g3", "Cara Diaz", "declined")];

function table(seats: number, guestIds: string[]) {
  return { id: "t1", type: "prism-table", parentId: "level", visible: true, shape: "round", position: [0, 0, 0], rotation: 0, width: 1.8, depth: 1.8, number: 3, seats, guestIds };
}

function openGuests(seating: PrismFloorplanContextValue["seating"] = { allowed: true, reason: null }) {
  const context: PrismFloorplanContextValue = {
    readOnly: false,
    guests: roster,
    suppliers: [],
    seating,
    guestCount: 3,
    saveState: "saved",
    onRetrySave: () => undefined,
    onReload: () => undefined,
    unmatchedSeats: 0,
  };
  render(
    <PrismFloorplanProvider value={context}>
      <GuestsPanel />
    </PrismFloorplanProvider>,
  );
}

function roomWith(tableNode: ReturnType<typeof table>) {
  scene.nodes = { level: { id: "level", type: "level", parentId: null, visible: true }, t1: tableNode };
  scene.selected = ["t1"];
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the Guests panel", () => {
  it("seats a guest at the selected table and never lists declined guests", () => {
    roomWith(table(8, []));
    openGuests();
    expect(screen.getByText("Seating at T3 · 0 of 8")).toBeTruthy();
    expect(screen.queryByText("Cara Diaz")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ana Reyes/ }));
    expect(scene.updateNode).toHaveBeenCalledWith("t1", { guestIds: ["g1"] });
  });

  it("refuses a full table with the rule's message", () => {
    roomWith(table(1, ["g2"]));
    openGuests();
    fireEvent.click(screen.getByRole("button", { name: /Ana Reyes/ }));
    expect(screen.getByRole("alert").textContent).toBe("This table has no free seats.");
    expect(scene.updateNode).not.toHaveBeenCalled();
  });

  it("explains why on a public event and offers no seat actions", () => {
    roomWith(table(8, []));
    openGuests({ allowed: false, reason: "Table assignment is only available for private events." });
    expect(screen.getByText("Table assignment is only available for private events.")).toBeTruthy();
    expect(screen.getByText("Ana Reyes")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
