/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { CoordinatorEventSwitcher } from "./coordinator-event-switcher";
import { CoordinatorView } from "./coordinator-view";

vi.mock("@prism/ui", () => ({ PrismDashboardShell: ({ children, navItems, onNavSelect }: { children: import("react").ReactNode; navItems: Array<{ id: string; label: string }>; onNavSelect: (id: string) => void }) => <main><nav>{navItems.map((item) => <button key={item.id} onClick={() => onNavSelect(item.id)}>{item.label}</button>)}</nav>{children}</main> }));
vi.mock("../use-cases/coordinator-desk-actions", () => ({ loadCoordinatorRoleView: vi.fn(async () => null) }));

afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

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
});

it("keeps archived coordinator actions disabled while the event switcher remains usable", async () => {
  render(<CoordinatorView session={{ name: "Marco Santos", email: "marco@pmcm.test", role: "coordinator" } as never}
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

it("keeps the chosen event and work section in the URL", async () => {
  render(<CoordinatorView session={{ name: "Marco Santos", email: "marco@pmcm.test", role: "coordinator" } as never}
    state={{ events, assignments } as never} onRefresh={async () => {}} />);
  fireEvent.change(screen.getByLabelText("Assigned event"), { target: { value: "evt_current" } });
  fireEvent.click(screen.getByRole("button", { name: "Tasks", exact: true }));
  expect(new URLSearchParams(window.location.search).get("event")).toBe("evt_current");
  expect(new URLSearchParams(window.location.search).get("section")).toBe("coord-queue");
});
