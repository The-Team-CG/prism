import { describe, expect, it } from "vitest";
import type { PrismCoordinatorRoleView } from "@prism/types";
import { coordinatorMobileTabs } from "./coordinator-on-site";

const roleView = {
  tasks: [{ status: "open" }, { status: "done" }, { status: "blocked" }],
  urgentIssues: [{ status: "open", severity: "high" }, { status: "resolved", severity: "low" }],
} as unknown as PrismCoordinatorRoleView;

const href = (view: string) => `/dashboard?view=${view}`;

describe("coordinator phone tabs", () => {
  it("keeps Now, Tasks, Run sheet and Messages on the bar, with open issues counted on Now", () => {
    const tabs = coordinatorMobileTabs({ roleView, href, registrationRole: false, unreadMessages: 4 });

    expect(tabs.map((tab) => tab.label)).toEqual(["Now", "Tasks", "Run sheet", "Messages"]);
    expect(tabs.map((tab) => tab.badge)).toEqual([1, 2, undefined, 4]);
    expect(tabs[0].subItems?.map((item) => item.id)).toEqual(["issues"]);
  });

  it("gives the registration coordinator Check-in in place of Tasks, reached from Now", () => {
    const tabs = coordinatorMobileTabs({ roleView, href, registrationRole: true });

    expect(tabs.map((tab) => tab.label)).toEqual(["Now", "Check-in", "Run sheet", "Messages"]);
    expect(tabs[1].href).toBe("/dashboard?view=registration");
    expect(tabs[0].subItems?.map((item) => item.id)).toEqual(["issues", "tasks"]);
  });
});
