/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  vi.useRealTimers();
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
    const onAttendanceChange = vi.fn(async () => {});
    repository.search
      .mockResolvedValueOnce([pendingGuest])
      .mockResolvedValueOnce([{ ...pendingGuest, verificationStatus: "verified" }])
      .mockResolvedValueOnce([{ ...pendingGuest, verificationStatus: "verified", checkedInAt: "2026-10-02T09:00:00.000Z" }]);
    repository.verify.mockResolvedValue({ ...pendingGuest, verificationStatus: "verified" });
    repository.checkIn.mockResolvedValue({ id: "gci_1", eventId: "evt_1", guestName: "Mia Santos", checkedInAt: "2026-10-02T09:00:00.000Z" });
    render(<CoordinatorRegistrationDesk eventId="evt_1" onAttendanceChange={onAttendanceChange} />);

    fireEvent.change(screen.getByLabelText("Search guest roster"), { target: { value: "Mia" } });
    fireEvent.click(screen.getByRole("button", { name: "Search guests" }));

    expect(await screen.findByText("Mia Santos")).toBeTruthy();
    expect(repository.search).toHaveBeenCalledWith("evt_1", "Mia");
    fireEvent.click(screen.getByRole("button", { name: "Mark Mia Santos verified" }));
    await waitFor(() => expect(repository.verify).toHaveBeenCalledWith("evt_1", "gre_1", "verified"));
    await waitFor(() => expect(onAttendanceChange).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Check in Mia Santos" }));
    await waitFor(() => expect(repository.checkIn).toHaveBeenCalledWith("evt_1", "gre_1"));
    await waitFor(() => expect(onAttendanceChange).toHaveBeenCalledTimes(2));
  });

  it("shows the parent-refreshed aggregate without starting its own polling loop", async () => {
    vi.useFakeTimers();
    const props = { eventId: "evt_1", guestAttendanceCount: 2, onAttendanceChange: vi.fn(async () => {}) };
    const { rerender } = render(<CoordinatorRegistrationDesk {...props} />);

    expect(screen.getByText("2 guests checked in.")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(repository.search).not.toHaveBeenCalled();

    rerender(<CoordinatorRegistrationDesk {...props} guestAttendanceCount={5} />);
    expect(screen.getByText("5 guests checked in.")).toBeTruthy();
  });

  it("shows anonymous New-CL1 reviews and requires verification before check-in", async () => {
    const anonymousReview = {
      ...pendingGuest,
      guestName: "Anonymous headcount",
      walkIn: true,
    };
    const verifiedReview = { ...anonymousReview, verificationStatus: "verified" as const };
    repository.search
      .mockResolvedValueOnce([anonymousReview])
      .mockResolvedValueOnce([verifiedReview]);
    repository.verify.mockResolvedValue(verifiedReview);
    render(<CoordinatorRegistrationDesk eventId="evt_1" />);

    fireEvent.change(screen.getByLabelText("Search guest roster"), { target: { value: "Anonymous" } });
    fireEvent.click(screen.getByRole("button", { name: "Search guests" }));

    expect(await screen.findByText("Anonymous headcount")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark Anonymous headcount verified" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Check in Anonymous headcount" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mark Anonymous headcount verified" }));
    await waitFor(() => expect(repository.verify).toHaveBeenCalledWith("evt_1", "gre_1", "verified"));
    expect(await screen.findByRole("button", { name: "Check in Anonymous headcount" })).toBeTruthy();
  });

  it("loads the pending review queue and shows when each review was submitted", async () => {
    const submittedAt = "2026-10-02T09:00:00.000Z";
    const pendingReview = {
      ...pendingGuest,
      guestName: "Anonymous headcount",
      walkIn: true,
      reviewSubmittedAt: submittedAt,
    };
    const verifiedReview = { ...pendingReview, verificationStatus: "verified" as const };
    repository.search
      .mockResolvedValueOnce([pendingReview])
      .mockResolvedValueOnce([verifiedReview])
      .mockResolvedValueOnce([]);
    repository.verify.mockResolvedValue(verifiedReview);
    repository.checkIn.mockResolvedValue({ id: "gci_1", eventId: "evt_1", guestName: null, checkedInAt: submittedAt });
    const { container } = render(<CoordinatorRegistrationDesk eventId="evt_1" />);

    fireEvent.click(screen.getByRole("button", { name: "Pending reviews" }));

    expect(await screen.findByText("Anonymous headcount")).toBeTruthy();
    expect(repository.search).toHaveBeenNthCalledWith(1, "evt_1", "", true);
    expect(container.querySelector("time")?.getAttribute("dateTime")).toBe(submittedAt);

    fireEvent.click(screen.getByRole("button", { name: "Mark Anonymous headcount verified" }));
    expect(await screen.findByRole("button", { name: "Check in Anonymous headcount" })).toBeTruthy();
    expect(repository.search).toHaveBeenNthCalledWith(2, "evt_1", "", true);
    fireEvent.click(screen.getByRole("button", { name: "Check in Anonymous headcount" }));
    await waitFor(() => expect(repository.checkIn).toHaveBeenCalledWith("evt_1", "gre_1"));
    expect(repository.search).toHaveBeenNthCalledWith(3, "evt_1", "", true);
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
