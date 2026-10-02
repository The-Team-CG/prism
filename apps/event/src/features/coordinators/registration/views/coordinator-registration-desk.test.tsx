/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoordinatorRegistrationDesk } from "./coordinator-registration-desk";

const { repository } = vi.hoisted(() => ({
  repository: {
    search: vi.fn(),
    checkIn: vi.fn(),
    verify: vi.fn(),
    registerWalkIn: vi.fn(),
  },
}));

vi.mock("../data/coordinator-registration-repository", () => ({ coordinatorRegistrationRepository: repository }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const pendingGuest = {
  id: "gre_1",
  eventId: "evt_1",
  guestName: "Mia Santos",
  category: "VIP",
  table: "A1",
  eligibility: "eligible",
  verificationStatus: "pending" as const,
  checkedInAt: null,
  walkIn: false,
};

describe("CoordinatorRegistrationDesk", () => {
  it("searches the assigned roster and supports verification and check-in", async () => {
    repository.search
      .mockResolvedValueOnce([pendingGuest])
      .mockResolvedValueOnce([{ ...pendingGuest, verificationStatus: "verified" }])
      .mockResolvedValueOnce([{ ...pendingGuest, verificationStatus: "verified", checkedInAt: "2026-10-02T09:00:00.000Z" }]);
    repository.verify.mockResolvedValue({ ...pendingGuest, verificationStatus: "verified" });
    repository.checkIn.mockResolvedValue({ id: "gci_1", eventId: "evt_1", guestName: "Mia Santos", checkedInAt: "2026-10-02T09:00:00.000Z" });
    render(<CoordinatorRegistrationDesk eventId="evt_1" />);

    fireEvent.change(screen.getByLabelText("Search guest roster"), { target: { value: "Mia" } });
    fireEvent.click(screen.getByRole("button", { name: "Search guests" }));

    expect(await screen.findByText("Mia Santos")).toBeTruthy();
    expect(repository.search).toHaveBeenCalledWith("evt_1", "Mia");
    fireEvent.click(screen.getByRole("button", { name: "Mark Mia Santos verified" }));
    await waitFor(() => expect(repository.verify).toHaveBeenCalledWith("evt_1", "gre_1", "verified"));
    fireEvent.click(screen.getByRole("button", { name: "Check in Mia Santos" }));
    await waitFor(() => expect(repository.checkIn).toHaveBeenCalledWith("evt_1", "gre_1"));
  });

  it("requires explicit privacy consent before registering a walk-in", async () => {
    repository.registerWalkIn.mockResolvedValue({ ...pendingGuest, id: "gre_walkin", guestName: "Walk-In Guest", category: "Walk-in", walkIn: true });
    render(<CoordinatorRegistrationDesk eventId="evt_1" />);

    fireEvent.change(screen.getByLabelText("Guest name"), { target: { value: "Walk-In Guest" } });
    fireEvent.click(screen.getByRole("button", { name: "Register walk-in" }));
    expect(repository.registerWalkIn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("The guest received the privacy notice and confirmed consent to event registration."));
    fireEvent.click(screen.getByRole("button", { name: "Register walk-in" }));

    await waitFor(() => expect(repository.registerWalkIn).toHaveBeenCalledWith("evt_1", {
      guestName: "Walk-In Guest",
      privacyConsentAccepted: true,
    }));
    expect((await screen.findByRole("status")).textContent).toContain("added to the roster pending verification");
    expect(await screen.findByText("Walk-In Guest")).toBeTruthy();
  });
});
