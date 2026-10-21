/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { CoordinatorEventSwitcher } from "./coordinator-event-switcher";
import { CoordinatorView } from "./coordinator-view";

vi.mock("@prism/ui", () => ({ PrismDashboardShell: ({ children }: { children: import("react").ReactNode }) => <main>{children}</main> }));
vi.mock("../use-cases/coordinator-desk-actions", () => ({ loadCoordinatorRoleView: vi.fn(async () => null) }));

afterEach(cleanup);

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

    const pastEvent = screen.getByRole("button", { name: "Open Leadership Forum" });
    expect(screen.getByText("Venue: Historic Hall")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Private Event" })).toBeNull();
    fireEvent.click(pastEvent);

    expect(onSelect).toHaveBeenCalledWith("evt_past");
  });
});

it("keeps archived coordinator actions disabled while the event switcher remains usable", async () => {
  render(<CoordinatorView session={{ name: "Marco Santos", email: "marco@pmcm.test", role: "coordinator" } as never}
    state={{ events, assignments: assignments.map((item) => ({ ...item, status: "pending_acknowledgement" })) } as never}
    onRefresh={async () => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Open Leadership Forum" }));
  await waitFor(() => expect(screen.getByText("Archived event: operational records are read-only.")).toBeTruthy());
  const archivedActionButtons = [...document.querySelectorAll('fieldset button')];
  expect(archivedActionButtons.length).toBeGreaterThan(0);
  expect(archivedActionButtons.every((button) => button.matches(':disabled'))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Open Summit 2026" }));
  await waitFor(() => expect(screen.queryByText("Archived event: operational records are read-only.")).toBeNull());
  expect([...document.querySelectorAll('fieldset')].every((fieldset) => !fieldset.disabled)).toBe(true);
});
