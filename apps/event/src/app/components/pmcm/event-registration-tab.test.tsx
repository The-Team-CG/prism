/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  PrismGuestQrPassIssueResult,
  PrismGuestQrPassStatus,
  PrismGuestRosterEntry,
} from "@prism/types";
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

function registrationTabElement(overrides: Partial<ComponentProps<typeof EventRegistrationTab>> = {}) {
  return (
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
      canManageGuestQrPasses={false}
      onLoadGuestQrPasses={vi.fn().mockResolvedValue([])}
      onIssueGuestQrPass={vi.fn().mockResolvedValue(null)}
      onRetryGuestQrPass={vi.fn().mockResolvedValue(null)}
      onReissueGuestQrPass={vi.fn().mockResolvedValue(null)}
      onRevokeGuestQrPass={vi.fn().mockResolvedValue(null)}
      {...overrides}
    />
  );
}

function renderRegistrationTab(overrides: Partial<ComponentProps<typeof EventRegistrationTab>> = {}) {
  return render(registrationTabElement(overrides));
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

  it("keeps QR management hidden from registration coordinators", async () => {
    const onLoadGuestQrPasses = vi.fn().mockResolvedValue([]);
    renderRegistrationTab({
      canManageGuestQrPasses: false,
      onLoadGuestQrPasses,
      onSearchRoster: vi.fn().mockResolvedValue([eligibleGuest]),
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("Ada Lovelace");

    expect(screen.queryByRole("button", { name: /QR pass/i })).toBeNull();
    expect(onLoadGuestQrPasses).not.toHaveBeenCalled();
  });

  it("issues a PMCM-only one-time QR without rendering its token as text", async () => {
    const capturedPass: PrismGuestQrPassStatus = {
      id: "gqp_1",
      eventId: "evt_1",
      rosterEntryId: eligibleGuest.id,
      status: "active",
      deliveryStatus: "captured",
      issuedAt: "2026-10-17T00:00:00.000Z",
      revokedAt: null,
    };
    const issueResult: PrismGuestQrPassIssueResult = {
      pass: capturedPass,
      qrValue: "https://guest.example/qr-check-in?accessCode=DEMO#opaque-secret",
    };
    const onIssueGuestQrPass = vi.fn().mockResolvedValue(issueResult);
    renderRegistrationTab({
      canManageGuestQrPasses: true,
      onLoadGuestQrPasses: vi.fn().mockResolvedValue([]),
      onIssueGuestQrPass,
      onSearchRoster: vi.fn().mockResolvedValue([eligibleGuest]),
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.click(await screen.findByRole("button", { name: "Issue QR pass" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Captured for demo; not sent.");
    expect(dialog.textContent).not.toContain("opaque-secret");
    expect(screen.getByRole("img", { name: "One-time guest QR pass" })).toBeTruthy();
    expect(onIssueGuestQrPass).toHaveBeenCalledWith(eligibleGuest.id);

    fireEvent.click(screen.getByRole("button", { name: "Close QR" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("removes the one-time QR from the view when QR management access is lost", async () => {
    const props = {
      canManageGuestQrPasses: true,
      onLoadGuestQrPasses: vi.fn().mockResolvedValue([]),
      onIssueGuestQrPass: vi.fn().mockResolvedValue({
        pass: {
          id: "gqp_1",
          eventId: "evt_1",
          rosterEntryId: eligibleGuest.id,
          status: "active",
          deliveryStatus: "captured",
          issuedAt: "2026-10-17T00:00:00.000Z",
          revokedAt: null,
        },
        qrValue: "https://guest.example/qr-check-in?accessCode=DEMO#secret",
      } satisfies PrismGuestQrPassIssueResult),
      onSearchRoster: vi.fn().mockResolvedValue([eligibleGuest]),
    };
    const rendered = renderRegistrationTab(props);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.click(await screen.findByRole("button", { name: "Issue QR pass" }));
    await screen.findByRole("dialog");

    rendered.rerender(registrationTabElement({ ...props, canManageGuestQrPasses: false }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it("requires confirmation before reissue and explains the old QR stops working", async () => {
    const failedPass: PrismGuestQrPassStatus = {
      id: "gqp_2",
      eventId: "evt_1",
      rosterEntryId: eligibleGuest.id,
      status: "active",
      deliveryStatus: "failed",
      issuedAt: "2026-10-17T00:00:00.000Z",
      revokedAt: null,
    };
    const onReissueGuestQrPass = vi.fn().mockResolvedValue(null);
    renderRegistrationTab({
      canManageGuestQrPasses: true,
      onLoadGuestQrPasses: vi.fn().mockResolvedValue([failedPass]),
      onReissueGuestQrPass,
      onSearchRoster: vi.fn().mockResolvedValue([eligibleGuest]),
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText(/Failed/);
    fireEvent.click(screen.getByRole("button", { name: "Reissue QR pass" }));

    const confirmation = await screen.findByRole("alertdialog");
    expect(confirmation.textContent).toContain("The old QR will stop working immediately.");
    expect(onReissueGuestQrPass).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onReissueGuestQrPass).not.toHaveBeenCalled();

    const onRevokeGuestQrPass = vi.fn().mockResolvedValue(null);
    // Render a fresh active pass to exercise the separate revoke confirmation.
    cleanup();
    renderRegistrationTab({
      canManageGuestQrPasses: true,
      onLoadGuestQrPasses: vi.fn().mockResolvedValue([failedPass]),
      onRevokeGuestQrPass,
      onSearchRoster: vi.fn().mockResolvedValue([eligibleGuest]),
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText(/Failed/);
    fireEvent.click(screen.getByRole("button", { name: "Revoke QR pass" }));

    const revokeConfirmation = await screen.findByRole("alertdialog");
    expect(revokeConfirmation.textContent).toContain("The old QR will stop working immediately.");
    expect(onRevokeGuestQrPass).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onRevokeGuestQrPass).not.toHaveBeenCalled();
  });

  it("offers delivery retry only while queued and keeps reissue available after failure", async () => {
    const failedPass: PrismGuestQrPassStatus = {
      id: "gqp_failed",
      eventId: "evt_1",
      rosterEntryId: eligibleGuest.id,
      status: "active",
      deliveryStatus: "failed",
      issuedAt: "2026-10-17T00:00:00.000Z",
      revokedAt: null,
    };
    renderRegistrationTab({
      canManageGuestQrPasses: true,
      onLoadGuestQrPasses: vi.fn().mockResolvedValue([failedPass]),
      onSearchRoster: vi.fn().mockResolvedValue([eligibleGuest]),
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText(/Failed/);

    expect(screen.queryByRole("button", { name: "Retry delivery" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reissue QR pass" })).toBeTruthy();

    cleanup();
    const queuedPass: PrismGuestQrPassStatus = { ...failedPass, id: "gqp_queued", deliveryStatus: "queued" };
    const onRetryGuestQrPass = vi.fn().mockResolvedValue(queuedPass);
    renderRegistrationTab({
      canManageGuestQrPasses: true,
      onLoadGuestQrPasses: vi.fn().mockResolvedValue([queuedPass]),
      onRetryGuestQrPass,
      onSearchRoster: vi.fn().mockResolvedValue([eligibleGuest]),
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("button", { name: "Retry delivery" });
    fireEvent.click(screen.getByRole("button", { name: "Retry delivery" }));

    await waitFor(() => expect(onRetryGuestQrPass).toHaveBeenCalledWith("gqp_queued"));
  });
});

const eligibleGuest: PrismGuestRosterEntry = {
  id: "gre_qr_1",
  eventId: "evt_1",
  sourceKey: "import-1",
  guestName: "Ada Lovelace",
  email: "ada@example.test",
  eligibility: "eligible",
  verificationStatus: "verified",
  source: "xperto",
  importBatchId: "batch_1",
};
