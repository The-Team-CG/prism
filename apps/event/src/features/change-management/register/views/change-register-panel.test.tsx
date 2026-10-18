/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismEventFreezeException } from "@prism/types";
import { ChangeRegisterPanel } from "./change-register-panel";

const { load, freeze, requestException, decideException } = vi.hoisted(() => ({
  load: vi.fn(),
  freeze: vi.fn(),
  requestException: vi.fn(),
  decideException: vi.fn(),
}));
vi.mock("../data/change-register-repository", () => ({
  changeRegisterRepository: { load, freeze, requestException, decideException },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function exception(overrides: Partial<PrismEventFreezeException> = {}): PrismEventFreezeException {
  return {
    id: "freeze_ex_1",
    eventId: "evt_1",
    requestedChange: "Add stage lighting",
    reason: "Client asked after freeze",
    status: "pending",
    requestedBy: "PMCM Admin",
    decidedBy: null,
    decisionNote: null,
    requestedAt: "2026-10-10T00:00:00.000Z",
    decidedAt: null,
    ...overrides,
  };
}

describe("ChangeRegisterPanel", () => {
  it("requires a rejection reason before a pending freeze exception can be rejected", async () => {
    load.mockResolvedValue({ addenda: [], exceptions: [exception()] });
    decideException.mockResolvedValue(exception({ status: "rejected" }));
    render(<ChangeRegisterPanel eventId="evt_1" frozen />);

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const confirm = screen.getByRole("button", { name: "Confirm rejection" });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Reason for rejecting"), { target: { value: "Venue cannot take the rig" } });
    fireEvent.click(confirm);

    await waitFor(() => expect(decideException).toHaveBeenCalledWith("evt_1", "freeze_ex_1", { decision: "reject", decisionNote: "Venue cannot take the rig" }));
  });

  it("approves a pending exception on a frozen event without offering to freeze again", async () => {
    load.mockResolvedValue({ addenda: [], exceptions: [exception()] });
    decideException.mockResolvedValue(exception({ status: "approved" }));
    render(<ChangeRegisterPanel eventId="evt_1" frozen />);

    expect(screen.queryByRole("form", { name: "Freeze scope" })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));

    await waitFor(() => expect(decideException).toHaveBeenCalledWith("evt_1", "freeze_ex_1", { decision: "approve" }));
  });

  it("freezes an open event with a reason and offers no exception request until the freeze exists", async () => {
    load.mockResolvedValue({ addenda: [], exceptions: [] });
    freeze.mockResolvedValue({ eventId: "evt_1", freezeStatus: "frozen" });
    render(<ChangeRegisterPanel eventId="evt_1" frozen={false} />);

    expect(screen.queryByRole("form", { name: "Request freeze exception" })).toBeNull();
    const form = await screen.findByRole("form", { name: "Freeze scope" });
    const button = screen.getByRole("button", { name: "Freeze scope" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Reason for freezing"), { target: { value: "Brief signed off" } });
    fireEvent.submit(form);

    await waitFor(() => expect(freeze).toHaveBeenCalledWith("evt_1", { reason: "Brief signed off", deadline: undefined }));
  });

  it("requests a freeze exception with both the change and its reason on a frozen event", async () => {
    load.mockResolvedValue({ addenda: [], exceptions: [] });
    requestException.mockResolvedValue(exception());
    render(<ChangeRegisterPanel eventId="evt_1" frozen />);

    const form = await screen.findByRole("form", { name: "Request freeze exception" });
    fireEvent.change(screen.getByLabelText("Requested change"), { target: { value: "Add stage lighting" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Client asked after freeze" } });
    fireEvent.submit(form);

    await waitFor(() => expect(requestException).toHaveBeenCalledWith("evt_1", { requestedChange: "Add stage lighting", reason: "Client asked after freeze" }));
  });
});
