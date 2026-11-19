import { describe, expect, it } from "vitest";
import type { FloorplanSceneDocument } from "@prism/types";
import { roomScene } from "./convert-legacy-plan.js";
import { layoutChecks } from "./layout-checks.js";
import { fillRoom, roomCapacity, type PlannedPiece } from "./room-planning.js";

/** A 20 × 15 m room with a 6 × 3 m stage at its top edge. */
function ballroom(): { scene: FloorplanSceneDocument; levelId: string } {
  const { scene, levelId } = roomScene({ name: "Ballroom", widthM: 20, heightM: 15 }, "1.1.6");
  const stage = { id: "stage", type: "prism-stage", parentId: levelId, visible: true, variant: "stage", position: [10, 0, 2], rotation: 0, width: 6, depth: 3 };
  const level = scene.nodes[levelId]!;
  return { levelId, scene: { ...scene, nodes: { ...scene.nodes, stage, [levelId]: { ...level, children: [...(level.children as string[]), "stage"] } } } };
}

/** The scene with the planned pieces added, so the layout checks can judge the fill. */
function withPlanned({ scene, levelId }: ReturnType<typeof ballroom>, planned: PlannedPiece[]): FloorplanSceneDocument {
  const nodes = Object.fromEntries(planned.map(({ type, fields }, index) => [`p${index}`, { id: `p${index}`, type, parentId: levelId, visible: true, guestIds: [], ...fields }]));
  return { ...scene, nodes: { ...scene.nodes, ...nodes } };
}

describe("room planning", () => {
  it("says how many guests the floor left beside the stage holds in each style", () => {
    expect(roomCapacity(ballroom().scene)).toEqual([
      { style: "rounds", label: "Banquet rounds", guests: 256 },
      { style: "theater", label: "Theater", guests: 376 },
      { style: "classroom", label: "Classroom", guests: 176 },
      { style: "cocktail", label: "Cocktail", guests: 352 },
    ]);
  });

  it.each(["rounds", "theater", "classroom", "cocktail"] as const)("lays out %s for 100 guests that pass the layout checks", (style) => {
    const room = ballroom();
    const fill = fillRoom(room.scene, style, 100);
    expect(fill.short).toBe(0);
    expect(fill.pieces.length).toBeGreaterThan(0);
    expect(layoutChecks(withPlanned(room, fill.pieces))).toEqual([]);
  });

  it("says how many guests did not fit", () => {
    const fill = fillRoom(ballroom().scene, "rounds", 1000);
    expect(fill.seats).toBeLessThan(1000);
    expect(fill.short).toBe(1000 - fill.seats);
  });
});
