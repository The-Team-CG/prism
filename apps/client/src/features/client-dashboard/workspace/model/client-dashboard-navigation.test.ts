import { describe, expect, it } from "vitest";
import {
  activeNavItemId,
  dashboardHref,
  dashboardLoadingVariant,
  sidebarActiveItemId,
} from "./client-dashboard-navigation";

describe("client-dashboard navigation", () => {
  it("builds portal and event hrefs", () => {
    expect(dashboardHref("home")).toBe("/dashboard");
    expect(dashboardHref("request")).toBe("/dashboard/request");
    expect(dashboardHref("events")).toBe("/dashboard/events");
    expect(dashboardHref("billing")).toBe("/dashboard/billing");
    expect(dashboardHref("floorplan", "evt_1")).toBe("/dashboard/events/evt_1/floor-plan");
    expect(dashboardHref("overview", "evt_1")).toBe("/dashboard/events/evt_1/overview");
    expect(dashboardHref("home", undefined, "dashboard-pending-approvals")).toBe(
      "/dashboard/approvals/pending",
    );
  });

  it("resolves active nav ids for portal and event scopes", () => {
    expect(activeNavItemId("home", false)).toBe("client-dashboard");
    expect(activeNavItemId("events", false)).toBe("my-events");
    expect(activeNavItemId("floorplan", true)).toBe("event-floorplan");
    expect(sidebarActiveItemId("floorplan", true)).toBe("my-events");
    expect(sidebarActiveItemId("approvals", false, "approvals-pending")).toBe("approvals-pending");
  });

  it("maps loading variants", () => {
    expect(dashboardLoadingVariant("home")).toBe("home");
    expect(dashboardLoadingVariant("floorplan")).toBe("floorplan");
    expect(dashboardLoadingVariant("billing")).toBe("event");
  });
});
