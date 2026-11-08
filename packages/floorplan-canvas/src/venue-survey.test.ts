import { describe, expect, it } from "vitest";
import { isPermanentFeature } from "./templates";
import { venueSurveyFixtures } from "./venue-survey";

describe("FR-81 venue survey fixtures", () => {
  it("draws every measured fixture inside the room, locked, and as a permanent venue feature", () => {
    const survey = { widthM: 24, lengthM: 16, pillars: 4, emergencyExits: 3, doors: 2, stageWall: "north" as const, loadingBayWall: "east" as const };
    const objects = venueSurveyFixtures(survey);

    const count = (name: string) => objects.filter((object) => object.name === name).length;
    expect(count("Pillar")).toBe(4);
    expect(count("Emergency Exit")).toBe(3);
    expect(count("Door")).toBe(2);
    expect(objects.filter((object) => object.label === "Loading bay")).toHaveLength(1);
    expect(objects.filter((object) => object.label?.endsWith("wall"))).toHaveLength(4);
    // The first exit goes on the wall facing the stage.
    expect(objects.find((object) => object.name === "Emergency Exit")).toMatchObject({ y: survey.lengthM - 0.2 });

    for (const object of objects) {
      expect(isPermanentFeature(object) && object.locked).toBe(true);
      expect(object.x).toBeGreaterThanOrEqual(0);
      expect(object.y).toBeGreaterThanOrEqual(0);
      expect(object.x + object.w).toBeLessThanOrEqual(survey.widthM + 1e-9);
      expect(object.y + object.h).toBeLessThanOrEqual(survey.lengthM + 1e-9);
    }
  });
});
