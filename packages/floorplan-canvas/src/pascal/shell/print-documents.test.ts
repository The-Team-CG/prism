import { describe, expect, it } from "vitest";
import { roomScene } from "@prism/floorplan-scene";
import type { FloorplanSceneDocument } from "@prism/types";
import { planHtml, pullSheetHtml } from "./print-documents";

/** A 20 × 15 m room holding one round table and one labelled stage. */
function plan(): FloorplanSceneDocument {
  const { scene, levelId } = roomScene({ name: "Ballroom", widthM: 20, heightM: 15 }, "1.1.6");
  const pieces = {
    t1: { id: "t1", type: "prism-table", parentId: levelId, visible: true, shape: "round", position: [5, 0, 5], rotation: 0, width: 1.8, depth: 1.8, seats: 8, number: 1, guestIds: [] },
    s1: { id: "s1", type: "prism-stage", parentId: levelId, visible: true, variant: "stage", label: "<b>Main</b> stage", position: [10, 0, 2], rotation: 0, width: 6, depth: 4, steps: true },
  };
  const level = scene.nodes[levelId]!;
  const children = [...(level.children as string[]), "t1", "s1"];
  return { ...scene, nodes: { ...scene.nodes, [levelId]: { ...level, children }, ...pieces } };
}

describe("printed documents", () => {
  it("draws the plan's walls and each piece's symbol, and lists what it needs", () => {
    const html = planHtml("Gala", plan());
    expect(html).toContain("Room 20 × 15 m");
    expect(html.match(/<line [^>]*stroke-width="0.2"/g)).toHaveLength(4);
    expect(html).toContain(">1</text>");
    expect(html).toContain("Round table 1.8 m");
    expect(html).toContain("Chiavari chairs");
  });

  it("escapes what people typed", () => {
    for (const html of [planHtml("Gala", plan()), pullSheetHtml("Gala & co", plan())]) {
      expect(html).not.toContain("<b>Main</b>");
    }
    expect(planHtml("Gala", plan())).toContain("&lt;b&gt;Main&lt;/b&gt; stage");
    expect(pullSheetHtml("Gala & co", plan())).toContain("Gala &amp; co");
  });
});
