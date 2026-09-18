import { describe, expect, it } from "vitest";
import { buildFloorPlanPreferencePayload } from "./client-floorplan-preference-rules";

const form = {
  name: "Summit layout preference",
  seatingStyle: "Banquet",
  stagePreference: "North wall",
  flowNotes: "Keep registration near the entrance",
  guestCount: 180,
  constraints: "Keep exits clear\n\n  Reserve sponsor space  \n",
  notes: "   ",
};

describe("buildFloorPlanPreferencePayload", () => {
  it("validates and normalizes the client preference form", () => {
    expect(buildFloorPlanPreferencePayload(form)).toMatchObject({
      name: "Summit layout preference",
      guestCount: 180,
      constraints: ["Keep exits clear", "Reserve sponsor space"],
      notes: undefined,
    });
  });

  it("lets editor metadata override the base form payload", () => {
    expect(
      buildFloorPlanPreferencePayload(form, {
        name: "Template preference draft",
        venue: "Grand Hall",
        width: 30,
        height: 20,
        gridSize: 1,
        objects: [],
      }),
    ).toMatchObject({
      name: "Template preference draft",
      venue: "Grand Hall",
      width: 30,
      height: 20,
      gridSize: 1,
      objects: [],
    });
  });

  it("rejects an invalid guest count at the shared contract boundary", () => {
    expect(() => buildFloorPlanPreferencePayload({ ...form, guestCount: 0 })).toThrow();
  });
});
