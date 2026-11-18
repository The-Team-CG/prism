import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { convertLegacyPlan } from "@prism/floorplan-scene";
import type { FloorPlanCanvasObject } from "@prism/types";
import { PASCAL_VERSION, fromSceneDocument, toSceneDocument } from "./scene-document";

const banquet: FloorPlanCanvasObject = {
  id: "round-banquet_a",
  name: "Round Banquet (10pax)",
  kind: "ellipse",
  category: "furniture",
  x: 2,
  y: 3,
  w: 1.8,
  h: 1.8,
  rotation: 0,
  fill: "#FFF4EC",
  stroke: "#9060A0",
  strokeWidth: 0.04,
  seats: 10,
  assignedGuestIds: ["g1"],
  locked: false,
  hidden: false,
};

const converted = convertLegacyPlan({ name: "Ballroom", widthM: 20, heightM: 15, objects: [banquet] }, "1.1.6");

describe("scene document", () => {
  it("round-trips a converted plan through the shape the Pascal editor loads and saves", () => {
    const pascalScene = { ...fromSceneDocument(converted), collections: {}, materials: {}, installedPlugins: ["prism:event-layout"] };

    expect(fromSceneDocument(toSceneDocument(pascalScene, "1.1.6"))).toEqual(pascalScene);
    expect(toSceneDocument(fromSceneDocument(converted), converted.pascalVersion)).toEqual(converted);
  });

  it("stamps the stored format and the Pascal version that saved the scene", () => {
    expect(toSceneDocument(fromSceneDocument(converted), "1.1.7")).toMatchObject({ format: "pascal-v1", pascalVersion: "1.1.7" });
  });

  it("records the Pascal release that is actually installed", () => {
    const entry = createRequire(import.meta.url).resolve("@pascal-app/core");
    const manifest = JSON.parse(readFileSync(join(dirname(entry), "..", "package.json"), "utf8")) as { version: string };
    expect(PASCAL_VERSION).toBe(manifest.version);
  });
});
