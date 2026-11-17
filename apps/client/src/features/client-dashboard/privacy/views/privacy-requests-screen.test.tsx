/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { PrismOwnPrivacyRequest } from "@prism/types";
import { PrivacyRequestsScreen, type PrivacyDraft } from "@prism/ui/privacy-requests";

afterEach(cleanup);

const request = (overrides: Partial<PrismOwnPrivacyRequest>): PrismOwnPrivacyRequest => ({
  id: "priv_1", type: "access", status: "submitted", submittedAt: "2026-11-10T02:00:00.000Z", dueAt: "2026-12-10T02:00:00.000Z",
  completedAt: null, outcomeMessage: "Received. PMCM verifies your identity before acting on this request.", cancellable: true, identityConfirmedAt: null, ...overrides,
});

function screenWith(requests: PrismOwnPrivacyRequest[], draft: Partial<PrivacyDraft> = {}, noticeVersion = "v3") {
  const props = {
    draft: { type: "access" as const, details: "", password: "", busy: false, error: null, setType: vi.fn(), setDetails: vi.fn(), setPassword: vi.fn(), submit: vi.fn(async () => true), ...draft },
    cancel: { busyId: null, error: null, run: vi.fn() },
  };
  render(
    <PrivacyRequestsScreen requests={requests} loading={false} loadError={null} today="2026-11-17" draft={props.draft} cancel={props.cancel}
      notice={{ version: noticeVersion, acknowledgedAt: "2026-10-27T02:00:00.000Z", href: "/privacy" }} />,
  );
  return props;
}

const dialog = () => within(screen.getByRole("dialog"));
const openNewRequest = () => fireEvent.click(screen.getByRole("button", { name: "New request" }));

describe("PrivacyRequestsScreen", () => {
  it("lists open requests first with who they wait on and a due date that is calm until the last week", () => {
    screenWith([
      request({ id: "done", type: "correction", status: "executed", completedAt: "2026-10-18T02:00:00.000Z", cancellable: false, outcomeMessage: "Completed." }),
      request({}),
      request({ id: "confirmed", type: "deletion", identityConfirmedAt: "2026-11-10T02:00:00.000Z" }),
      request({ id: "late", type: "export", status: "approved", dueAt: "2026-11-14T02:00:00.000Z", cancellable: false }),
    ]);
    const rows = within(screen.getByRole("region", { name: "Your requests" })).getAllByRole("button", { name: /sent/ }).map((row) => row.textContent ?? "");
    expect(rows[0]).toContain("Copy of my data");
    expect(rows[0]).toContain("Identity check");
    expect(rows[0]).toContain("Due Dec 10, 2026 · in 23 days");
    expect(rows[1]).toContain("With PMCM");
    expect(rows[2]).toContain("In progress");
    expect(rows[2]).toContain("3 days late");
    expect(rows[3]).toContain("done Oct 18, 2026");
    expect(rows[3]).toContain("Done");
    expect(screen.getAllByText(/Due Dec 10, 2026/)[0].className).toContain("bg-muted");
    expect(screen.getAllByText(/3 days late/)[0].className).toContain("text-danger");
    expect(screen.getByText(/Privacy notice v3 · you accepted it Oct 27, 2026/)).toBeTruthy();
  });

  it("names a date-versioned notice by its date", () => {
    screenWith([], {}, "2026-10-25");
    expect(screen.getByText(/Privacy notice of Oct 25, 2026 · you accepted it/)).toBeTruthy();
    expect(screen.getByText(/No requests yet/)).toBeTruthy();
  });

  it("opens a request's details with its full track, and asks before withdrawing it", () => {
    const { cancel } = screenWith([request({})]);
    fireEvent.click(screen.getByRole("button", { name: /Copy of my data/ }));
    expect(dialog().getByRole("img", { name: "Step 2 of 4: Identity check" })).toBeTruthy();
    fireEvent.click(dialog().getByRole("button", { name: "Cancel request" }));
    fireEvent.click(dialog().getByRole("button", { name: "Keep it" }));
    expect(cancel.run).not.toHaveBeenCalled();
    fireEvent.click(dialog().getByRole("button", { name: "Cancel request" }));
    fireEvent.click(dialog().getByRole("button", { name: "Withdraw" }));
    expect(cancel.run).toHaveBeenCalledWith("priv_1");
  });

  it("offers no withdraw once PMCM has started", () => {
    screenWith([request({ status: "approved", cancellable: false })]);
    fireEvent.click(screen.getByRole("button", { name: /Copy of my data/ }));
    expect(dialog().queryByRole("button", { name: "Cancel request" })).toBeNull();
  });

  it("sends a request in three steps: what, optional details it can skip, then the password", async () => {
    const { draft } = screenWith([], { type: "export" });
    openNewRequest();
    expect(dialog().getByRole("radio", { name: /Export my data/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(dialog().getByRole("button", { name: "Next" }));
    fireEvent.click(dialog().getByRole("button", { name: "Skip" }));
    const send = dialog().getByRole("button", { name: "Send request" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(dialog().getByLabelText("Your password"), { target: { value: "right-password" } });
    expect(draft.setPassword).toHaveBeenCalledWith("right-password");
    expect(draft.submit).not.toHaveBeenCalled();
  });

  it("closes after sending and says it was sent", async () => {
    const { draft } = screenWith([], { type: "access", password: "right-password" });
    openNewRequest();
    fireEvent.click(dialog().getByRole("button", { name: "Next" }));
    fireEvent.click(dialog().getByRole("button", { name: "Skip" }));
    fireEvent.click(dialog().getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(draft.submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toMatch(/^Sent\./);
  });

  it("holds a correction until it says what is wrong", () => {
    screenWith([], { type: "correction" });
    openNewRequest();
    fireEvent.click(dialog().getByRole("button", { name: "Next" }));
    expect(dialog().getByLabelText("What is wrong, and what should it say?")).toBeTruthy();
    expect((dialog().getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("puts the deletion warning with the password, and names the button for what it does", () => {
    const { draft } = screenWith([], { type: "deletion", password: "right-password" });
    openNewRequest();
    fireEvent.click(dialog().getByRole("button", { name: "Next" }));
    fireEvent.click(dialog().getByRole("button", { name: "Skip" }));
    expect(dialog().getByText(/Billing records, signed agreements/)).toBeTruthy();
    fireEvent.click(dialog().getByRole("button", { name: "Delete my data" }));
    expect(draft.submit).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog open with the reason when sending fails", async () => {
    const { draft } = screenWith([], { type: "access", password: "wrong", error: "That password is not right.", submit: vi.fn(async () => false) });
    openNewRequest();
    fireEvent.click(dialog().getByRole("button", { name: "Next" }));
    fireEvent.click(dialog().getByRole("button", { name: "Skip" }));
    fireEvent.click(dialog().getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(draft.submit).toHaveBeenCalled());
    expect(dialog().getByRole("alert").textContent).toBe("That password is not right.");
  });
});
