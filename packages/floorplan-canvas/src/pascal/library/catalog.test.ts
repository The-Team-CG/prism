import { describe, expect, it } from "vitest";
import { placeableEventPieceSchemaFor } from "@prism/types";
import { prismEventLayoutPlugin } from "../event-layout-plugin";
import { placeNode } from "../tools/place-node";
import { LIBRARY_CATALOG, searchCatalog } from "./catalog";

describe("the Library catalog", () => {
  it("groups the tiles into the event sections, each a registered kind whose preset places a valid piece", () => {
    expect(LIBRARY_CATALOG.map(({ section }) => section)).toEqual([
      "Tables",
      "Seating blocks",
      "Stage & floor",
      "Food & bar",
      "AV & lighting",
      "Décor",
      "Outdoor & services",
      "Safety & guest flow",
      "Zones",
    ]);
    const registered = new Set(prismEventLayoutPlugin.nodes?.map((definition) => definition.kind));
    for (const { items } of LIBRARY_CATALOG) {
      for (const tile of items) {
        expect(registered.has(tile.kind), tile.id).toBe(true);
        const placed = placeNode(tile.kind, { ...prismEventLayoutPlugin.nodes?.find((d) => d.kind === tile.kind)?.defaults?.(), ...tile.preset }, [0, 0, 0], {}, "level");
        expect(placeableEventPieceSchemaFor(tile.kind).safeParse(placed).success, tile.id).toBe(true);
      }
    }
  });

  it("searches by name, so 'round' leaves only the round tables", () => {
    expect(searchCatalog("round")).toEqual([{ section: "Tables", items: LIBRARY_CATALOG[0]!.items.filter((tile) => tile.label.startsWith("Round")) }]);
    expect(searchCatalog("  ")).toEqual(LIBRARY_CATALOG);
  });
});

describe("placeNode", () => {
  it("gives a placed table the next number, its label and a new id, with nobody seated", () => {
    const nodes = { t3: { type: "prism-table", number: 3 }, t7: { type: "prism-table", number: 7 }, bar: { type: "prism-bar" } };
    const preset = { shape: "round", width: 1.8, depth: 1.8, seats: 8, rotation: 0, guestIds: ["copied"], id: "stale" };
    const first = placeNode("prism-table", preset, [2, 0, 3], nodes, "level_1");
    const second = placeNode("prism-table", preset, [2, 0, 3], nodes, "level_1");
    expect(first).toMatchObject({ type: "prism-table", number: 8, label: "T8", guestIds: [], parentId: "level_1", position: [2, 0, 3] });
    expect(first.id).toMatch(/^prism-table_/);
    expect(first.id).not.toBe(second.id);
  });
});
