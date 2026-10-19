/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismAddendum, PrismAddendumConformeExecution, PrismEventFreezeException } from "@prism/types";
import { ChangeRegisterPanel } from "./change-register-panel";

const { load, freeze, requestException, decideException, issueAddendumConforme, countersignAddendumConforme } = vi.hoisted(() => ({
  issueAddendumConforme: vi.fn(),
  countersignAddendumConforme: vi.fn(),
  load: vi.fn(),
  freeze: vi.fn(),
  requestException: vi.fn(),
  decideException: vi.fn(),
}));
vi.mock("../data/change-register-repository", () => ({
  changeRegisterRepository: { load, freeze, requestException, decideException, issueAddendumConforme, countersignAddendumConforme },
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
    expect(confirm.hasAttribute("disabled")).toBe(true);

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
    expect(button.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Reason for freezing"), { target: { value: "Brief signed off" } });
    fireEvent.submit(form);

    await waitFor(() => expect(freeze).toHaveBeenCalledWith("evt_1", { reason: "Brief signed off", deadline: undefined }));
  });

  it("requests a freeze exception with both the change and its reason on a frozen event", async () => {
    load.mockResolvedValue({ addenda: [], exceptions: [] });
    requestException.mockResolvedValue(exception());
    render(<ChangeRegisterPanel eventId="evt_1" frozen />);

    const form = await screen.findByRole("form", { name: "Request freeze exception" });
    fireEvent.change(within(form).getByLabelText("Requested change"), { target: { value: "Add stage lighting" } });
    fireEvent.change(within(form).getByLabelText("Reason"), { target: { value: "Client asked after freeze" } });
    fireEvent.submit(form);

    await waitFor(() => expect(requestException).toHaveBeenCalledWith("evt_1", { requestedChange: "Add stage lighting", reason: "Client asked after freeze" }));
  });
});

function addendum(overrides: Partial<PrismAddendum> = {}): PrismAddendum {
  return {
    id: "addendum_1", eventId: "evt_1", versionNumber: 1, title: "Stage lighting", summary: "Adds lighting rig", status: "issued",
    documentId: "doc_1", documentState: "available", signatureMethod: "scanned_document", comparison: { contract: [], quotes: [] },
    financialDelta: 5000, issuedAt: "2026-10-18T00:00:00.000Z", executedConformeExecutionId: null, executedAt: null, ...overrides,
  };
}

function conforme(overrides: Partial<PrismAddendumConformeExecution> = {}): PrismAddendumConformeExecution {
  return {
    id: "acx_1", addendumId: "addendum_1", eventId: "evt_1", addendumVersionNumber: 1, documentVersion: 1,
    documentContent: "Addendum 1: add stage lighting rig for PHP 5,000.", documentSha256: "a".repeat(64), status: "awaiting_client",
    issuedBy: "PMCM Admin", createdAt: "2026-10-19T00:00:00.000Z", completedAt: null, signatures: [], ...overrides,
  };
}

describe("ChangeRegisterPanel addendum conformes", () => {
  it("issues the first conforme version with the typed document text", async () => {
    load.mockResolvedValue({ addenda: [addendum()], exceptions: [], conformes: [] });
    issueAddendumConforme.mockResolvedValue(conforme());
    render(<ChangeRegisterPanel eventId="evt_1" frozen={false} />);

    const form = await screen.findByRole("form", { name: "Issue addendum conforme for version 1" });
    fireEvent.change(within(form).getByLabelText("Addendum conforme text (version 1)"), { target: { value: "Addendum 1: add stage lighting rig for PHP 5,000." } });
    fireEvent.submit(form);

    await waitFor(() => expect(issueAddendumConforme).toHaveBeenCalledWith("evt_1", "addendum_1", { documentVersion: 1, documentContent: "Addendum 1: add stage lighting rig for PHP 5,000." }));
  });

  it("offers countersignature only after the client acknowledged, binding to the displayed version and hash", async () => {
    const acknowledged = conforme({ status: "awaiting_pmcm", signatures: [{ id: "acs_1", actorRole: "client", actorName: "Ana Reyes", consentTextVersion: "v1", signedAt: "2026-10-19T01:00:00.000Z" }] });
    load.mockResolvedValue({ addenda: [addendum()], exceptions: [], conformes: [acknowledged] });
    countersignAddendumConforme.mockResolvedValue({ ...acknowledged, status: "completed" });
    render(<ChangeRegisterPanel eventId="evt_1" frozen={false} />);

    fireEvent.click(await screen.findByRole("button", { name: "Countersign version 1" }));
    // A signed version cannot be replaced, so no issue form is offered once the client has acknowledged.
    expect(screen.queryByRole("form", { name: /Issue addendum conforme/ })).toBeNull();

    await waitFor(() => expect(countersignAddendumConforme).toHaveBeenCalledWith("evt_1", "addendum_1", {
      executionId: "acx_1", documentVersion: 1, documentSha256: "a".repeat(64), consentAccepted: true,
    }));
  });

  it("shows an executed addendum without issue or countersign actions", async () => {
    load.mockResolvedValue({
      addenda: [addendum({ status: "executed", signatureMethod: "in_app_conforme", executedConformeExecutionId: "acx_1" })],
      exceptions: [],
      conformes: [conforme({ status: "completed" })],
    });
    render(<ChangeRegisterPanel eventId="evt_1" frozen={false} />);

    expect(await screen.findByText("Executed: client acknowledged and PMCM countersigned")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Countersign/ })).toBeNull();
    expect(screen.queryByRole("form", { name: /Issue addendum conforme/ })).toBeNull();
  });
});
