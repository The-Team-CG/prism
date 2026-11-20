/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { convertLegacyPlan } from "@prism/floorplan-scene";
import type { FloorPlanCanvasObject, FloorplanSceneDocument } from "@prism/types";
import { PrismFloorplanProvider, type PrismFloorplanContextValue } from "../editor-context";
import { layerGroups } from "./layer-groups";

const store = vi.hoisted(() => ({ nodes: {} as Record<string, unknown>, updateNode: vi.fn() }));

vi.mock("@pascal-app/core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useScene: Object.assign((select: (state: unknown) => unknown) => select({ nodes: store.nodes, rootNodeIds: [] }), {
    getState: () => ({ updateNode: store.updateNode }),
  }),
}));
vi.mock("@pascal-app/viewer", () => ({
  useViewer: Object.assign((select: (state: unknown) => unknown) => select({ selection: { selectedIds: [] } }), { getState: () => ({ setSelection: vi.fn() }) }),
}));

const { LayersPanel } = await import("./layers-panel");

function legacy(fields: Partial<FloorPlanCanvasObject> & Pick<FloorPlanCanvasObject, "id" | "name" | "kind" | "category">): FloorPlanCanvasObject {
  return { x: 4, y: 6, w: 1.8, h: 1.8, rotation: 0, fill: "#fff", stroke: "#000", strokeWidth: 0.04, locked: false, hidden: false, ...fields };
}

const converted = convertLegacyPlan(
  {
    name: "Ballroom",
    widthM: 20,
    heightM: 15,
    objects: [legacy({ id: "table_a", name: "Round Banquet (10pax)", kind: "ellipse", category: "furniture", seats: 10, assignedGuestIds: ["g1"] })],
  },
  "1.1.6",
);

const typeOf = (scene: FloorplanSceneDocument, id: string) => scene.nodes[id]?.type;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the Layers list", () => {
  it("groups a converted plan's walls under Venue and its tables under Tables, leaving empty groups out", () => {
    const groups = layerGroups(converted);
    expect(groups.map((group) => group.label)).toEqual(["Venue", "Tables"]);
    expect(groups[0]!.nodeIds.map((id) => typeOf(converted, id))).toEqual(["wall", "wall", "wall", "wall"]);
    expect(groups[1]!.nodeIds.map((id) => typeOf(converted, id))).toEqual(["prism-table"]);
    const numbered = { ...converted, nodes: { ...converted.nodes, b: { ...converted.nodes[groups[1]!.nodeIds[0]!]!, id: "b", number: 9 }, a: { ...converted.nodes[groups[1]!.nodeIds[0]!]!, id: "a", number: 2 } } };
    expect(layerGroups(numbered)[1]!.nodeIds.slice(0, 2)).toEqual(["a", "b"]);
  });

  it("keeps a seated table visible and says why, and offers no hide for the venue", () => {
    store.nodes = converted.nodes;
    const context: PrismFloorplanContextValue = {
      readOnly: false,
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
        <LayersPanel />
      </PrismFloorplanProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Hide / }));
    expect(screen.getByRole("alert").textContent).toBe("Unseat guests to hide this table");
    expect(store.updateNode).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: /^Hide / })).toHaveLength(1);
  });
});
