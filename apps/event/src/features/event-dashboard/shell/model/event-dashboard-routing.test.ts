import { portalHref } from "@prism/ui/portal-path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RouteState } from "./event-dashboard-routing";
import {
  activeSidebarItemFromRoute,
  dashboardRouteState,
  eventListRouteState,
  eventRouteState,
  isEventListView,
  routeStateForSidebarItem,
  routeStateFromPath,
  routeLoadingShellCopy,
  routeShellCopy,
} from "./event-dashboard-routing";

afterEach(() => vi.unstubAllEnvs());

describe("event-dashboard-routing", () => {
  it("keeps native navigation inside its hosting prefix without changing external links", () => {
    vi.stubEnv("NEXT_PUBLIC_PORTAL_BASE_PATH", "/event");
    expect(["/", "/sign-in?next=%2Fdashboard", "/event/dashboard", "https://supplier.example.test/", "//cdn.example.test/logo.png", "#section"].map(portalHref)).toEqual([
      "/event/", "/event/sign-in?next=%2Fdashboard", "/event/dashboard", "https://supplier.example.test/", "//cdn.example.test/logo.png", "#section",
    ]);
    vi.stubEnv("NEXT_PUBLIC_PORTAL_BASE_PATH", "");
    expect(portalHref("/dashboard")).toBe("/dashboard");
  });
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

  it("routes the event games workspace to its own tab and event-scoped URL", () => {
    expect(eventRouteState("event-42", "games")).toEqual({
      section: "events",
      eventId: "event-42",
      tab: "games",
      view: "games",
    });
    expect(routeStateFromPath("/dashboard/events/event-42/games")).toEqual(
      eventRouteState("event-42", "games"),
    );
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

  it("resolves every sidebar route family and safe fallback", () => {
    expect(routeStateForSidebarItem("settings-system-logs")).toEqual({
      section: "audit",
      tab: "overview",
      view: "system-logs",
    });
    expect(routeStateForSidebarItem("dashboard-upcoming")).toEqual(dashboardRouteState("upcoming-events"));
    expect(routeStateForSidebarItem("clients-active")).toEqual({
      section: "clients",
      tab: "overview",
      view: "active",
    });
    expect(routeStateForSidebarItem("messages-client")).toEqual({
      section: "messages",
      tab: "activity",
      view: "client",
    });
    expect(routeStateForSidebarItem("finance-invoices")).toEqual({
      section: "finance",
      tab: "billing",
      view: "invoices",
    });
    expect(routeStateForSidebarItem("calendar-events")).toEqual({
      section: "calendar",
      tab: "overview",
      view: "events",
    });

    const staticRoutes: Array<[string, RouteState]> = [
      ["dashboard", { section: "dashboard", tab: "overview", view: "overview" }],
      ["inquiries", { section: "inquiries", tab: "overview", view: "prospects" }],
      ["clients", { section: "clients", tab: "overview", view: "all" }],
      ["events-list", { section: "events-list", tab: "overview", view: "all" }],
      ["calendar", { section: "calendar", tab: "overview", view: "all" }],
      ["tasks", { section: "tasks", tab: "overview", view: "mine" }],
      ["command-inbox", { section: "command-inbox", tab: "overview", view: "all" }],
      ["team", { section: "team", tab: "coordinators", view: "all" }],
      ["suppliers", { section: "suppliers", tab: "overview", view: "all" }],
      ["files", { section: "files", tab: "floorplans", view: "all" }],
      ["messages", { section: "messages", tab: "activity", view: "inbox" }],
      ["finance", { section: "finance", tab: "billing", view: "overview" }],
      ["audit", { section: "audit", tab: "overview", view: "system-logs" }],
      ["settings", { section: "settings", tab: "overview", view: "organization-profile" }],
    ];

    for (const [id, expected] of staticRoutes) {
      expect(routeStateForSidebarItem(id)).toEqual(expected);
    }
    expect(routeStateForSidebarItem("not-a-sidebar-item")).toBeUndefined();
  });

  it("maps route states back to their owning sidebar item", () => {
    const cases: Array<[RouteState, string]> = [
      [{ section: "dashboard", tab: "overview" }, "dashboard"],
      [{ section: "suppliers", tab: "overview" }, "suppliers"],
      [{ section: "audit", tab: "overview" }, "audit"],
      [{ section: "clients", tab: "overview" }, "clients"],
      [{ section: "calendar", tab: "overview" }, "calendar"],
      [{ section: "tasks", tab: "overview" }, "tasks"],
      [{ section: "command-inbox", tab: "overview" }, "command-inbox"],
      [{ section: "team", tab: "coordinators" }, "dashboard"],
      [{ section: "team", tab: "coordinators", eventId: "event-42" }, "event-staff"],
      [{ section: "files", tab: "floorplans" }, "dashboard"],
      [{ section: "files", tab: "floorplans", eventId: "event-42" }, "event-files"],
      [{ section: "events", tab: "files", eventId: "event-42", view: "files" }, "event-files"],
      [{ section: "events", tab: "floorplans", eventId: "event-42", view: "floorplans" }, "event-floorplans"],
      [{ section: "messages", tab: "activity" }, "dashboard"],
      [{ section: "messages", tab: "activity", eventId: "event-42" }, "event-messages"],
      [{ section: "finance", tab: "billing" }, "dashboard"],
      [{ section: "finance", tab: "billing", eventId: "event-42" }, "event-budget"],
      [{ section: "settings", tab: "overview" }, "settings"],
      [{ section: "inquiries", tab: "overview" }, "inquiries"],
      [{ section: "events-list", tab: "overview" }, "events-list"],
      [{ section: "events", tab: "overview" }, "dashboard"],
      [{ section: "events", tab: "briefing", eventId: "event-42", view: "planning-checklist" }, "event-planning"],
      [{ section: "events", tab: "live-ops", eventId: "event-42", view: "not-a-route" }, "event-timeline"],
    ];

    for (const [routeState, expected] of cases) {
      expect(activeSidebarItemFromRoute(routeState)).toBe(expected);
    }
  });

  it("keeps loading copy aligned with each route owner", () => {
    const cases: Array<[RouteState, { eyebrow: string; title: string }]> = [
      [{ section: "suppliers", tab: "overview" }, { eyebrow: "Supplier directory", title: "Supplier Directory" }],
      [{ section: "audit", tab: "overview" }, { eyebrow: "Audit log", title: "Audit Trail" }],
      [{ section: "clients", tab: "overview" }, { eyebrow: "Clients", title: "Client Desk" }],
      [{ section: "calendar", tab: "overview" }, { eyebrow: "Calendar", title: "Calendar" }],
      [{ section: "tasks", tab: "overview" }, { eyebrow: "Tasks", title: "Tasks" }],
      [{ section: "command-inbox", tab: "overview" }, { eyebrow: "Command inbox", title: "Command Inbox" }],
      [{ section: "team", tab: "overview" }, { eyebrow: "Team", title: "Team & Coordinators" }],
      [{ section: "files", tab: "overview" }, { eyebrow: "Files", title: "Event File Hub" }],
      [{ section: "messages", tab: "overview" }, { eyebrow: "Messages", title: "Event Messages" }],
      [{ section: "finance", tab: "overview" }, { eyebrow: "Finance", title: "Finance Desk" }],
      [{ section: "inquiries", tab: "overview" }, { eyebrow: "Inquiries", title: "Inquiry Intake" }],
      [{ section: "events-list", tab: "overview" }, { eyebrow: "Events", title: "All Events" }],
      [{ section: "settings", tab: "overview" }, { eyebrow: "Settings", title: "Settings" }],
      [{ section: "events", tab: "overview", eventId: "event-42" }, { eyebrow: "Event workspace", title: "Event workspace" }],
      [{ section: "dashboard", tab: "overview" }, { eyebrow: "Command home", title: "Event Manager" }],
    ];

    for (const [routeState, expected] of cases) {
      expect(routeLoadingShellCopy(routeState)).toEqual(expected);
    }
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
    expect(routeShellCopy({ section: "events", tab: "overview" })).toEqual({
      eyebrow: "Command home",
      title: "Event Manager",
      description: "Select an event or accept an inquiry to begin.",
    });
    expect(routeShellCopy({ section: "events", tab: "overview", eventId: "event-42" })).toEqual({
      eyebrow: "Event workspace",
      title: "Event Manager",
      description: "Select an event or accept an inquiry to begin.",
    });

    const sectionTitles: Array<[RouteState, string]> = [
      [{ section: "suppliers", tab: "overview" }, "Supplier Directory"],
      [{ section: "audit", tab: "overview" }, "Audit Trail"],
      [{ section: "command-inbox", tab: "overview" }, "Command Inbox"],
      [{ section: "team", tab: "overview" }, "Team & Coordinators"],
      [{ section: "inquiries", tab: "overview" }, "Inquiry Intake"],
      [{ section: "calendar", tab: "overview" }, "Calendar"],
    ];
    for (const [routeState, expectedTitle] of sectionTitles) {
      expect(routeShellCopy(routeState).title).toBe(expectedTitle);
    }
  });

  it("parses every compatibility path family without owning route decisions in pages", () => {
    const cases: Array<[string, RouteState]> = [
      ["/sign-in", { section: "dashboard", tab: "overview", view: "overview" }],
      ["/dashboard", { section: "dashboard", tab: "overview", view: "overview" }],
      ["/dashboard/upcoming-events", { section: "dashboard", tab: "overview", view: "upcoming-events" }],
      ["/dashboard/inquiries", { section: "inquiries", tab: "overview", view: "prospects" }],
      ["/dashboard/clients", { section: "clients", tab: "overview", view: "all" }],
      ["/dashboard/clients/active", { section: "clients", tab: "overview", view: "active" }],
      [
        "/dashboard/clients/client%2F42/contacts",
        { section: "clients", tab: "overview", clientId: "client/42", view: "contacts" },
      ],
      ["/dashboard/events", { section: "events-list", tab: "overview", view: "all" }],
      ["/dashboard/events/upcoming", eventListRouteState("upcoming")],
      [
        "/dashboard/events/event%2F42/briefing",
        { section: "events", eventId: "event/42", tab: "briefing", view: "briefing" },
      ],
      ["/dashboard/events/event-42", eventRouteState("event-42")],
      ["/dashboard/events/event-42/files", { section: "events", eventId: "event-42", tab: "files", view: "files" }],
      ["/dashboard/events/event-42/floorplans", { section: "events", eventId: "event-42", tab: "floorplans", view: "floorplans" }],
      [
        "/dashboard/events/event-42/not-a-tab",
        { section: "events", eventId: "event-42", tab: "overview", view: "not-a-tab" },
      ],
      ["/dashboard/calendar", { section: "calendar", tab: "overview", view: "all" }],
      ["/dashboard/calendar/events", { section: "calendar", tab: "overview", view: "events" }],
      ["/dashboard/tasks", { section: "tasks", tab: "overview", view: "mine" }],
      ["/dashboard/tasks/overdue", { section: "tasks", tab: "overview", view: "overdue" }],
      ["/dashboard/command-inbox", { section: "command-inbox", tab: "overview", view: "all" }],
      ["/dashboard/team", { section: "team", tab: "coordinators", view: "all" }],
      ["/dashboard/team/availability", { section: "team", tab: "coordinators", view: "availability" }],
      ["/dashboard/suppliers", { section: "suppliers", tab: "overview", view: "all" }],
      ["/dashboard/suppliers/preferred", { section: "suppliers", tab: "overview", view: "preferred" }],
      ["/dashboard/files", { section: "files", tab: "floorplans", view: "all" }],
      ["/dashboard/files/event", { section: "files", tab: "floorplans", view: "event" }],
      ["/dashboard/messages", { section: "messages", tab: "activity", view: "inbox" }],
      ["/dashboard/messages/event", { section: "messages", tab: "activity", view: "event" }],
      ["/dashboard/finance", { section: "finance", tab: "billing", view: "overview" }],
      ["/dashboard/finance/payments", { section: "finance", tab: "billing", view: "payments" }],
      ["/dashboard/audit", { section: "audit", tab: "overview", view: "system-logs" }],
      ["/dashboard/settings/system-logs", { section: "audit", tab: "overview", view: "system-logs" }],
      ["/dashboard/settings", { section: "settings", tab: "overview", view: "organization-profile" }],
      ["/dashboard/settings/roles", { section: "settings", tab: "overview", view: "roles" }],
      ["/dashboard/not-a-route", { section: "dashboard", tab: "overview", view: "overview" }],
    ];

    for (const [pathname, expected] of cases) {
      expect(routeStateFromPath(pathname)).toEqual(expected);
    }
  });
});
