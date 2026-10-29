/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

    expect((screen.getByRole("radio", { name: /Not set/ }) as HTMLInputElement).checked).toBe(true);
    const save = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /Private/ }));
    fireEvent.click(save);

    await waitFor(() => expect(update).toHaveBeenCalledWith({ classification: "private" }));
    expect((await screen.findByText("Admission settings saved.")).getAttribute("role")).toBe("status");
  });

  it("shows a failure message when PMCM cannot save the privacy classification", async () => {
    renderRegistrationTab({ onUpdateGuestPrivacyClassification: vi.fn().mockResolvedValue(false) });

    fireEvent.click(screen.getByRole("radio", { name: /Public/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't save the privacy setting. Try again.");
  });

  it("shows anonymous New-CL1 reviews and keeps pending entries unavailable for check-in", async () => {
    const onSearchRoster = vi.fn().mockResolvedValue([anonymousReview]);
    renderRegistrationTab({ onSearchRoster, onVerifyRoster: vi.fn().mockResolvedValue({}), onCheckInRoster: vi.fn().mockResolvedValue({}) });

    // The roster loads on its own when the tab opens; there is no Search button to press.
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

    await screen.findByText("Anonymous headcount");
    fireEvent.change(screen.getByLabelText("Verification for Anonymous headcount"), {
      target: { value: "verified" },
    });

    await waitFor(() => expect(onVerifyRoster).toHaveBeenCalledWith("gre_review_1", "verified"));
    await waitFor(() => expect((screen.getByRole("button", { name: "Check in" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    await waitFor(() => expect(onCheckInRoster).toHaveBeenCalledWith("gre_review_1"));
  });

  it("imports a pasted spreadsheet only after the preview shows every row ready", async () => {
    const onImportRoster = vi.fn().mockResolvedValue([{ ...anonymousReview, id: "gre_1", guestName: "Ada Lovelace", sourceKey: "A-1" }]);
    renderRegistrationTab({ onImportRoster });

    fireEvent.click(screen.getAllByRole("button", { name: "Import guests" })[0]);
    const panel = within(screen.getByRole("region", { name: "Import guests" }));
    expect(panel.getByRole("link", { name: /Template/ }).getAttribute("download")).toBe("guest-roster-template.csv");
    const sheet = panel.getByLabelText("Or paste rows, header first");
    fireEvent.change(sheet, { target: { value: ["guestName,category,table,sourceKey", "Ada Lovelace,VIP,T1,A-1", ",VIP,T2,A-2"].join("\n") } });
    expect(panel.getByTestId("roster-preview-summary").textContent).toContain("1 ready · 1 need fixing");
    expect(panel.getByText("Guest name is required")).toBeTruthy();
    expect((panel.getByRole("button", { name: "Import guests" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(sheet, { target: { value: ["guestName,category,table,sourceKey", "Ada Lovelace,VIP,T1,A-1"].join("\n") } });
    fireEvent.click(panel.getByRole("button", { name: "Import 1 guest" }));

    await waitFor(() => expect(onImportRoster).toHaveBeenCalledWith({ source: "spreadsheet", rows: [{ guestName: "Ada Lovelace", category: "VIP", table: "T1", sourceKey: "A-1" }] }));
    // A successful import closes the panel and shows the imported guests in the roster.
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Import guests" })).toBeNull();
  });
});
