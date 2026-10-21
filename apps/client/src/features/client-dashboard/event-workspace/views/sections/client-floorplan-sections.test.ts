import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PrismFloorPlanDraft } from "@prism/types";
import { FloorPlanDraftPanel } from "./client-floorplan-sections";

function draft(status: string): PrismFloorPlanDraft {
  return {
    id: "fpd_preference",
    eventId: "evt_1",
    floorPlanId: "plan_1",
    name: "Client preference",
    status,
    isActive: false,
    sourceType: "client_preference",
    createdByRole: "client",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
  };
}

function renderPanel(status: string) {
  return renderToStaticMarkup(createElement(FloorPlanDraftPanel, {
    approved: false,
    isOfficial: false,
    activeDraft: draft(status),
    officialProject: null,
    onOpenEditor: () => undefined,
  }));
}

describe("client floorplan preference editor action", () => {
  it("shows a submitted preference as read-only until PMCM reopens it", () => {
    const markup = renderPanel("client_submitted");

    expect(markup).toContain("View submitted preference");
    expect(markup).toContain("Submitted preference is read-only until PMCM reopens it.");
    expect(markup).not.toContain("Edit preference");
  });

  it("offers editing after PMCM requests a preference revision", () => {
    const markup = renderPanel("revision_requested");

    expect(markup).toContain("Edit preference");
    expect(markup).not.toContain("View submitted preference");
  });
});
