import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PrismCoordinatorRoleView } from "@prism/types";
import type { PrismNavItem } from "@prism/ui";
import { navIconDrift } from "@prism/ui/nav-icons";
import { CoordinatorPhoneTitle, coordinatorMobileBar } from "./coordinator-on-site";

const roleView = {
  tasks: [{ status: "open" }, { status: "done" }, { status: "blocked" }],
  urgentIssues: [{ status: "open", severity: "high" }, { status: "resolved", severity: "low" }],
} as unknown as PrismCoordinatorRoleView;

const href = (view: string) => `/dashboard?view=${view}`;
const asItem = (tab: string | PrismNavItem) => (typeof tab === "string" ? { id: tab } as PrismNavItem : tab);

describe("coordinator phone bar", () => {
  it("keeps Now, Tasks and Run sheet around Report, with messages and notifications in the top bar", () => {
    const onReport = vi.fn();
    const bar = coordinatorMobileBar({ roleView, href, registrationRole: false, onReport });
    const tabs = bar.tabs.map(asItem);

    expect(tabs.map((tab) => tab.id)).toEqual(["shift", "tasks", "run-sheet"]);
    expect(tabs.map((tab) => tab.badge)).toEqual([1, 2, undefined]);
    expect(tabs[0].subItems?.map((item) => item.id)).toEqual(["issues"]);
    expect(bar.header).toEqual(["messages", "notifications"]);
    bar.action?.onSelect();
    expect(onReport).toHaveBeenCalledOnce();
  });

  it("gives the registration coordinator Check-in in place of Tasks, reached from Now", () => {
    const tabs = coordinatorMobileBar({ roleView, href, registrationRole: true, onReport: () => {} }).tabs.map(asItem);

    expect(tabs.map((tab) => tab.label ?? tab.id)).toEqual(["Now", "Check-in", "run-sheet"]);
    expect(tabs[1].href).toBe("/dashboard?view=registration");
    expect(tabs[0].subItems?.map((item) => item.id)).toEqual(["issues", "tasks"]);
  });
});

describe("coordinator nav icons", () => {
  it("draws the phone tabs with the icons every portal uses", () => {
    for (const registrationRole of [false, true]) {
      const tabs = coordinatorMobileBar({ roleView: null, href: (view) => `/dashboard?view=${view}`, registrationRole, onReport: () => {} }).tabs;

      expect(navIconDrift(tabs.filter((tab): tab is PrismNavItem => typeof tab !== "string"))).toEqual([]);
    }
  });
});

describe("coordinator phone title", () => {
  const title = (view: "games" | "account") => renderToStaticMarkup(
    <CoordinatorPhoneTitle view={view} cards={[]} onSelectEvent={() => undefined} onNavigate={() => undefined} />,
  );

  it("keeps the event switch on the Games page", () => {
    expect(title("games")).toContain("Switch event");
  });

  it("shows a way back to Now on account pages", () => {
    expect(title("account")).toContain("Back to Now");
  });
});
