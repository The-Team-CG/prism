import { portalHref } from "@prism/ui/portal-path";
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../../../../next.config";
import type { RouteState } from "./event-dashboard-routing";
import {
  EVENT_TAB_ROUTES,
  clientDossierHref,
  eventSidebarItemHref,
  activeSidebarItemFromRoute,
  dashboardRouteState,
  eventListRouteState,
  eventRouteState,
  eventWorkspaceHref,
  isEventListView,
  routeStateForSidebarItem,
  routeLoadingShellCopy,
  sectionNeedsPmcmReference,
  routeShellCopy,
} from "./event-dashboard-routing";

afterEach(() => vi.unstubAllEnvs());

type RedirectRule = { source: string; destination: string; permanent: boolean };

async function loadRedirects(): Promise<RedirectRule[]> {
  return ((await nextConfig.redirects?.()) ?? []) as RedirectRule[];
}

/** Resolves a path against the redirect rules the way Next does: the first matching rule wins. */
function redirectTarget(pathname: string, rules: RedirectRule[]): string | undefined {
  for (const rule of rules) {
    const names: string[] = [];
    const pattern = rule.source.replace(/:(\w+)(?:\(([^)]+)\))?/g, (_match, name: string, alternatives?: string) => {
      names.push(name);
      return `(${alternatives ?? "[^/]+"})`;
    });
    const match = new RegExp(`^${pattern}$`).exec(pathname);
    if (!match) continue;
    return rule.destination.replace(/:(\w+)/g, (_match, name: string) => match[names.indexOf(name) + 1] ?? "");
  }
  return undefined;
}

