import { describe, expect, it } from "vitest";
import type { FloorplanSceneDocument } from "@prism/types";
import { venueSurveyScene, type VenueSurvey } from "./venue-survey-scene.js";
import { validateFloorplanScene } from "./validate-scene.js";

const survey: VenueSurvey = { widthM: 20, lengthM: 15, pillars: 4, emergencyExits: 2, doors: 1, stageWall: "north", loadingBayWall: "east" };

function nodesOf(scene: FloorplanSceneDocument) {
  return Object.values(scene.nodes) as Array<Record<string, unknown> & { type: string }>;
}

describe("venueSurveyScene", () => {
  it("builds a valid scene of the measured room with its fixed features locked", () => {
    const scene = venueSurveyScene(survey, "Atrium");
    expect(validateFloorplanScene(scene).ok).toBe(true);

    const walls = nodesOf(scene).filter((node) => node.type === "wall");
    expect(walls.map((wall) => wall.start)).toEqual(expect.arrayContaining([[0, 0], [20, 0]]));

    const pieces = nodesOf(scene).filter((node) => node.type === "prism-fixture");
    expect(pieces.every((piece) => piece.locked === true)).toBe(true);
    expect(pieces.map((piece) => piece.variant).sort()).toEqual(["door", "emergency-exit", "emergency-exit", "loading-bay", "stage-side"]);
  });

  it("places one column per pillar and nothing for zero pillars", () => {
    expect(nodesOf(venueSurveyScene(survey, "Atrium")).filter((node) => node.type === "column")).toHaveLength(4);
    expect(nodesOf(venueSurveyScene({ ...survey, pillars: 0, loadingBayWall: null }, "Atrium")).filter((node) => node.type === "column")).toHaveLength(0);
  });
});
