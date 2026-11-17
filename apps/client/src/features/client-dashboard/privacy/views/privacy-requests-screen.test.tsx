/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { PrismOwnPrivacyRequest } from "@prism/types";
import { PrivacyRequestsScreen, type PrivacyDraft } from "@prism/ui/privacy-requests";

afterEach(cleanup);

const request = (overrides: Partial<PrismOwnPrivacyRequest>): PrismOwnPrivacyRequest => ({
  id: "priv_1", type: "access", status: "submitted", submittedAt: "2026-11-10T02:00:00.000Z", dueAt: "2026-12-10T02:00:00.000Z",
  completedAt: null, outcomeMessage: "Received. PMCM verifies your identity before acting on this request.", cancellable: true, ...overrides,
});

function screenWith(requests: PrismOwnPrivacyRequest[], draft: Partial<PrivacyDraft> = {}, noticeVersion = "v3") {
  const props = {
    draft: { type: "access" as const, details: "", busy: false, error: null, setType: vi.fn(), setDetails: vi.fn(), submit: vi.fn(), ...draft },
    cancel: { busyId: null, error: null, run: vi.fn() },
  };
  render(
    <PrivacyRequestsScreen requests={requests} loading={false} loadError={null} today="2026-11-17" draft={props.draft} cancel={props.cancel}
      notice={{ version: noticeVersion, acknowledgedAt: "2026-10-27T02:00:00.000Z", href: "/privacy" }} />,
  );
  return props;
}

describe("PrivacyRequestsScreen", () => {
  it("lists open requests with their step and due date first, and finished ones under Earlier", () => {
    screenWith([
      request({ id: "done", type: "correction", status: "executed", completedAt: "2026-10-18T02:00:00.000Z", cancellable: false, outcomeMessage: "Completed." }),
      request({}),
      request({ id: "late", type: "export", status: "approved", dueAt: "2026-11-14T02:00:00.000Z", cancellable: false }),
    ]);
    const list = within(screen.getByRole("region", { name: "Your requests" }));
    const items = list.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(items[0]).toContain("Copy of my data");
    expect(items[0]).toContain("Due Dec 10, 2026 · in 23 days");
    expect(list.getByRole("img", { name: "Step 2 of 4: Identity check" })).toBeTruthy();
    expect(items[1]).toContain("Due Nov 14, 2026 · 3 days late");
    expect(list.getByRole("img", { name: "Step 3 of 4: In progress" })).toBeTruthy();
    expect(list.getByText("Earlier")).toBeTruthy();
    expect(items[2]).toContain("Correction");
    expect(items[2]).toContain("done Oct 18, 2026");
    expect(screen.getByText(/Privacy notice v3 · you accepted it Oct 27, 2026/)).toBeTruthy();
    cleanup();
    screenWith([], {}, "2026-10-25");
    expect(screen.getByText(/Privacy notice of Oct 25, 2026 · you accepted it/)).toBeTruthy();
  });

  it("opens on the new request form alone when there are no requests", () => {
    screenWith([]);
    expect(screen.queryByRole("region", { name: "Your requests" })).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "What do you want PMCM to do?" })).toBeTruthy();
  });

  it("asks before withdrawing, and only offers it while PMCM has not started", () => {
    const { cancel } = screenWith([request({}), request({ id: "started", status: "approved", cancellable: false })]);
    const buttons = screen.getAllByRole("button", { name: "Cancel request" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(cancel.run).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(cancel.run).toHaveBeenCalledWith("priv_1");
  });

  it("explains what deleting keeps and asks to confirm before sending a deletion", () => {
    const { draft } = screenWith([], { type: "deletion" });
    expect(screen.getByRole("radio", { name: /Delete my data/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(draft.submit).not.toHaveBeenCalled();
    const confirm = within(screen.getByRole("group", { name: "Confirm deletion" }));
    expect(confirm.getByText(/Billing records, signed agreements/)).toBeTruthy();
    fireEvent.click(confirm.getByRole("button", { name: "Ask PMCM to delete my data" }));
    expect(draft.submit).toHaveBeenCalledTimes(1);
  });

  it("asks what is wrong for a correction and holds it until that is written", () => {
    const { draft } = screenWith([], { type: "correction" });
    expect((screen.getByLabelText("What is wrong, and what should it say?") as HTMLTextAreaElement).required).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(draft.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: /Get a copy of my data/ }));
    expect(draft.setType).toHaveBeenCalledWith("access");
  });

  it("sends any other request straight away", () => {
    const { draft } = screenWith([], { type: "export" });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(draft.submit).toHaveBeenCalledTimes(1);
  });
});
