import { describe, expect, it } from "vitest";
import type { FloorplanSceneDocument } from "@prism/types";
import { roomScene } from "./convert-legacy-plan.js";
import { layoutChecks } from "./layout-checks.js";

type Fields = Record<string, unknown>;

/** A 20 × 15 m room holding the given pieces, each named by its id as its label. */
function room(pieces: Array<[string, string, Fields]>): FloorplanSceneDocument {
  const { scene, levelId } = roomScene({ name: "Ballroom", widthM: 20, heightM: 15 }, "1.1.6");
  const nodes = Object.fromEntries(
    pieces.map(([id, type, fields]) => [id, { id, type, parentId: levelId, visible: true, label: id, rotation: 0, width: 1, depth: 1, ...fields }]),
  );
  const level = scene.nodes[levelId]!;
  return { ...scene, nodes: { ...scene.nodes, ...nodes, [levelId]: { ...level, children: [...(level.children as string[]), ...Object.keys(nodes)] } } };
}

const round = (x: number, z: number): Fields => ({ shape: "round", position: [x, 0, z], width: 1.8, depth: 1.8, seats: 8, guestIds: [] });
const kinds = (scene: FloorplanSceneDocument) => layoutChecks(scene).map((issue) => [issue.kind, issue.pieceIds]);

describe("layoutChecks", () => {
  it("passes a room laid out with room to move", () => {
    expect(layoutChecks(room([["A", "prism-table", round(4, 6)], ["B", "prism-table", round(7.5, 6)]]))).toEqual([]);
  });

  it("finds tables too close, pieces on top of each other, and pieces outside the room", () => {
    const scene = room([
      ["A", "prism-table", round(4, 6)],
      ["B", "prism-table", round(7.2, 6)],
      ["bar1", "prism-bar", { shape: "straight", position: [12, 0, 12], width: 3, depth: 0.8 }],
      ["bar2", "prism-bar", { shape: "straight", position: [13, 0, 12.3], width: 3, depth: 0.8 }],
      ["far", "prism-table", round(25, 6)],
    ]);
    expect(kinds(scene)).toEqual([
      ["tight", ["A", "B"]],
      ["overlap", ["bar1", "bar2"]],
      ["outside-room", ["far"]],
    ]);
    expect(layoutChecks(scene)[0]?.message).toBe("A and B are 1.4 m apart; seated tables need 1.5 m for chairs and service.");
  });

  it("finds a blocked exit and seating aisles that are too narrow or missing", () => {
    const scene = room([
      ["exit", "prism-safety", { variant: "emergency-exit", position: [19, 0, 7], width: 1.8, depth: 1.5 }],
      ["buffet", "prism-catering", { variant: "buffet", position: [18.8, 0, 7.4], width: 3, depth: 0.8 }],
      ["narrow", "prism-seating-block", { style: "theater", position: [5, 0, 11], rows: 2, columns: 6, aisle: 0.8, width: 3.8, depth: 1.8 }],
      ["long", "prism-seating-block", { style: "theater", position: [12, 0, 3], rows: 2, columns: 16, aisle: 0, width: 8, depth: 1.8 }],
    ]);
    expect(kinds(scene)).toEqual([
      ["exit-blocked", ["buffet", "exit"]],
      ["aisle", ["narrow"]],
      ["aisle", ["long"]],
    ]);
  });

  it("finds seats whose view of the stage is behind something tall", () => {
    const scene = room([
      ["stage", "prism-stage", { variant: "stage", position: [10, 0, 2], width: 6, depth: 3 }],
      ["speaker", "prism-av", { variant: "speaker", position: [10, 0, 6], width: 0.6, depth: 0.6 }],
      ["T1", "prism-table", round(10, 9)],
      ["T2", "prism-table", round(4, 9)],
    ]);
    const sightlines = layoutChecks(scene).filter((issue) => issue.kind === "sightline");
    expect(sightlines.map((issue) => issue.pieceIds)).toEqual([["T1"]]);
    expect(sightlines[0]?.message).toMatch(/^T1: \d seats? cannot see Stage past Speaker\.$/);
  });
});
