import { describe, expect, it } from "vitest";
import { convertLegacyPlan } from "./convert-legacy-plan.js";
import { planDrawing, roomSize } from "./plan-drawing.js";
import { sceneWith, table } from "./__fixtures__/scenes.js";
import { legacyAssets } from "./__fixtures__/legacy-plans.js";

const wall = (id: string, start: [number, number], end: [number, number], visible?: boolean) => ({
  id,
  type: "wall",
  parentId: "level_1",
  start,
  end,
  ...(visible === undefined ? {} : { visible }),
});

describe("planDrawing", () => {
  it("draws a converted legacy plan's room, walls and a round numbered table as a circle", () => {
    const scene = convertLegacyPlan(
      { name: "Ballroom", widthM: 20, heightM: 15, objects: [legacyAssets.wall, legacyAssets.roundBanquet] },
      "1.1.6",
    );
    const drawing = planDrawing(scene);

    expect(drawing.room).toEqual({ minX: 0, minY: 0, width: 20, depth: 15 });
    expect(drawing.walls).toContainEqual({ id: expect.any(String), x1: 0, y1: 0.1, x2: 4, y2: 0.1 });
    expect(drawing.pieces).toContainEqual(expect.objectContaining({ shape: "circle", name: "T12" }));
  });

  it("leaves out hidden walls and pieces, including pieces under a hidden node", () => {
    const scene = sceneWith([
      wall("wall_a", [0, 0], [10, 0]),
      wall("wall_b", [0, 0], [99, 0], false),
      table("shown", { visible: true }),
      table("hidden", { visible: false }),
    ]);
    const drawing = planDrawing(scene);

    expect(drawing.walls.map((item) => item.id)).toEqual(["wall_a"]);
    expect(drawing.pieces.map((piece) => piece.id)).toEqual(["shown"]);
  });

  it("throws for a scene without walls", () => {
    expect(() => planDrawing(sceneWith([table("t1")]))).toThrow("This floor plan has no walls");
  });
});

describe("roomSize", () => {
  it("measures the visible walls, and has no size without walls", () => {
    const scene = sceneWith([wall("w1", [0, 0], [36, 0]), wall("w2", [36, 0], [36, 24.25]), wall("w3", [0, 0], [90, 0], false)]);

    expect(roomSize(scene)).toEqual({ width: 36, depth: 24.25 });
    expect(roomSize(sceneWith([]))).toBeNull();
  });
});
