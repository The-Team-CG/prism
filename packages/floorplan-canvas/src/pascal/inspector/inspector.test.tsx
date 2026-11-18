/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PrismFloorplanSeatingGuest, PrismTableNode } from "@prism/types";
import { PrismFloorplanProvider, type PrismFloorplanContextValue } from "../editor-context";

const scene = vi.hoisted(() => ({ nodes: {} as Record<string, unknown>, selected: [] as string[], updateNode: vi.fn() }));
const sidebar = vi.hoisted(() => ({ setActiveSidebarPanel: vi.fn() }));

vi.mock("@pascal-app/core", () => ({
  useScene: Object.assign((select: (state: unknown) => unknown) => select({ nodes: scene.nodes }), {
    getState: () => ({ nodes: scene.nodes, updateNode: scene.updateNode }),
  }),
}));
vi.mock("@pascal-app/viewer", () => ({ useViewer: (select: (state: unknown) => unknown) => select({ selection: { selectedIds: scene.selected } }) }));

const { SeatedGuestsFooter } = await import("./seated-guests-footer");
const { ZoneSuppliersField } = await import("./zone-suppliers-field");
const { tableParametrics, tableQuickActions } = await import("./parametrics");
const { hostState } = await import("./host-state");
hostState.setGuestsPanelOpener(() => sidebar.setActiveSidebarPanel("guests"));

const roster: PrismFloorplanSeatingGuest[] = ["Ana Reyes", "Ben Cruz", "Cara Diaz", "Dee Lim", "Eli Tan", "Fay Uy"].map((name, index) => ({
  id: `g${index + 1}`,
  name,
  group: index === 3 ? null : "Family",
  rsvp: "confirmed",
  dietary: index === 3 ? "Vegetarian" : null,
}));

const table = { id: "t1", type: "prism-table", shape: "round", width: 1.8, depth: 1.8, seats: 8, guestIds: roster.map((guest) => guest.id) } as unknown as PrismTableNode;

function context(overrides: Partial<PrismFloorplanContextValue> = {}): PrismFloorplanContextValue {
  return {
    readOnly: false,
    guests: roster,
    suppliers: [],
    seating: { allowed: true, reason: null },
    guestCount: 6,
    saveState: "saved",
    onRetrySave: () => undefined,
    onReload: () => undefined,
    unmatchedSeats: 0,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the table card", () => {
  it("offers the table fields with their ranges, and never drops seats below the guests seated", () => {
    const fields = tableParametrics.groups.flatMap((group) => group.fields);
    expect(fields.map((field) => field.label)).toEqual(["Shape", "Size", "Depth", "Seats", "Number", "Chairs", "Linen", "Centerpiece"]);
    expect(fields.find((field) => field.label === "Size")).toMatchObject({ min: 0.6, max: 3.6, step: 0.1 });
    expect(fields.find((field) => field.label === "Seats")).toMatchObject({ min: 0, max: 24, step: 1 });
    expect(tableParametrics.derive?.({ ...table, seats: 4 }, { seats: 4 })).toMatchObject({ seats: 6 });
  });

  it("lists who sits where, with group or dietary needs, the open seats and Seat guests", () => {
    scene.nodes = { t1: table };
    scene.selected = ["t1"];
    render(
      <PrismFloorplanProvider value={context()}>
        <SeatedGuestsFooter />
      </PrismFloorplanProvider>,
    );
    const dee = screen.getByText("Dee Lim").closest("li");
    expect(dee?.textContent).toContain("Vegetarian");
    expect(screen.getByText("2 open seats")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Seat guests" }));
    expect(hostState.get().seatingTarget).toBe("t1");
    expect(sidebar.setActiveSidebarPanel).toHaveBeenCalledWith("guests");
  });

  it("flags a seated guest the API would refuse and still lets PMCM unseat them after seating closes", () => {
    scene.nodes = { t1: { ...table, guestIds: ["g4", "gone"] } };
    scene.selected = ["t1"];
    const declined = roster.map((guest) => (guest.id === "g4" ? { ...guest, rsvp: "declined" as const } : guest));
    render(
      <PrismFloorplanProvider value={context({ guests: declined, seating: { allowed: false, reason: "Table assignment is only available for private events." } })}>
        <SeatedGuestsFooter />
      </PrismFloorplanProvider>,
    );
    expect(screen.getByText("Dee Lim").closest("li")?.textContent).toContain("Declined");
    expect(screen.getByText("Unknown guest").closest("li")?.textContent).toContain("Not on the guest list");
    fireEvent.click(screen.getByRole("button", { name: "Unseat Dee Lim" }));
    expect(scene.updateNode).toHaveBeenCalledWith("t1", { guestIds: ["gone"] });
    expect(screen.queryByRole("button", { name: "Seat guests" })).toBeNull();
  });

  it("offers Seat guests on the action bar only when the event can seat guests", () => {
    hostState.setFacts({ seatingAllowed: true, readOnly: false });
    expect(tableQuickActions({ node: table }).map((action) => action.label)).toEqual(["Seat guests"]);
    hostState.setFacts({ seatingAllowed: false, readOnly: false });
    expect(tableQuickActions({ node: table })).toEqual([]);
  });
});

describe("the zone card", () => {
  it("lists the suppliers booked on the event by name", () => {
    const onUpdate = vi.fn();
    const suppliers = [
      { id: "s1", name: "Lumen Lights", kind: "AV" },
      { id: "s2", name: "Feast Co", kind: "Catering" },
    ];
    render(
      <PrismFloorplanProvider value={context({ suppliers })}>
        <ZoneSuppliersField node={{ id: "z1", type: "prism-zone", label: "AV desk", supplierIds: ["s1"] } as never} onUpdate={onUpdate} />
      </PrismFloorplanProvider>,
    );
    expect(screen.getByRole("checkbox", { name: /Lumen Lights/ })).toHaveProperty("checked", true);
    fireEvent.click(screen.getByRole("checkbox", { name: /Feast Co/ }));
    expect(onUpdate).toHaveBeenCalledWith({ supplierIds: ["s1", "s2"] });
  });

  it("lets PMCM remove a supplier the zone names who is no longer booked", () => {
    const onUpdate = vi.fn();
    render(
      <PrismFloorplanProvider value={context()}>
        <ZoneSuppliersField node={{ id: "z1", type: "prism-zone", label: "AV desk", supplierIds: ["s_gone"] } as never} onUpdate={onUpdate} />
      </PrismFloorplanProvider>,
    );
    expect(screen.getByText("A supplier no longer booked on this event")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onUpdate).toHaveBeenCalledWith({ supplierIds: [] });
  });
});
