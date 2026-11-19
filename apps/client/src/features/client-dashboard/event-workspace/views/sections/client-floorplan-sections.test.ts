import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { convertLegacyPlan, PASCAL_VERSION } from "@prism/floorplan-scene";
import type { PrismFloorPlanDraft } from "@prism/types";
import { LayoutIdeasSection, OfficialLayoutSection } from "./client-floorplan-sections";

function draft(status: string, overrides: Partial<PrismFloorPlanDraft> = {}): PrismFloorPlanDraft {
  return {
    id: "fpd_preference",
    eventId: "evt_1",
    floorPlanId: "plan_1",
    name: "Our layout ideas",
    status,
    isActive: false,
    sourceType: "client_preference",
    createdByRole: "client",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
    ...overrides,
  };
}

const ideas = (status: string, approved = false) => renderToStaticMarkup(createElement(LayoutIdeasSection, {
  drafts: [draft(status)], approved, onOpenEditor: () => undefined,
}));

const official = draft("approved", { sourceType: "pmcm_official", name: "Official layout v1", approvedAt: "2026-11-19T08:00:00.000Z" });
const scene = convertLegacyPlan({
  name: "Official layout v1", widthM: 40, heightM: 25,
  objects: [{ id: "t1", kind: "ellipse", name: "Round Banquet (10pax)", category: "furniture", x: 4, y: 4, w: 1.8, h: 1.8, rotation: 0, fill: "#FFF4EC", stroke: "#9060A0", strokeWidth: 0.04, seats: 10, locked: false, hidden: false }],
}, PASCAL_VERSION);

describe("client floor plan page", () => {
  it("keeps sent layout ideas read-only until PMCM reopens them, and never after the layout is approved", () => {
    expect(ideas("client_submitted")).toContain(">View<");
    expect(ideas("client_submitted")).not.toContain("Edit layout");
    expect(ideas("revision_requested")).toContain("Edit layout");
    expect(ideas("revision_requested", true)).not.toContain("Edit layout");
  });

  it("draws the approved official layout from its scene, with round tables and the room in metres", () => {
    const markup = renderToStaticMarkup(createElement(OfficialLayoutSection, {
      draft: official, layout: { id: "plan_1", name: "Official layout v1", venue: "Garden Pavilion", scene }, reviewing: false, onOpenEditor: () => undefined,
    }));
    expect(markup).toContain("<ellipse");
    expect(markup).toContain("Preview of Official layout v1 · 40 × 25 m");
    expect(markup).toContain("Approved Nov 19, 2026");
    expect(markup).toContain("Open layout");
    expect(markup).not.toContain("will appear here");
  });

  it("leaves the plan to the review panel while the client reviews a version", () => {
    const markup = renderToStaticMarkup(createElement(OfficialLayoutSection, {
      draft: { ...official, status: "in_review" }, layout: null, reviewing: true, onOpenEditor: () => undefined,
    }));
    expect(markup).not.toContain("Open layout");
    expect(markup).not.toContain("<svg");
  });
});