describe("event-dashboard-routing", () => {
  it("gives sidebar destinations real link targets, and none to event sections without an event", () => {
    expect(eventSidebarItemHref("inquiries")).toBe("/dashboard/inquiries");
    expect(eventSidebarItemHref("event-overview", "evt 1")).toBe("/dashboard/events/evt%201/overview");
    expect(eventSidebarItemHref("event-overview")).toBeUndefined();
    expect(eventSidebarItemHref("unknown", "evt")).toBeUndefined();
  });

  it("keeps native navigation inside its hosting prefix without changing external links", () => {
    vi.stubEnv("NEXT_PUBLIC_PORTAL_BASE_PATH", "/event");
    expect(["/", "/sign-in?next=%2Fdashboard", "/event/dashboard", "https://supplier.example.test/", "//cdn.example.test/logo.png", "#section"].map(portalHref)).toEqual([
      "/event/", "/event/sign-in?next=%2Fdashboard", "/event/dashboard", "https://supplier.example.test/", "//cdn.example.test/logo.png", "#section",
    ]);
    vi.stubEnv("NEXT_PUBLIC_PORTAL_BASE_PATH", "");
    expect(portalHref("/dashboard")).toBe("/dashboard");
  });

  it("keeps explicit dashboard and event routes typed at the feature boundary", () => {
    expect(dashboardRouteState()).toEqual({ section: "dashboard", tab: "overview", view: "overview" });
    expect(eventRouteState("event/42", "briefing")).toEqual({
      section: "events",
      eventId: "event/42",
      tab: "briefing",
      view: "briefing",
    });
  });

  it("gives the Games tab the registration route's games part, so it has one canonical URL", () => {
    expect(eventWorkspaceHref("event-42", "games")).toBe("/dashboard/events/event-42/registration?part=games");
    expect(eventWorkspaceHref("event-42", "registration")).toBe("/dashboard/events/event-42/registration");
    expect(eventSidebarItemHref("event-games", "event-42")).toBe("/dashboard/events/event-42/registration");
    expect(eventRouteState("event-42", "registration")).toEqual({
      section: "events",
      eventId: "event-42",
      tab: "registration",
      view: "registration",
    });
  });

  it("routes the decision log under its one canonical segment", () => {
    expect(eventWorkspaceHref("event-42", "decisions")).toBe("/dashboard/events/event-42/decision-log");
    expect(eventRouteState("event-42", "decision-log")).toEqual({
      section: "events",
      eventId: "event-42",
      tab: "decisions",
      view: "decision-log",
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

  it("builds one URL per client dossier view", () => {
    expect(clientDossierHref("acme")).toBe("/dashboard/clients/acme");
    expect(clientDossierHref("acme", "overview")).toBe("/dashboard/clients/acme");
    expect(clientDossierHref("acme", "invoices")).toBe("/dashboard/clients/acme/invoices");
  });

  it("resolves the sidebar entries that remain, and no retired sub-view entries", () => {
    expect(routeStateForSidebarItem("events-upcoming")).toEqual(eventListRouteState("upcoming"));
    expect(routeStateForSidebarItem("team-availability")).toEqual({ section: "team", tab: "overview", view: "availability" });
    expect(routeStateForSidebarItem("suppliers-preferred")).toEqual({ section: "suppliers", tab: "overview", view: "preferred" });
    expect(routeStateForSidebarItem("clients")).toEqual({ section: "clients", tab: "overview", view: "all" });
    expect(routeStateForSidebarItem("finance")).toEqual({ section: "finance", tab: "billing", view: "overview" });

    for (const retired of ["calendar-events", "clients-active", "tasks-overdue", "messages-client", "finance-invoices", "settings-system-logs", "dashboard-upcoming"]) {
      expect(routeStateForSidebarItem(retired)).toBeUndefined();
    }
    expect(routeStateForSidebarItem("not-a-sidebar-item")).toBeUndefined();
  });

  it("maps route states back to their owning sidebar item, and to none for sections without one", () => {
    const cases: Array<[RouteState, string | undefined]> = [
      [{ section: "dashboard", tab: "overview" }, "dashboard"],
      [{ section: "suppliers", tab: "overview" }, "suppliers"],
      [{ section: "audit", tab: "overview" }, "audit"],
      [{ section: "clients", tab: "overview" }, "clients"],
      [{ section: "clients", tab: "overview", clientId: "acme", view: "invoices" }, "clients"],
      [{ section: "calendar", tab: "overview" }, "calendar"],
      [{ section: "team", tab: "coordinators" }, "team"],
      [{ section: "team", tab: "coordinators", eventId: "event-42" }, "event-staff"],
      [{ section: "settings", tab: "overview" }, "settings"],
      [{ section: "inquiries", tab: "overview" }, "inquiries"],
      [{ section: "events-list", tab: "overview" }, "events-list"],
      // Tasks, Files, Messages and Finance have no sidebar entry outside an event, so nothing is highlighted.
      [{ section: "tasks", tab: "overview" }, undefined],
      [{ section: "files", tab: "floorplans" }, undefined],
      [{ section: "messages", tab: "activity" }, undefined],
      [{ section: "finance", tab: "billing" }, undefined],
      [{ section: "files", tab: "floorplans", eventId: "event-42" }, "event-files"],
      [{ section: "messages", tab: "activity", eventId: "event-42" }, "event-messages"],
      [{ section: "finance", tab: "billing", eventId: "event-42" }, "event-budget"],
      // Event workspace pages highlight the nav item of their canonical tab.
      [{ section: "events", tab: "overview", eventId: "event-42", view: "overview" }, "event-overview"],
      [{ section: "events", tab: "briefing", eventId: "event-42", view: "briefing" }, "event-planning"],
      [{ section: "events", tab: "decisions", eventId: "event-42", view: "decision-log" }, "event-planning"],
      [{ section: "events", tab: "registration", eventId: "event-42", view: "registration" }, "event-games"],
      [{ section: "events", tab: "live-ops", eventId: "event-42", view: "run-sheet" }, "event-timeline"],
      [{ section: "events", tab: "live-ops", eventId: "event-42", view: "not-a-route" }, "event-timeline"],
    ];

    for (const [routeState, expected] of cases) {
      expect(activeSidebarItemFromRoute(routeState)).toBe(expected);
    }
  });

  it("keeps loading copy aligned with each route owner", () => {
    const cases: Array<[RouteState, { eyebrow: string; title: string }]> = [
      [{ section: "suppliers", tab: "overview" }, { eyebrow: "Supplier directory", title: "Suppliers" }],
      [{ section: "audit", tab: "overview" }, { eyebrow: "Audit log", title: "Audit" }],
      [{ section: "clients", tab: "overview" }, { eyebrow: "Clients", title: "Clients" }],
      [{ section: "calendar", tab: "overview" }, { eyebrow: "Calendar", title: "Calendar" }],
      [{ section: "tasks", tab: "overview" }, { eyebrow: "Tasks", title: "Tasks" }],
      [{ section: "team", tab: "overview" }, { eyebrow: "Team", title: "Team" }],
      [{ section: "files", tab: "overview" }, { eyebrow: "Files", title: "Event File Hub" }],
      [{ section: "messages", tab: "overview" }, { eyebrow: "Messages", title: "Event Messages" }],
      [{ section: "finance", tab: "overview" }, { eyebrow: "Finance", title: "Finance Desk" }],
      [{ section: "inquiries", tab: "overview" }, { eyebrow: "Inquiries", title: "Inquiries" }],
      [{ section: "events-list", tab: "overview" }, { eyebrow: "Events", title: "Events" }],
      [{ section: "settings", tab: "overview" }, { eyebrow: "Settings", title: "Settings" }],
      [{ section: "events", tab: "overview", eventId: "event-42" }, { eyebrow: "Event workspace", title: "Event workspace" }],
      [{ section: "dashboard", tab: "overview" }, { eyebrow: "Command home", title: "Event Manager" }],
    ];

    for (const [routeState, expected] of cases) {
      expect(routeLoadingShellCopy(routeState)).toEqual(expected);
    }
  });

  it("names the event and section in the breadcrumb, so an event page says where you are", () => {
    const event = { eventName: "Launch", clientName: "Acme", eventDate: "2026-09-01" };
    expect(routeShellCopy(eventRouteState("event-42", "briefing"), { activeNavLabel: "Planning & decisions", selectedEvent: event })).toEqual({
      eyebrow: "Event workspace",
      title: "Launch",
      description: "Planning & decisions · Acme · Sep 1, 2026",
      breadcrumb: ["Events", "Launch", "Planning & decisions"],
      documentTitle: "Planning & decisions · Launch · P.R.I.S.M",
    });
    expect(routeShellCopy(eventRouteState("event-42", "overview"), { selectedEvent: event }).description).toBe("Acme · Sep 1, 2026");
    expect(routeShellCopy({ section: "events", tab: "overview" })).toEqual({
      eyebrow: "Command home",
      title: "Event Manager",
      description: "Select an event or accept an inquiry to begin.",
      breadcrumb: ["Event Manager"],
      documentTitle: "Event Manager · P.R.I.S.M",
    });
    expect(routeShellCopy({ section: "events", tab: "overview", eventId: "event-42" })).toEqual({
      eyebrow: "Event workspace",
      title: "Event Manager",
      description: "Select an event or accept an inquiry to begin.",
      breadcrumb: ["Events"],
      documentTitle: "P.R.I.S.M",
    });
  });

  it("titles a client dossier with the client, and its breadcrumb runs Clients › client", () => {
    expect(
      routeShellCopy(
        { section: "clients", tab: "overview", clientId: "acme", view: "invoices" },
        { activeNavLabel: "Clients", selectedClient: { name: "Acme Corp" } },
      ),
    ).toEqual({
      eyebrow: "Clients",
      title: "Acme Corp",
      description: "Every client contact, with their events and inquiries.",
      breadcrumb: ["Clients", "Acme Corp"],
      documentTitle: "Clients · Acme Corp · P.R.I.S.M",
    });
    expect(routeShellCopy({ section: "clients", tab: "overview", view: "all" }, { activeNavLabel: "Clients" }).breadcrumb).toEqual(["Clients"]);
  });

  it("names every global section in its own breadcrumb and document title, never the Inbox", () => {
    const sectionTitles: Array<[RouteState, string]> = [
      [{ section: "suppliers", tab: "overview" }, "Suppliers"],
      [{ section: "audit", tab: "overview" }, "Audit"],
      [{ section: "dashboard", tab: "overview" }, "Inbox"],
      [{ section: "team", tab: "overview" }, "Team"],
      [{ section: "inquiries", tab: "overview" }, "Inquiries"],
      [{ section: "calendar", tab: "overview" }, "Calendar"],
      [{ section: "tasks", tab: "overview" }, "Tasks"],
      [{ section: "files", tab: "floorplans", view: "all" }, "Files"],
      [{ section: "messages", tab: "activity", view: "inbox" }, "Messages"],
      [{ section: "finance", tab: "billing", view: "overview" }, "Finance"],
    ];
    for (const [routeState, expectedTitle] of sectionTitles) {
      // The Inbox is the active nav item here only as a fallback; the page still names its own section.
      const copy = routeShellCopy(routeState, { activeNavLabel: "Inbox" });
      expect(copy.title).toBe(expectedTitle);
      expect(copy.breadcrumb).toEqual([expectedTitle]);
      expect(copy.documentTitle).toBe(`${expectedTitle} · P.R.I.S.M`);
    }
  });

  it("sends retired dashboard sub-views and aliases to the section that owns them", async () => {
    const rules = await loadRedirects();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((rule) => rule.permanent)).toBe(true);

    const cases: Array<[string, string]> = [
      ["/dashboard/command-inbox", "/dashboard"],
      ["/dashboard/upcoming-events", "/dashboard"],
      ["/dashboard/financial-summary", "/dashboard"],
      ["/dashboard/clients/active", "/dashboard/clients"],
      ["/dashboard/calendar/task-deadlines", "/dashboard/calendar"],
      ["/dashboard/tasks/overdue", "/dashboard/tasks"],
      ["/dashboard/messages/approvals", "/dashboard/messages"],
      ["/dashboard/files/event", "/dashboard/files"],
      ["/dashboard/finance/payments", "/dashboard/finance"],
      ["/dashboard/settings/roles", "/dashboard/settings"],
      ["/dashboard/settings/system-logs", "/dashboard/audit"],
    ];
    for (const [from, to] of cases) {
      expect(redirectTarget(from, rules), from).toBe(to);
    }
  });

  it("moves event workspace alias URLs onto the one canonical tab URL that renders them", async () => {
    const rules = await loadRedirects();
    const canonicalSegments = new Set([...Object.values(EVENT_TAB_ROUTES), "run-sheet"]);
    const cases: Array<[string, string]> = [
      ["games", "/dashboard/events/evt-1/registration?part=games"],
      ["planning-checklist", "/dashboard/events/evt-1/briefing"],
      ["decisions", "/dashboard/events/evt-1/decision-log"],
      ["schedule", "/dashboard/events/evt-1/live-ops"],
      ["attendees", "/dashboard/events/evt-1/live-ops"],
      ["timeline", "/dashboard/events/evt-1/live-ops"],
      ["staff", "/dashboard/events/evt-1/coordinators"],
      ["budget", "/dashboard/events/evt-1/billing"],
      ["messages", "/dashboard/events/evt-1/activity"],
      ["post-event-report", "/dashboard/events/evt-1/closure"],
    ];
    for (const [alias, target] of cases) {
      const resolved = redirectTarget(`/dashboard/events/evt-1/${alias}`, rules);
      expect(resolved, alias).toBe(target);
      expect(canonicalSegments.has(target.replace(/\?.*$/, "").split("/").at(-1) ?? ""), alias).toBe(true);
    }
  });

  it("leaves the URLs that filter or own a view alone", async () => {
    const rules = await loadRedirects();
    for (const pathname of [
      "/dashboard/clients/acme",
      "/dashboard/clients/acme/invoices",
      "/dashboard/team/availability",
      "/dashboard/suppliers/preferred",
      "/dashboard/events/upcoming",
      "/dashboard/events/evt-1/registration",
      "/dashboard/events/evt-1/decision-log",
      "/dashboard/events/evt-1/run-sheet",
    ]) {
      expect(redirectTarget(pathname, rules), pathname).toBeUndefined();
    }
  });
});

describe("section readiness", () => {
  it("renders scoped-read sections without waiting for the broad PMCM workspace state", () => {
    // The Inbox and Suppliers load only their own scoped reads; gating them on the broad state left them loading forever.
    for (const section of ["dashboard", "suppliers"] as const) expect(sectionNeedsPmcmReference(section)).toBe(false);
    // Every other section waits only for the small PMCM reference; there is no whole-system dashboard.
    for (const section of ["clients", "inquiries", "events", "finance", "audit"] as const) expect(sectionNeedsPmcmReference(section)).toBe(true);
  });
});
