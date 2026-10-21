/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismGuestRosterEntry } from "@prism/types";
import { EventRegistrationTab } from "./event-registration-tab";

afterEach(cleanup);

const anonymousReview: PrismGuestRosterEntry = {
  id: "gre_review_1",
  eventId: "evt_1",
  sourceKey: "guest-review-headcount:gre_review_1",
  guestName: "Anonymous headcount",
  eligibility: "eligible",
  verificationStatus: "pending" as const,
  source: "guest-review-headcount",
};

function renderRegistrationTab(overrides: Partial<ComponentProps<typeof EventRegistrationTab>> = {}) {
  return render(
    <EventRegistrationTab
      eventId="evt_1"
      platform={null}
      suppliers={[]}
      busy={false}
      onUpsert={vi.fn()}
      onUpdate={vi.fn()}
      onImportHeadcount={vi.fn()}
      onSearchRoster={vi.fn().mockResolvedValue([])}
      onImportRoster={vi.fn().mockResolvedValue([])}
      onCheckInRoster={vi.fn().mockResolvedValue({})}
      onVerifyRoster={vi.fn().mockResolvedValue({})}
      walkInPolicy="open"
      walkInThreshold={200}
      onUpdateWalkInPolicy={vi.fn()}
      guestPrivacyClassification="unclassified"
      onUpdateGuestPrivacyClassification={vi.fn().mockResolvedValue(true)}
      {...overrides}
    />,
  );
}

describe("EventRegistrationTab", () => {
  it("defaults privacy classification to unclassified and saves PMCM changes", async () => {
    const update = vi.fn().mockResolvedValue(true);
    renderRegistrationTab({ onUpdateGuestPrivacyClassification: update });

    const classification = screen.getByLabelText("Event privacy");
    expect((classification as HTMLSelectElement).value).toBe("unclassified");
    fireEvent.change(classification, { target: { value: "private" } });
    fireEvent.click(screen.getByRole("button", { name: "Save privacy classification" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith({ classification: "private" }));
    expect((await screen.findByRole("status")).textContent).toBe("Privacy classification saved.");
  });

  it("shows a failure message when PMCM cannot save the privacy classification", async () => {
    const update = vi.fn().mockResolvedValue(false);
    renderRegistrationTab({ onUpdateGuestPrivacyClassification: update });

    fireEvent.change(screen.getByLabelText("Event privacy"), { target: { value: "public" } });
    fireEvent.click(screen.getByRole("button", { name: "Save privacy classification" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Unable to save privacy classification.");
  });

  it("shows anonymous New-CL1 reviews and keeps pending entries unavailable for check-in", async () => {
    const onSearchRoster = vi.fn().mockResolvedValue([anonymousReview]);
    const onVerifyRoster = vi.fn().mockResolvedValue({});
    const onCheckInRoster = vi.fn().mockResolvedValue({});
    renderRegistrationTab({ onSearchRoster, onVerifyRoster, onCheckInRoster });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Anonymous headcount")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Check in" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText("Verification for Anonymous headcount")).toBeTruthy();
  });

  it("refreshes a New-CL1 row after verification so staff can check it in", async () => {
    const verifiedReview = { ...anonymousReview, verificationStatus: "verified" as const };
    const onSearchRoster = vi.fn()
      .mockResolvedValueOnce([anonymousReview])
      .mockResolvedValueOnce([verifiedReview])
      .mockResolvedValueOnce([{ ...verifiedReview, checkedInAt: "2026-10-06T10:00:00.000Z" }]);
    const onVerifyRoster = vi.fn().mockResolvedValue(verifiedReview);
    const onCheckInRoster = vi.fn().mockResolvedValue({});
    renderRegistrationTab({ onSearchRoster, onVerifyRoster, onCheckInRoster });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("Anonymous headcount");
    fireEvent.change(screen.getByLabelText("Verification for Anonymous headcount"), {
      target: { value: "verified" },
    });

    await waitFor(() => expect(onVerifyRoster).toHaveBeenCalledWith("gre_review_1", "verified"));
    await waitFor(() => expect((screen.getByRole("button", { name: "Check in" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    await waitFor(() => expect(onCheckInRoster).toHaveBeenCalledWith("gre_review_1"));
  });
});
