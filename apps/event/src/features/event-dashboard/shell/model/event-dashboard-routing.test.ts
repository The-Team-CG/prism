import { describe, expect, it } from "vitest";
import {
  dashboardRouteState,
  eventListRouteState,
  eventRouteState,
  isEventListView,
  routeStateForSidebarItem,
  routeStateFromPath,
  routeShellCopy,
} from "./event-dashboard-routing";

describe("event-dashboard-routing", () => {
  it("keeps explicit dashboard and event routes typed at the feature boundary", () => {
    expect(dashboardRouteState("upcoming-events")).toEqual({
      section: "dashboard",
      tab: "overview",
      view: "upcoming-events",
    });
    expect(eventRouteState("event/42", "planning-checklist")).toEqual({
      section: "events",
      eventId: "event/42",
      tab: "briefing",
      view: "planning-checklist",
    });
  });

  it("centralizes event-list view recognition without requiring literal route folders", () => {
    expect(isEventListView("upcoming")).toBe(true);
    expect(isEventListView("unknown")).toBe(false);
    expect(eventListRouteState("completed")).toEqual({
      section: "events-list",
      tab: "overview",
      view: "completed",
    });
    expect(eventListRouteState("unknown")).toEqual({
      section: "events-list",
      tab: "overview",
      view: "all",
    });
  });

  it("preserves sidebar and legacy URL compatibility", () => {
    expect(routeStateForSidebarItem("events-upcoming")).toEqual(eventListRouteState("upcoming"));
    expect(routeStateFromPath("/dashboard/events/upcoming")).toEqual(eventListRouteState("upcoming"));
    expect(routeStateFromPath("/dashboard/events/event-42/briefing")).toEqual(
      eventRouteState("event-42", "briefing"),
    );
  });

  it("keeps shell copy in the route model instead of branching in JSX", () => {
    expect(routeShellCopy({ section: "clients", tab: "overview", view: "active" }, { activeNavLabel: "Active clients" })).toEqual({
      eyebrow: "Clients",
      title: "Active clients",
      description: "Client intake, conforme status, approval requests, and portal readiness.",
    });
    expect(
      routeShellCopy(
        eventRouteState("event-42", "overview"),
        { selectedEvent: { eventName: "Launch", clientName: "Acme", eventDate: "2026-09-01" } },
      ),
    ).toEqual({
      eyebrow: "Event workspace",
      title: "Launch",
      description: "Acme — 2026-09-01",
    });
  });
});
