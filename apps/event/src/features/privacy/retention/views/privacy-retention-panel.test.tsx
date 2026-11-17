/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { PrismRetentionPolicy } from "@prism/types";
import { PrivacyRetentionView } from "./privacy-retention-panel";
import type { PrivacyRetentionViewModel } from "../view-models/use-privacy-retention-view-model";

afterEach(cleanup);

const guestCheckIn = {
  category: "guest_check_in", label: "Guest check-in", enabled: false, revision: 1, periodDays: 730,
  retentionPeriod: "730 days after event archive (disabled)", deletionBehavior: "Soft redact guest name; keep attendance count.",
} as unknown as PrismRetentionPolicy;
const auditLog = { ...guestCheckIn, category: "audit", label: "Audit log" } as unknown as PrismRetentionPolicy;

function viewWith(reason: string) {
  const vm = {
    policies: [guestCheckIn, auditLog], items: [], error: null, busy: false, hasMore: false, statusFilter: "pending",
    reasonDrafts: { guest_check_in: reason }, periodDrafts: {}, notesDrafts: {},
    canEnable: (policy: PrismRetentionPolicy) => policy.category !== "audit",
    canExecute: () => false, canDismiss: () => false,
    setReasonDraft: vi.fn(), setPeriodDraft: vi.fn(), setNotesDraft: vi.fn(), setStatusFilter: vi.fn(),
    savePolicy: vi.fn(), executeItem: vi.fn(), dismissItem: vi.fn(), loadMore: vi.fn(),
  } as unknown as PrivacyRetentionViewModel;
  render(<PrivacyRetentionView vm={vm} />);
  return vm;
}

const rule = (name: string) => screen.getByText(name).closest("div")?.parentElement as HTMLElement;

describe("PrivacyRetentionView", () => {
  it("says what each rule does in one sentence, whether it is on, and offers no change for a reference-only rule", () => {
    viewWith("");
    expect(within(rule("Guest check-in")).getByText(/^2 years after event archive: soft redact guest name/)).toBeTruthy();
    expect(within(rule("Guest check-in")).getByText("Off")).toBeTruthy();
    expect(within(rule("Audit log")).getByText("Reference only")).toBeTruthy();
    expect(within(rule("Audit log")).queryByRole("button", { name: "Change" })).toBeNull();
  });

  it("changes a rule through an editor that saves the switch and period with the reason, and stays open without one", () => {
    const withoutReason = viewWith("");
    fireEvent.click(within(rule("Guest check-in")).getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("switch", { name: "Guest check-in on" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(withoutReason.savePolicy).toHaveBeenCalledWith(guestCheckIn, { enabled: true, usePeriodDraft: true });
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    cleanup();

    const withReason = viewWith("Client asked for guest names to be removed");
    fireEvent.click(within(rule("Guest check-in")).getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(withReason.savePolicy).toHaveBeenCalledWith(guestCheckIn, { enabled: false, usePeriodDraft: true });
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});
