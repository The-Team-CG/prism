import { describe, expect, it } from "vitest";
import {
  clientFloorplanDashboardActionLabel,
  selectNextAction,
} from "./client-dashboard-view-rules";
import { selectClientDashboardActions } from "./client-dashboard-selectors";
import type { PrismClientActionItem } from "@prism/types";


describe("client dashboard action rules", () => {

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
