/** @vitest-environment jsdom */
import { createElement, type ReactNode } from "react";
import { cleanup, fireEvent, render as renderTest, screen, waitFor } from "@testing-library/react";
import { PortalQueryProvider } from "@prism/portal-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { CoordinatorEventSwitcher } from "./coordinator-event-switcher";
import { CoordinatorView } from "./coordinator-view";

// Sidebar items render as anchors with their href, as the real shell does; a plain click keeps the in-app selection.
vi.mock("@prism/ui", () => ({
  PrismDashboardShell: ({ children, navItems, onNavSelect, sidebarContext, headerActions }: {
    children: import("react").ReactNode;
    navItems: Array<{ id: string; label: string; href?: string }>;
    onNavSelect: (id: string) => void;
    sidebarContext?: import("react").ReactNode;
    headerActions?: import("react").ReactNode;
  }) => (
    <main>
      <aside>{sidebarContext}</aside>
      {headerActions}
      <nav>
        {navItems.map((item) => (
          <a key={item.id} href={item.href} onClick={(event) => { event.preventDefault(); onNavSelect(item.id); }}>{item.label}</a>
        ))}
      </nav>
      {children}
    </main>
  ),
}));
const navigation = vi.hoisted(() => ({ pathname: "/dashboard" as string | null, replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));
vi.mock("../use-cases/coordinator-desk-actions", () => ({ loadCoordinatorRoleView: vi.fn(async () => null) }));
vi.mock("../data/coordinators-repository", () => ({
  coordinatorFocusRoleView: { name: "coordinator.focus-role-view", staleMs: 30_000, fetch: vi.fn(async () => null) },
}));

const wrapper = ({ children }: { children: ReactNode }) => createElement(PortalQueryProvider, { actorKey: "marco@pmcm.test", children });
const render: typeof renderTest = ((ui: Parameters<typeof renderTest>[0]) => renderTest(ui, { wrapper })) as typeof renderTest;

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  navigation.pathname = "/dashboard";
  navigation.replace.mockClear();
});

const events = [
  { id: "evt_current", eventName: "Summit 2026", eventDate: "2026-10-04", venue: "Updated Hall" },
  { id: "evt_past", eventName: "Leadership Forum", eventDate: "2026-08-01", venue: "Historic Hall", archived: true },
  { id: "evt_unassigned", eventName: "Private Event", eventDate: "2026-10-12", venue: "Private Venue" },
] as PrismEvent[];

const assignments = [
  { id: "asg_current", eventId: "evt_current", coordinatorName: "Marco Santos", role: "Floor Director", status: "acknowledged" },
  { id: "asg_past", eventId: "evt_past", coordinatorName: "Marco Santos", role: "Usher", status: "acknowledged" },
  { id: "asg_inactive", eventId: "evt_unassigned", coordinatorName: "Marco Santos", role: "Usher", status: "replaced" },
] as PrismCoordinatorAssignment[];

const session = { name: "Marco Santos", email: "marco@pmcm.test", role: "coordinator" } as never;

describe("CoordinatorEventSwitcher", () => {
  it("opens an assigned past event and hides events without an active assignment", () => {
    const onSelect = vi.fn();
    render(
      <CoordinatorEventSwitcher
        events={events}
        assignments={assignments}
        selectedEventId="evt_current"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("option", { name: "Leadership Forum — Aug 1, 2026" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /^Private Event\b/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Assigned event"), { target: { value: "evt_past" } });

    expect(onSelect).toHaveBeenCalledWith("evt_past");
  });

  it("shows a single assigned event as text with its date and role, not as a dropdown", () => {
    render(
      <CoordinatorEventSwitcher
        events={[events[0]]}
        assignments={[assignments[0]]}
        selectedEventId="evt_current"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Summit 2026")).toBeTruthy();
    expect(screen.getByText("Oct 4, 2026 · Floor Director")).toBeTruthy();
    expect(screen.queryByText(/Venue to be confirmed/)).toBeNull();
  });
});

it("keeps archived coordinator actions disabled while the event switcher remains usable", async () => {
  render(<CoordinatorView session={session}
    state={{ events, assignments: assignments.map((item) => ({ ...item, status: "pending_acknowledgement" })) } as never}
    onRefresh={async () => {}} />);
  fireEvent.change(screen.getByLabelText("Assigned event"), { target: { value: "evt_past" } });
  await waitFor(() => expect(screen.getByText("Archived event: operational records are read-only.")).toBeTruthy());
  const archivedActionButtons = [...document.querySelectorAll('fieldset button')];
  expect(archivedActionButtons.length).toBeGreaterThan(0);
  expect(archivedActionButtons.every((button) => button.matches(':disabled'))).toBe(true);
  fireEvent.change(screen.getByLabelText("Assigned event"), { target: { value: "evt_current" } });
  await waitFor(() => expect(screen.queryByText("Archived event: operational records are read-only.")).toBeNull());
  expect([...document.querySelectorAll('fieldset')].every((fieldset) => !fieldset.disabled)).toBe(true);
});

it("keeps the chosen event and work view in the URL", async () => {
  render(<CoordinatorView session={session} state={{ events, assignments } as never} onRefresh={async () => {}} />);
  fireEvent.change(screen.getByLabelText("Assigned event"), { target: { value: "evt_current" } });
  fireEvent.click(screen.getByRole("link", { name: "Tasks" }));
  expect(new URLSearchParams(window.location.search).get("event")).toBe("evt_current");
  expect(new URLSearchParams(window.location.search).get("view")).toBe("tasks");
  expect(new URLSearchParams(window.location.search).has("section")).toBe(false);
});

it("gives each sidebar view a real link to its readable URL", () => {
  render(<CoordinatorView session={session} state={{ events, assignments } as never} onRefresh={async () => {}} />);
  expect(screen.getByRole("link", { name: "Issues" }).getAttribute("href")).toBe("/dashboard?view=issues&event=evt_current");
});

it("sends a PMCM or unknown path home with a notice that can be dismissed", async () => {
  navigation.pathname = "/dashboard/events/evt_current/billing";
  render(<CoordinatorView session={session} state={{ events, assignments } as never} onRefresh={async () => {}} />);

  expect(navigation.replace).toHaveBeenCalledWith("/dashboard?view=shift&notice=outside-portal");

  // The redirect lands on the home URL carrying the notice; dismissing it removes the notice from the URL.
  cleanup();
  navigation.pathname = "/dashboard";
  window.history.replaceState(null, "", "/dashboard?view=shift&notice=outside-portal");
  render(<CoordinatorView session={session} state={{ events, assignments } as never} onRefresh={async () => {}} />);
  expect(screen.getByText("That page isn't part of the coordinator portal.")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByText("That page isn't part of the coordinator portal.")).toBeNull();
  expect(new URLSearchParams(window.location.search).has("notice")).toBe(false);
});

it("rewrites old section links to the readable view and keeps the event", () => {
  window.history.replaceState(null, "", "/dashboard?section=coord-queue&event=evt_current");
  render(<CoordinatorView session={session} state={{ events, assignments } as never} onRefresh={async () => {}} />);

  expect(window.location.search).toBe("?view=tasks&event=evt_current");
});

it("opens the issue form from the top bar in one step", () => {
  render(<CoordinatorView session={session} state={{ events, assignments } as never} onRefresh={async () => {}} />);

  fireEvent.click(screen.getAllByRole("button", { name: "Report an issue" })[0]);

  expect(new URLSearchParams(window.location.search).get("view")).toBe("issues");
});
