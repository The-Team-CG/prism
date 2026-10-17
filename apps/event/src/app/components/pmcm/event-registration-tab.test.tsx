/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  PrismGuestQrPassIssueResult,
  PrismGuestQrPassRosterStatus,
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
      onLoadGuestQrPasses={vi.fn().mockResolvedValue({ available: true, passes: [] })}
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
    const onLoadGuestQrPasses = vi.fn().mockResolvedValue({ available: true, passes: [] });
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

  it("clears roster rows and guest QR actions when switching events", async () => {
    const props = {
      canManageGuestQrPasses: true,
      onLoadGuestQrPasses: vi.fn().mockResolvedValue({ available: true, passes: [] }),
      onSearchRoster: vi.fn().mockResolvedValue([eligibleGuest]),
    };
    const rendered = renderRegistrationTab(props);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Issue QR pass" })).toBeTruthy();

    rendered.rerender(registrationTabElement({ ...props, eventId: "evt_2" }));

    await waitFor(() => expect(screen.queryByText("Ada Lovelace")).toBeNull());
    expect(screen.queryByRole("button", { name: "Issue QR pass" })).toBeNull();
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
    const onLoadGuestQrPasses = vi.fn().mockResolvedValue({ available: true, passes: [] });
    renderRegistrationTab({
      canManageGuestQrPasses: true,
      onLoadGuestQrPasses,
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
    expect(onLoadGuestQrPasses).toHaveBeenNthCalledWith(1, []);
    expect(onLoadGuestQrPasses).toHaveBeenNthCalledWith(2, [eligibleGuest.id]);

    fireEvent.click(screen.getByRole("button", { name: "Close QR" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("removes the one-time QR from the view when QR management access is lost", async () => {
    const props = {
      canManageGuestQrPasses: true,
      onLoadGuestQrPasses: vi.fn().mockResolvedValue({ available: true, passes: [] }),
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
      onLoadGuestQrPasses: vi.fn().mockResolvedValue({ available: true, passes: [failedPass] }),
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
      onLoadGuestQrPasses: vi.fn().mockResolvedValue({ available: true, passes: [failedPass] }),
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
      onLoadGuestQrPasses: vi.fn().mockResolvedValue({ available: true, passes: [failedPass] }),
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
      onLoadGuestQrPasses: vi.fn().mockResolvedValue({ available: true, passes: [queuedPass] }),
      onRetryGuestQrPass,
      onSearchRoster: vi.fn().mockResolvedValue([eligibleGuest]),
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("button", { name: "Retry delivery" });
    fireEvent.click(screen.getByRole("button", { name: "Retry delivery" }));

    await waitFor(() => expect(onRetryGuestQrPass).toHaveBeenCalledWith("gqp_queued"));
  });

  it("keeps revoke available for an active pass when the roster row is no longer issueable", async () => {
    const activePass: PrismGuestQrPassStatus = {
      id: "gqp_ineligible",
      eventId: "evt_1",
      rosterEntryId: eligibleGuest.id,
      status: "active",
      deliveryStatus: "queued",
      issuedAt: "2026-10-17T00:00:00.000Z",
      revokedAt: null,
    };
    const ineligibleGuest = { ...eligibleGuest, eligibility: "ineligible" };
    renderRegistrationTab({
      canManageGuestQrPasses: true,
      onLoadGuestQrPasses: vi.fn().mockResolvedValue({ available: true, passes: [activePass] }),
      onSearchRoster: vi.fn().mockResolvedValue([ineligibleGuest]),
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText(/QR pass active/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revoke QR pass" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry delivery" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reissue QR pass" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Issue QR pass" })).toBeNull();
  });

  it("refreshes scoped pass status after a verification rejection", async () => {
    const rejectedGuest = { ...eligibleGuest, verificationStatus: "rejected" as const };
    const onLoadGuestQrPasses = vi.fn().mockResolvedValue({ available: true, passes: [] });
    const onSearchRoster = vi.fn()
      .mockResolvedValueOnce([eligibleGuest])
      .mockResolvedValueOnce([rejectedGuest]);
    renderRegistrationTab({
      canManageGuestQrPasses: true,
      onLoadGuestQrPasses,
      onSearchRoster,
      onVerifyRoster: vi.fn().mockResolvedValue(rejectedGuest),
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("Ada Lovelace");
    fireEvent.change(screen.getByLabelText("Verification for Ada Lovelace"), { target: { value: "rejected" } });

    await waitFor(() => expect(onLoadGuestQrPasses).toHaveBeenCalledTimes(3));
    expect(onLoadGuestQrPasses).toHaveBeenNthCalledWith(2, [eligibleGuest.id]);
    expect(onLoadGuestQrPasses).toHaveBeenNthCalledWith(3, [eligibleGuest.id]);
  });

  it("hides issue controls when the server reports guest QR unavailable", async () => {
    const loadStatuses = vi.fn().mockResolvedValue({ available: false, passes: [] });
    renderRegistrationTab({
      canManageGuestQrPasses: true,
      onLoadGuestQrPasses: loadStatuses,
      onSearchRoster: vi.fn().mockResolvedValue([eligibleGuest]),
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Issue QR pass" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Issue new QR pass" })).toBeNull();
  });

  it("ignores a slower mount status response after scoped pass status has loaded", async () => {
    let resolveMountStatus!: (status: PrismGuestQrPassRosterStatus) => void;
    const delayedMountStatus = new Promise<PrismGuestQrPassRosterStatus>((resolve) => { resolveMountStatus = resolve; });
    let resolveScopedStatus!: (status: PrismGuestQrPassRosterStatus) => void;
    const delayedScopedStatus = new Promise<PrismGuestQrPassRosterStatus>((resolve) => { resolveScopedStatus = resolve; });
    const activePass: PrismGuestQrPassStatus = {
      id: "gqp_existing",
      eventId: "evt_1",
      rosterEntryId: eligibleGuest.id,
      status: "active",
      deliveryStatus: "queued",
      issuedAt: "2026-10-17T00:00:00.000Z",
      revokedAt: null,
    };
    const onLoadGuestQrPasses = vi.fn((rosterEntryIds: readonly string[]) => rosterEntryIds.length === 0
      ? delayedMountStatus
      : delayedScopedStatus);
    renderRegistrationTab({
      canManageGuestQrPasses: true,
      onLoadGuestQrPasses,
      onSearchRoster: vi.fn().mockResolvedValue([eligibleGuest]),
    });

    await waitFor(() => expect(onLoadGuestQrPasses).toHaveBeenCalledWith([]));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Issue QR pass" })).toBeNull();

    resolveScopedStatus({ available: true, passes: [activePass] });
    expect(await screen.findByText(/QR pass active/)).toBeTruthy();

    resolveMountStatus({ available: true, passes: [] });

    await waitFor(() => expect(screen.queryByRole("button", { name: "Issue QR pass" })).toBeNull());
    expect(screen.getByRole("button", { name: "Revoke QR pass" })).toBeTruthy();
  });

  it("hides issue controls while a new roster's scoped pass status is loading", async () => {
    let resolveScopedStatus!: (status: PrismGuestQrPassRosterStatus) => void;
    const delayedScopedStatus = new Promise<PrismGuestQrPassRosterStatus>((resolve) => { resolveScopedStatus = resolve; });
    const activePass: PrismGuestQrPassStatus = {
      id: "gqp_existing_during_search",
      eventId: "evt_1",
      rosterEntryId: eligibleGuest.id,
      status: "active",
      deliveryStatus: "queued",
      issuedAt: "2026-10-17T00:00:00.000Z",
      revokedAt: null,
    };
    const onLoadGuestQrPasses = vi.fn((rosterEntryIds: readonly string[]) => rosterEntryIds.length === 0
      ? Promise.resolve({ available: true, passes: [] })
      : delayedScopedStatus);
    renderRegistrationTab({
      canManageGuestQrPasses: true,
      onLoadGuestQrPasses,
      onSearchRoster: vi.fn().mockResolvedValue([eligibleGuest]),
    });

    await waitFor(() => expect(onLoadGuestQrPasses).toHaveBeenCalledWith([]));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    expect(onLoadGuestQrPasses).toHaveBeenCalledWith([eligibleGuest.id]);
    expect(screen.queryByRole("button", { name: "Issue QR pass" })).toBeNull();

    resolveScopedStatus({ available: true, passes: [activePass] });
    expect(await screen.findByText(/QR pass active/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Issue QR pass" })).toBeNull();
  });

  it("refreshes imported rows' pass status without changing a successful import result", async () => {
    const onLoadGuestQrPasses = vi.fn()
      .mockResolvedValueOnce({ available: true, passes: [] })
      .mockRejectedValueOnce(new Error("status lookup failed"));
    const onImportRoster = vi.fn().mockResolvedValue([eligibleGuest]);
    renderRegistrationTab({ canManageGuestQrPasses: true, onLoadGuestQrPasses, onImportRoster });
    fireEvent.change(screen.getByPlaceholderText(/\{"source":"xperto"/), {
      target: { value: JSON.stringify({ source: "xperto", rows: [{ sourceKey: "import-1", guestName: "Ada Lovelace", email: "ada@example.test" }] }) },
    });

    fireEvent.click(screen.getByRole("button", { name: "Import roster" }));

    expect(await screen.findByText("Imported 1 roster rows")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Unable to load guest QR pass status.");
    expect(onLoadGuestQrPasses).toHaveBeenNthCalledWith(1, []);
    expect(onLoadGuestQrPasses).toHaveBeenNthCalledWith(2, [eligibleGuest.id]);
    expect(onImportRoster).toHaveBeenCalledOnce();
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
