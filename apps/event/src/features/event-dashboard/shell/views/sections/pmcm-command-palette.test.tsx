/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Inbox } from "lucide-react";
import type { PrismEvent, PrismEventDayTask, PrismInquiry, PrismUrgentIssue } from "@prism/types";
import { PrismPortalShell, type PrismCommandGroup, type PrismNavItem } from "@prism/ui";
import { buildPmcmCommandGroups } from "../../model/event-command-index";
import { buildCoordinatorCommandActions, buildCoordinatorRecordGroups } from "@/features/coordinators/desk/model/coordinator-command-index";

const PALETTE_PLACEHOLDER = "Find events, clients or pages";

const navItems: PrismNavItem[] = [{ id: "inbox", label: "Inbox", icon: Inbox, section: "PMCM" }];

const ayala = { id: "evt_ayala", eventName: "Ayala Tech Summit 2026", clientName: "Ayala Tech", eventDate: "2026-06-18", status: "event_day" } as PrismEvent;
const inquiry = { id: "inq_ayala", clientName: "Ayala Tech", eventName: "Ayala Tech Summit 2026", status: "accepted" } as PrismInquiry;

beforeAll(() => {
  // cmdk and the sidebar read these browser APIs; jsdom does not provide them.
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = () => {};
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }),
  });
});

afterEach(() => {
  cleanup();
});

function openPalette(placeholder: string) {
  fireEvent.click(screen.getByRole("button", { name: placeholder }));
  return screen.getByPlaceholderText(placeholder);
}

function renderShell(commandGroups: PrismCommandGroup[], extra: { commandActions?: Parameters<typeof PrismPortalShell>[0]["commandActions"]; commandEmptyLabel?: string; searchPlaceholder: string }) {
  return render(
    <PrismPortalShell
      portal="event"
      roleLabel="PMCM Event Command"
      title="Inbox"
      navItems={navItems}
      activeItemId="inbox"
      commandGroups={commandGroups}
      {...extra}
    >
      <p>page body</p>
    </PrismPortalShell>,
  );
}

describe("PMCM Ctrl K palette", () => {
  it("finds events, clients and inquiries by name, and opens the matching record", () => {
    const openEvent = vi.fn();
    const openClient = vi.fn();
    const openInquiry = vi.fn();
    const groups = buildPmcmCommandGroups(
      { events: [ayala], clients: [{ id: "ayala-tech", name: "Ayala Tech", events: [ayala], inquiries: [inquiry] }], inquiries: [inquiry] },
      { openEvent, openClient, openInquiry },
    );
    renderShell(groups, { searchPlaceholder: PALETTE_PLACEHOLDER, commandEmptyLabel: "Nothing matches. Try an event or client name." });

    const input = openPalette(PALETTE_PLACEHOLDER);
    expect(screen.queryByRole("option", { name: /Ayala Tech Summit 2026/ })).toBeNull();

    fireEvent.change(input, { target: { value: "ayala" } });
    fireEvent.click(screen.getByRole("option", { name: /^Ayala Tech Summit 2026/ }));
    expect(openEvent).toHaveBeenCalledWith("evt_ayala", "overview");

    openPalette(PALETTE_PLACEHOLDER);
    fireEvent.change(screen.getByPlaceholderText(PALETTE_PLACEHOLDER), { target: { value: "accepted" } });
    fireEvent.click(screen.getByRole("option", { name: /Ayala Tech Summit 2026 · accepted/ }));
    expect(openInquiry).toHaveBeenCalledWith(inquiry);
  });

  it("finds a per-event section by its tab name and opens that tab", () => {
    const openEvent = vi.fn();
    const groups = buildPmcmCommandGroups({ events: [ayala], clients: [], inquiries: [] }, { openEvent, openClient: vi.fn(), openInquiry: vi.fn() });
    renderShell(groups, { searchPlaceholder: PALETTE_PLACEHOLDER });

    fireEvent.change(openPalette(PALETTE_PLACEHOLDER), { target: { value: "bill" } });
    fireEvent.click(screen.getByRole("option", { name: /^Billing — Ayala Tech Summit 2026/ }));

    expect(openEvent).toHaveBeenCalledWith("evt_ayala", "billing");
  });

  it("suggests an event or client name when nothing matches", () => {
    const groups = buildPmcmCommandGroups({ events: [ayala], clients: [], inquiries: [] }, { openEvent: vi.fn(), openClient: vi.fn(), openInquiry: vi.fn() });
    renderShell(groups, { searchPlaceholder: PALETTE_PLACEHOLDER, commandEmptyLabel: "Nothing matches. Try an event or client name." });

    fireEvent.change(openPalette(PALETTE_PLACEHOLDER), { target: { value: "zzqx" } });

    expect(screen.getByText("Nothing matches. Try an event or client name.")).toBeTruthy();
  });
});

describe("coordinator Ctrl K palette", () => {
  it("offers Report an issue, and Mark attendance only when the attendance window allows it", () => {
    const onNavigate = vi.fn();
    const actions = buildCoordinatorCommandActions({ canMark: false, hasAssignment: true, windowOpen: false }, onNavigate);
    renderShell([], { commandActions: actions, searchPlaceholder: "Search tasks and issues..." });

    const input = openPalette("Search tasks and issues...");
    fireEvent.change(input, { target: { value: "attend" } });
    const attendance = screen.getByRole("option", { name: /^Mark attendance/ });
    expect(attendance.getAttribute("aria-disabled")).toBe("true");
    expect(within(attendance).getByText("Opens the day before the event")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Search tasks and issues..."), { target: { value: "report" } });
    fireEvent.click(screen.getByRole("option", { name: /^Report an issue/ }));
    expect(onNavigate).toHaveBeenCalledWith("issues");
  });

  it("finds the coordinator's own tasks and issues for the open event and opens the matching view", () => {
    const onNavigate = vi.fn();
    const groups = buildCoordinatorRecordGroups(
      {
        tasks: [{ id: "task_1", title: "Venue sweep", status: "open", ownerName: "Marco", dueAt: null } as PrismEventDayTask],
        issues: [{ id: "issue_1", title: "Generator fault", severity: "high", status: "open" } as PrismUrgentIssue],
      },
      onNavigate,
    );
    renderShell(groups, { searchPlaceholder: "Search tasks and issues..." });

    fireEvent.change(openPalette("Search tasks and issues..."), { target: { value: "generator" } });
    fireEvent.click(screen.getByRole("option", { name: /^Generator fault/ }));

    expect(onNavigate).toHaveBeenCalledWith("issues");
  });
});
