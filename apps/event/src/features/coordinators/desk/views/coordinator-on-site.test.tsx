import { describe, expect, it } from "vitest";
import type { PrismCoordinatorRoleView } from "@prism/types";
import { coordinatorMobileTabs } from "./coordinator-on-site";

const roleView = {
  tasks: [{ status: "open" }, { status: "done" }, { status: "blocked" }],
  urgentIssues: [{ status: "open", severity: "high" }, { status: "resolved", severity: "low" }],
} as unknown as PrismCoordinatorRoleView;

describe("coordinator phone tabs", () => {
  it("offers Now, Tasks, Issues, Run sheet and More, with what is still open on Tasks and Issues", () => {
    const tabs = coordinatorMobileTabs({ roleView, href: (view) => `/dashboard?view=${view}`, unreadMessages: 2 });

    expect(tabs.map((tab) => tab.label)).toEqual(["Now", "Tasks", "Issues", "Run sheet", "More"]);
    expect(tabs.map((tab) => tab.badge)).toEqual([undefined, 2, 1, undefined, 2]);
    expect(tabs[0].href).toBe("/dashboard?view=shift");
  });

  it("lights More on every page it holds", () => {
    const more = coordinatorMobileTabs({ roleView: null, href: (view) => view }).at(-1);

    expect(more?.subItems?.map((item) => item.id)).toEqual(expect.arrayContaining(["calendar", "messages", "notifications", "assignments", "account"]));
    expect(more?.badge).toBeUndefined();
  });
});
