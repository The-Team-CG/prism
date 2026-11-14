import { describe, expect, it } from "vitest";
import {
  clientBreadcrumbTrail,
  clientLoadingShellCopy,
  clientShellDescription,
  clientShellEyebrow,
  clientShellTitle,
  isEventScopedClientRoute,
} from "./client-dashboard-shell-copy";

describe("client dashboard shell copy", () => {
  it("keeps event-scoped routes on the selected event", () => {
    expect(isEventScopedClientRoute("overview", "evt_1")).toBe(true);
    expect(isEventScopedClientRoute("home")).toBe(false);
    expect(clientShellEyebrow({ isEventScopedView: true, route: "overview" })).toBe("Event workspace");
  });

  it("titles each event tab with its section and keeps the event name in the description", () => {
    const selectedEvent = { eventName: "Gala Night", eventDate: "2026-12-12" };
    expect(clientShellTitle({ isEventScopedView: true, route: "billing" })).toBe("Billing");
    expect(clientShellTitle({ isEventScopedView: true, route: "preferences" })).toBe("Preferences");
    expect(clientShellTitle({ isEventScopedView: true, route: "details" })).toBe("Details");
    expect(clientShellDescription({ isEventScopedView: true, route: "billing", selectedEvent })).toContain("Gala Night");
    expect(clientShellDescription({ isEventScopedView: true, route: "messages" })).not.toContain("PMCM updates");
  });

  it("uses portal view meta before generic route titles", () => {
    expect(clientShellTitle({ isEventScopedView: false, portalView: "approvals-pending", route: "approvals" })).toBe(
      "Pending approval",
    );
    expect(clientShellTitle({ isEventScopedView: false, route: "billing" })).toBe("Billing & Payments");
    expect(clientShellDescription({ isEventScopedView: false, route: "calendar" })).toContain("Event dates");
  });

  it("ends every breadcrumb trail on the current page", () => {
    expect(clientBreadcrumbTrail({ isEventScopedView: true, route: "preferences" })).toEqual(["My events", "Preferences"]);
    expect(clientBreadcrumbTrail({ isEventScopedView: false, portalView: "events-cancelled", route: "events" })).toEqual([
      "Events",
      "Cancelled events",
    ]);
    expect(clientBreadcrumbTrail({ isEventScopedView: false, portalView: "calendar-meetings", route: "calendar" })).toEqual([
      "Calendar",
      "Site visits",
    ]);
    expect(clientBreadcrumbTrail({ isEventScopedView: false, portalView: "dashboard-overview", route: "home" })).toEqual(["Home"]);
    expect(clientBreadcrumbTrail({ isEventScopedView: false, route: "request" })).toEqual(["New event request"]);
    expect(clientBreadcrumbTrail({ isEventScopedView: false, route: "billing", portalView: "billing-overview" })).toEqual(["Billing & Payments"]);
  });

  it("falls back to loading copy when workspace state is not ready", () => {
    expect(clientLoadingShellCopy({ route: "events" })).toEqual({
      title: "My events",
      eyebrow: "Event portfolio",
      description: "Loading events…",
    });
  });
});
