/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Bell, CalendarDays, FileCheck2, Inbox, MessageSquare, Radio, Wallet } from "lucide-react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismPortalShell, type PrismMobileBar, type PrismNavItem } from "@prism/ui";

beforeAll(() => {
  // The sidebar and the sheet read these browser APIs; jsdom does not provide them.
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }),
  });
});

afterEach(() => {
  cleanup();
});

const navItems: PrismNavItem[] = [
  { id: "today", label: "Today", icon: Inbox, section: "Work", href: "/dashboard" },
  { id: "calendar", label: "Calendar", icon: CalendarDays, section: "Work", href: "/dashboard/calendar" },
  { id: "messages", label: "Messages", icon: MessageSquare, section: "Work", href: "/dashboard/messages", badge: 3, badgeLabel: "3 unread messages" },
  { id: "notifications", label: "Notifications", icon: Bell, section: "Work", href: "/dashboard/notifications" },
  { id: "files", label: "Files", icon: FileCheck2, section: "Records", href: "/dashboard/files" },
  { id: "payments", label: "Payments", icon: Wallet, section: "Records", href: "/dashboard/payments", badge: 1, badgeLabel: "1 new payment" },
];

function renderShell(mobileBar: PrismMobileBar, activeItemId = "today", onNavSelect = vi.fn()) {
  render(
    <PrismPortalShell
      portal="supplier"
      roleLabel="Supplier Portal"
      title="Today"
      navItems={navItems}
      activeItemId={activeItemId}
      onNavSelect={onNavSelect}
      mobileBar={mobileBar}
      user={{ name: "Lara Cruz", detail: "Supplier" }}
      onSignOut={() => {}}
    >
      <p>page body</p>
    </PrismPortalShell>,
  );
  return { onNavSelect, bar: screen.getAllByRole("navigation", { name: "Main" }).at(-1)! };
}

describe("phone tab bar from the shared shell", () => {
  it("puts every sidebar page that is not a tab or a top-bar icon under More, grouped like the sidebar", () => {
    const { bar, onNavSelect } = renderShell({ tabs: ["today", "calendar"], header: ["messages", "notifications"] });

    expect(within(bar).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Today", "Calendar", "More"]);
    fireEvent.click(within(bar).getByRole("button", { name: "More, has updates" }));

    const sheet = screen.getByRole("dialog", { name: "More" });
    expect(within(sheet).getByRole("region", { name: "Records" })).toBeTruthy();
    expect(within(sheet).getAllByRole("link").map((link) => link.textContent)).toEqual(["Files", "Payments1"]);
    expect(within(sheet).queryByText("Messages")).toBeNull();

    fireEvent.click(within(sheet).getByRole("link", { name: /Payments/ }));
    expect(onNavSelect).toHaveBeenCalledWith("payments");
    expect(screen.queryByRole("dialog", { name: "More" })).toBeNull();
  });

  it("names tabs and top-bar icons with their counts, and keeps search and the account menu in the top bar", () => {
    const { bar } = renderShell({ tabs: ["today", "payments"], header: ["messages", "notifications"] });

    expect(within(bar).getByRole("link", { name: "Payments, 1 new payment" }).getAttribute("href")).toBe("/dashboard/payments");
    const topBar = within(document.querySelector("header")!);
    expect(topBar.getByRole("link", { name: "Messages, 3 unread messages" }).getAttribute("href")).toBe("/dashboard/messages");
    expect(topBar.getByRole("link", { name: "Notifications" })).toBeTruthy();
    expect(topBar.getByRole("button", { name: /search/i })).toBeTruthy();
    expect(topBar.getByRole("button", { name: "Your account" })).toBeTruthy();
  });

  it("lights up More on a page inside it, and leaves More out when every page is a tab or an icon", () => {
    const { bar } = renderShell({ tabs: ["today", "calendar", "files", "payments"], header: ["messages", "notifications"] }, "files");
    expect(within(bar).queryByRole("button", { name: /More/ })).toBeNull();
    cleanup();

    const next = renderShell({ tabs: ["today"], header: ["messages"] }, "files").bar;
    expect(within(next).getByRole("button", { name: /More/ }).getAttribute("aria-current")).toBe("page");
  });

  it("keeps a raised action in the middle, with More last", () => {
    const onReport = vi.fn();
    const { bar } = renderShell({ tabs: ["today", "calendar", "files"], action: { label: "Report", ariaLabel: "Report an issue", icon: Radio, onSelect: onReport } });

    expect(within(bar).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Today", "Calendar", "Report", "Files", "More"]);
    fireEvent.click(within(bar).getByRole("button", { name: "Report an issue" }));
    expect(onReport).toHaveBeenCalledOnce();
  });

  it("refuses a fifth tab, or a fourth beside a raised action, at compile time", () => {
    const action = { label: "Report", icon: Radio, onSelect: () => {} };
    // @ts-expect-error A bar holds four tabs at most, so More always has a slot.
    const tooMany: PrismMobileBar = { tabs: ["a", "b", "c", "d", "e"] };
    // @ts-expect-error A raised action takes a tab's slot.
    const crowded: PrismMobileBar = { tabs: ["a", "b", "c", "d"], action };
    expect([tooMany, crowded]).toHaveLength(2);
  });
});
