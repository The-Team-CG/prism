import { describe, expect, it } from "vitest";
import type { PrismFloorPlanDraft } from "@prism/types";
import type { Project } from "@/features/floorplan/editor";
import {
  buildReopenedFloorPlanPreferencePayload,
  buildFloorPlanPreferencePayload,
  canEditClientFloorPlanPreference,
  preferenceFormFromDraft,
} from "./client-floorplan-preference-rules";

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

describe("client floorplan preference lifecycle", () => {
  const preferenceDraft: PrismFloorPlanDraft = {
    id: "fpd_preference",
    eventId: "evt_1",
    floorPlanId: "plan_1",
    name: "Summit seating preference",
    status: "revision_requested",
    isActive: false,
    sourceType: "client_preference",
    createdByRole: "client",
    clientPreference: {
      seatingStyle: "Banquet",
      stagePreference: "North wall",
      flowNotes: "Keep registration near the entrance",
      guestCount: 180,
      constraints: ["Keep exits clear", "Reserve sponsor space"],
      notes: "Keep a clear photo wall access.",
    },
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
  };

  it("allows a first preference and a resubmission only after PMCM requests a revision", () => {
    expect(canEditClientFloorPlanPreference(undefined)).toBe(true);
    expect(canEditClientFloorPlanPreference(preferenceDraft)).toBe(true);
    expect(canEditClientFloorPlanPreference({ ...preferenceDraft, status: "client_submitted" })).toBe(false);
    expect(canEditClientFloorPlanPreference({ ...preferenceDraft, status: "approved" })).toBe(false);
  });

  it("prefills the reopened form from the same persisted preference", () => {
    expect(preferenceFormFromDraft(preferenceDraft)).toEqual({
      name: "Summit seating preference",
      seatingStyle: "Banquet",
      stagePreference: "North wall",
      flowNotes: "Keep registration near the entrance",
      guestCount: 180,
      constraints: "Keep exits clear\nReserve sponsor space",
      notes: "Keep a clear photo wall access.",
    });
  });

  it("builds a resubmission from the reopened preference and edited canvas", () => {
    const project: Project = {
      id: "plan_preference",
      name: "Revised Summit layout",
      venue: "Grand Hall",
      widthM: 35.4,
      heightM: 22.4,
      pax: 200,
      objects: [{
        id: "stage", name: "Main stage", kind: "rect", category: "stage", x: 4, y: 5, w: 6, h: 2,
        rotation: 0, fill: "#fff", stroke: "#000", strokeWidth: 1, locked: false, hidden: false,
      }],
      guests: [],
      suppliers: [],
      createdAt: 0,
      updatedAt: 0,
    };

    expect(buildReopenedFloorPlanPreferencePayload(preferenceDraft, project)).toEqual({
      name: "Revised Summit layout",
      seatingStyle: "Banquet",
      stagePreference: "North wall",
      flowNotes: "Keep registration near the entrance",
      guestCount: 200,
      constraints: ["Keep exits clear", "Reserve sponsor space"],
      notes: "Keep a clear photo wall access.",
      venue: "Grand Hall",
      width: 35,
      height: 22,
      gridSize: 1,
      objects: project.objects,
    });
  });
});
