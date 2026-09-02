import { describe, expect, it } from "vitest";
import {
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
    expect(clientShellTitle({ isEventScopedView: true, eventName: "Gala", route: "overview" })).toBe("Gala");
    expect(clientShellEyebrow({ isEventScopedView: true, route: "overview" })).toBe("Event workspace");
  });

  it("uses portal view meta before generic route titles", () => {
    expect(clientShellTitle({ isEventScopedView: false, portalView: "approvals-pending", route: "approvals" })).toBe(
      "Pending approval",
    );
    expect(clientShellTitle({ isEventScopedView: false, route: "billing" })).toBe("Billing & Payments");
    expect(clientShellDescription({ route: "calendar" })).toContain("Event dates");
  });

  it("falls back to loading copy when workspace state is not ready", () => {
    expect(clientLoadingShellCopy({ route: "events" })).toEqual({
      title: "My events",
      eyebrow: "Event portfolio",
      description: "Loading events…",
    });
  });
});
