// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PrismCoordinatorAssignment, PrismCoordinatorPoolAvailability } from "@prism/types";
import { EmergencyWithdrawalsNotice, PoolAvailabilityNote } from "./coordinator-coverage-cards";

afterEach(cleanup);

const pool = (overrides: Partial<PrismCoordinatorPoolAvailability> = {}): PrismCoordinatorPoolAvailability => ({
  eventDate: "2026-06-18",
  activeCoordinators: 12,
  available: 10,
  alreadyAssigned: 1,
  markedUnavailable: 1,
  availableByRole: [],
  ...overrides,
});

const assignment = (overrides: Partial<PrismCoordinatorAssignment>): PrismCoordinatorAssignment => ({
  id: "asg_1",
  eventId: "evt_1",
  coordinatorName: "Marco Santos",
  role: "Floor Director",
  status: "cancelled",
  doubleBookingWarning: false,
  ...overrides,
});

describe("PoolAvailabilityNote", () => {
  it("says how many of the active pool are free and what took the rest", () => {
    render(<PoolAvailabilityNote pool={pool()} />);
    expect(screen.getByRole("status").textContent).toBe(
      "10 of 12 active coordinators are free on 2026-06-18 · 1 assigned to events that day · 1 marked unavailable.",
    );
  });

  it("leaves out reasons that do not apply and shows nothing before the count loads", () => {
    const { rerender } = render(<PoolAvailabilityNote pool={pool({ alreadyAssigned: 0, markedUnavailable: 0, available: 12 })} />);
    expect(screen.getByRole("status").textContent).toBe("12 of 12 active coordinators are free on 2026-06-18.");
    rerender(<PoolAvailabilityNote pool={null} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("EmergencyWithdrawalsNotice", () => {
  it("alerts only for withdrawals inside the 48-hour window and carries the reason", () => {
    render(
      <EmergencyWithdrawalsNotice
        assignments={[
          assignment({ id: "asg_late", coordinatorName: "Marco Santos", emergencyChange: true, withdrawalReason: "Family emergency" }),
          assignment({ id: "asg_early", coordinatorName: "Rhea Cruz", emergencyChange: false }),
        ]}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Marco Santos withdrew from Floor Director: Family emergency. Assign a replacement below.");
    expect(alert.textContent).not.toContain("Rhea Cruz");
  });

  it("renders nothing when there is no emergency withdrawal", () => {
    render(<EmergencyWithdrawalsNotice assignments={[assignment({ emergencyChange: false })]} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
