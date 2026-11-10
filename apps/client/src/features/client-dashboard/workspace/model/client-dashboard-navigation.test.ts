import { describe, expect, it } from "vitest";
import {
  activeNavItemId,
  CLIENT_CONFORME_REVIEW_HREF,
  dashboardHref,
  dashboardLoadingVariant,
  findClientSidebarLink,
  clientPortalSidebarItems,
  clientOpenEventSidebarItems,
  openEventIdFromNavItem,
  clientEventWorkspaceAvailable,
  sidebarActiveItemId,
} from "./client-dashboard-navigation";

describe("client-dashboard navigation", () => {
  it("builds portal and event hrefs", () => {
    expect(dashboardHref("home")).toBe("/dashboard");
    expect(dashboardHref("shared-floorplans")).toBe("/dashboard/shared-floorplans");
    // Shared layouts live under each event's floor plan, not as a second top-level floorplan entry.
    expect(findClientSidebarLink("shared-floorplans")).toBeUndefined();
    expect(CLIENT_CONFORME_REVIEW_HREF).toBe("/conforme");
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
    expect(activeNavItemId("shared-floorplans", false)).toBe("my-events");
    expect(activeNavItemId("floorplan", true)).toBe("event-floorplan");
    expect(sidebarActiveItemId("floorplan", true)).toBe("my-events");
    expect(sidebarActiveItemId("approvals", false, "approvals-pending")).toBe("approvals-pending");
  });

  it("keeps event-owned sections inside the event when the client has one event", () => {
    expect(clientPortalSidebarItems(1).map((item) => item.label)).toEqual(["Home", "Events", "Calendar"]);
    expect(clientPortalSidebarItems(2).map((item) => item.id)).toContain("billing-payments");
  });

  it("lists upcoming events in the portal sidebar, soonest first, without past ones", () => {
    const event = (id: string, eventDate: string, status: string, archived = false) =>
      ({ id, eventName: `Event ${id}`, eventDate, status, archived }) as Parameters<typeof clientOpenEventSidebarItems>[0][number];
    const items = clientOpenEventSidebarItems([
      event("late", "2026-12-20", "planning"),
      event("done", "2026-10-01", "completed"),
      event("soon", "2026-11-23", "planning"),
      event("archived", "2026-11-01", "planning", true),
      event("a", "2027-01-01", "planning"),
      event("b", "2027-02-01", "planning"),
      event("c", "2027-03-01", "planning"),
    ]);
    // Capped at four: the Events page holds the full list.
    expect(items.map((item) => item.label)).toEqual(["Event soon", "Event late", "Event a", "Event b"]);
    expect(items[0]).toMatchObject({ href: "/dashboard/events/soon/overview", section: "Your events" });
    expect(openEventIdFromNavItem(items[0].id)).toBe("soon");
    expect(openEventIdFromNavItem("my-events")).toBeUndefined();
  });

  it("maps loading variants", () => {
    expect(dashboardLoadingVariant("home")).toBe("home");
    expect(dashboardLoadingVariant("floorplan")).toBe("floorplan");
    expect(dashboardLoadingVariant("billing")).toBe("event");
  });

  it("does not expose event workspace navigation for archived events", () => {
    expect(clientEventWorkspaceAvailable({ archived: true })).toBe(false);
    expect(clientEventWorkspaceAvailable({ archived: false })).toBe(true);
    expect(clientEventWorkspaceAvailable(undefined)).toBe(false);
  });
});
