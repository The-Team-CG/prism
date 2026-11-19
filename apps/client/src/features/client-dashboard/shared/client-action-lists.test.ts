import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PrismClientActionItem } from "@prism/types";
import { selectClientDashboardActions } from "../workspace/model/client-dashboard-selectors";
import { ClientActionLists } from "./client-action-lists";
import { clientChangeDeadline } from "./client-change-deadline";

const base = { eventId: "evt_1", eventName: "Founders gala", description: "", status: "open" };
const items: PrismClientActionItem[] = [
  {
    ...base, id: "approval:proposal:doc_2", stage: "needs_client", kind: "approval", priority: "attention", label: "Review proposal version 2",
    description: "Approving moves Founders gala into planning.", href: "/dashboard/events/evt_1/proposal",
    decision: { kind: "proposal", versionNumber: 2, changeNote: "Dinner moved to 7 PM", revisionsLeft: 2, decider: { name: "Ana Reyes", isYou: true } },
  },
  {
    ...base, id: "addendum:add_3", stage: "needs_client", kind: "addendum", priority: "attention", label: "Sign addendum 3: Extra guests",
    decision: { kind: "addendum", addendumId: "add_3", versionNumber: 3, financialDelta: 48000 },
  },
  { ...base, id: "change-request:fx_1", stage: "with_pmcm", kind: "change_request", priority: "info", label: "Change request under review" },
  { ...base, id: "approval:billing:st_1", stage: "to_review", kind: "approval", priority: "info", label: "Billing statement available" },
  { ...base, id: "approval:proposal-approved:evt_1", stage: "done", kind: "approval", priority: "info", label: "Proposal approved", decidedAt: "2026-11-03T00:00:00.000Z" },
];

const render = (scope: "account" | "event") => renderToStaticMarkup(createElement(ClientActionLists, {
  actions: selectClientDashboardActions({ items }, "evt_1"), onAction: vi.fn(), todayKey: "2026-11-10", scope,
}));

describe("ClientActionLists", () => {
  it("puts each item under whoever moves it next and shows a decision's facts before the client opens it", () => {
    const markup = render("event");
    const order = ["Needs you", "Sign addendum 3", "Review proposal version 2", "Waiting on PMCM", "Change request under review", "New to read", "Billing statement available", "Recently decided", "Proposal approved"];
    const positions = order.map((text) => markup.indexOf(text));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(markup).toContain("What changed: Dinner moved to 7 PM");
    expect(markup).toContain("2 change requests left");
    expect(markup).toContain("+₱48,000 to your contract");
    expect(markup).toContain('aria-label="Review proposal for Founders gala"');
  });

  it("keeps settled decisions to the event page", () => {
    expect(render("account")).not.toContain("Recently decided");
  });

  it("says the client is caught up inside an event while the rest is with PMCM", () => {
    const markup = renderToStaticMarkup(createElement(ClientActionLists, {
      actions: selectClientDashboardActions({ items: items.filter((item) => item.stage !== "needs_client") }, "evt_1"),
      onAction: vi.fn(), todayKey: "2026-11-10", scope: "event", emptyAction: { label: "Request a change", href: "/dashboard/events/evt_1/changes" },
    }));
    expect(markup).toContain("all caught up");
    expect(markup).toContain('href="/dashboard/events/evt_1/changes"');
  });
});

describe("clientChangeDeadline", () => {
  const event = (overrides: Record<string, unknown>) => ({ archived: false, freezeStatus: "open", freezeDeadlineAt: null, ...overrides });

  it("counts down to the cutoff, warns in the last two weeks, and closes after it or once frozen", () => {
    expect(clientChangeDeadline(event({ freezeDeadlineAt: "2027-04-18" }), "2026-11-19")).toMatchObject({ kind: "open", daysLeft: 150, soon: false });
    expect(clientChangeDeadline(event({ freezeDeadlineAt: "2026-11-25" }), "2026-11-19")).toMatchObject({ kind: "open", daysLeft: 6, soon: true });
    expect(clientChangeDeadline(event({ freezeDeadlineAt: "2026-11-01" }), "2026-11-19")).toEqual({ kind: "closed" });
    expect(clientChangeDeadline(event({ freezeStatus: "frozen" }), "2026-11-19")).toEqual({ kind: "closed" });
    expect(clientChangeDeadline(event({}), "2026-11-19")).toBeNull();
    expect(clientChangeDeadline(event({ archived: true, freezeStatus: "frozen" }), "2026-11-19")).toBeNull();
  });
});
