import { describe, expect, it } from "vitest";
import {
  clientFloorplanDashboardActionLabel,
  draftIsOfficial,
  selectNextAction,
} from "./client-dashboard-view-rules";
import { selectClientDashboardActions } from "./client-dashboard-selectors";
import type { PrismClientActionItem, PrismFloorPlanDraft } from "@prism/types";


describe("client dashboard action rules", () => {

  it("does not classify a reopened client preference as an official floorplan", () => {
    const preference: PrismFloorPlanDraft = {
      id: "fpd_preference",
      eventId: "evt_1",
      floorPlanId: "plan_preference",
      name: "Client Preference",
      status: "revision_requested",
      isActive: false,
      sourceType: "client_preference",
      createdByRole: "client",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    };

    expect(draftIsOfficial(preference)).toBe(false);
    expect(draftIsOfficial({ ...preference, sourceType: "blank" })).toBe(true);
  });

  it("recognizes older PMCM-approved preference-source layouts as official snapshots", () => {
    const legacyPmcmLayout: PrismFloorPlanDraft = {
      id: "fpd_legacy_pmcm",
      eventId: "evt_1",
      floorPlanId: "plan_legacy_pmcm",
      name: "Older approved PMCM layout",
      status: "approved",
      isActive: true,
      sourceType: "client_preference",
      createdByRole: "pmcm-admin",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    };
    const clientPreference = { ...legacyPmcmLayout, id: "fpd_client", createdByRole: "client" };

    expect(draftIsOfficial(legacyPmcmLayout)).toBe(true);
    expect(draftIsOfficial(clientPreference)).toBe(false);
  });

  it("labels direct event-card floorplan actions by state", () => {
    expect(clientFloorplanDashboardActionLabel("not_started")).toBe("Set layout preferences");
    expect(clientFloorplanDashboardActionLabel("in_review")).toBe("View official floorplan");
    expect(clientFloorplanDashboardActionLabel("approved")).toBe("View official floorplan");
    expect(clientFloorplanDashboardActionLabel(undefined)).toBe("Open floor plan");
  });

  it("selects overdue warning actions before routine next actions", () => {
    const next = selectNextAction([
      { id: "a", title: "Briefing", description: "", detail: "", ctaLabel: "Open", icon: {} as never, targetTab: "briefing", status: "missing", tone: "primary" },
      { id: "b", title: "Pay", description: "", detail: "", ctaLabel: "Open", icon: {} as never, targetTab: "billing", status: "pending", tone: "warning" },
    ]);
    expect(next?.id).toBe("b");
  });

  it("keeps action presentation deterministic when source order changes", () => {
    const items: PrismClientActionItem[] = [
      { id: "z", eventId: "evt_1", eventName: "Summit", kind: "briefing", priority: "attention", label: "Z", description: "", status: "missing" },
      { id: "a", eventId: "evt_1", eventName: "Summit", kind: "briefing", priority: "attention", label: "A", description: "", status: "missing" },
    ];
    const toIds = (source: typeof items) => selectClientDashboardActions({ items }, "evt_1").map((item) => item.id);
    expect(toIds(items)).toEqual(toIds([...items].reverse()));
    expect(toIds(items)).toEqual(["a", "z"]);
  });
});
