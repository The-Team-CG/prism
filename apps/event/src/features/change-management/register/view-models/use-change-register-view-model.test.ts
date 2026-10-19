/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismAddendum, RecordEventDecisionInput, PrismEventFreezeException } from "@prism/types";
import { useChangeRegisterViewModel } from "./use-change-register-view-model";

const { load, recordDecision, requestAddendumConforme, countersignAddendumConforme } = vi.hoisted(() => ({
  load: vi.fn(), recordDecision: vi.fn(), requestAddendumConforme: vi.fn(), countersignAddendumConforme: vi.fn(),
}));
vi.mock("../data/change-register-repository", () => ({
  changeRegisterRepository: { load, recordDecision, requestAddendumConforme, countersignAddendumConforme, freeze: vi.fn(), requestException: vi.fn(), decideException: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function exception(overrides: Partial<PrismEventFreezeException>): PrismEventFreezeException {
  return {
    id: "freeze_ex_1",
    eventId: "evt_1",
    requestedChange: "Add stage lighting",
    reason: "Client request",
    status: "approved",
    requestedBy: "PMCM Admin",
    decidedBy: "PMCM Admin",
    decisionNote: null,
    requestedAt: "2026-10-10T00:00:00.000Z",
    decidedAt: "2026-10-11T00:00:00.000Z",
    consumedAt: null,
    ...overrides,
  };
}

const cancellation: RecordEventDecisionInput = {
  decision: "cancelled",
  reason: "Client confirmed cancellation",
  cancellationFeeAmount: 0,
  depositTreatment: "retain",
  supplierImpact: "release_obligations",
  impactReviewAcknowledged: true,
  idempotencyKey: "draft-1",
};

function renderRegister(frozen: boolean, exceptions: PrismEventFreezeException[], addenda: PrismAddendum[] = []) {
  load.mockResolvedValue({ addenda, exceptions });
  return renderHook(() => useChangeRegisterViewModel("evt_1", { frozen }));
}

const addendumVersion2 = {
  id: "addendum_1", eventId: "evt_1", versionNumber: 2, title: "Lighting", summary: "", status: "issued", documentId: "", documentState: "pending",
  signatureMethod: "scanned_document", comparison: { contract: [], quotes: [] }, financialDelta: 15000, issuedAt: "2026-10-19T09:00:00.000Z",
  conforme: null,
} as PrismAddendum;
const conformeAwaitingPmcm = {
  id: "acx_1", addendumId: "addendum_1", eventId: "evt_1", versionNumber: 2, documentContent: "ADDENDUM CONFORME", documentSha256: "a".repeat(64),
  status: "awaiting_pmcm", createdAt: "2026-10-19T09:00:00.000Z", completedAt: null, signatures: [],
} as NonNullable<PrismAddendum["conforme"]>;

describe("useChangeRegisterViewModel recordDecision", () => {
  it("refuses a cancellation on a frozen event without an approved exception and sends nothing", async () => {
    const { result } = renderRegister(true, [exception({})]);
    await waitFor(() => expect(result.current.status).toBe("ready"));

    let saved = true;
    await act(async () => { saved = await result.current.recordDecision(cancellation); });

    expect(saved).toBe(false);
    expect(recordDecision).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Choose an approved freeze exception before recording this decision on a frozen event.");
  });

  it("records a frozen-event decision with its approved exception and refreshes the register", async () => {
    recordDecision.mockResolvedValue({ id: "decision_1" });
    const { result } = renderRegister(true, [exception({})]);
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const loadsBefore = load.mock.calls.length;

    let saved = false;
    await act(async () => { saved = await result.current.recordDecision({ ...cancellation, freezeExceptionId: "freeze_ex_1" }); });

    expect(saved).toBe(true);
    expect(recordDecision).toHaveBeenCalledWith("evt_1", expect.objectContaining({ freezeExceptionId: "freeze_ex_1", impactReviewAcknowledged: true, idempotencyKey: "draft-1" }));
    expect(load.mock.calls.length).toBeGreaterThan(loadsBefore);
  });

  it("does not send a decision whose impact review was not confirmed", async () => {
    const { result } = renderRegister(false, []);
    await waitFor(() => expect(result.current.status).toBe("ready"));
    // A stale client can still send an unconfirmed review; the shared schema must stop it before the request.
    const unconfirmed = { ...cancellation, impactReviewAcknowledged: false } as unknown as RecordEventDecisionInput;

    let saved = true;
    await act(async () => { saved = await result.current.recordDecision(unconfirmed); });

    expect(saved).toBe(false);
    expect(recordDecision).not.toHaveBeenCalled();
    expect(result.current.error).toContain("impact review");
  });

  it("offers only approvals that have not already been used", async () => {
    const { result } = renderRegister(true, [
      exception({ id: "fresh", status: "approved" }),
      exception({ id: "spent", status: "approved", consumedAt: "2026-10-12T00:00:00.000Z" }),
      exception({ id: "waiting", status: "pending", decidedAt: null }),
      exception({ id: "declined", status: "rejected", decisionNote: "No" }),
    ]);
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.approvedExceptions.map((item) => item.id)).toEqual(["fresh"]);
  });
});

describe("useChangeRegisterViewModel addendum conforme", () => {
  it("requests the conforme for an addendum and refreshes the register", async () => {
    requestAddendumConforme.mockResolvedValue(conformeAwaitingPmcm);
    const { result } = renderRegister(true, [], [addendumVersion2]);
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const loadsBefore = load.mock.calls.length;

    let saved = false;
    await act(async () => { saved = await result.current.requestAddendumConforme("addendum_1"); });

    expect(saved).toBe(true);
    expect(requestAddendumConforme).toHaveBeenCalledWith("evt_1", "addendum_1");
    expect(load.mock.calls.length).toBeGreaterThan(loadsBefore);
  });

  it("countersigns the exact version that was requested and never sends a countersignature without one", async () => {
    countersignAddendumConforme.mockResolvedValue({ ...conformeAwaitingPmcm, status: "completed" });
    const { result } = renderRegister(true, [], [{ ...addendumVersion2, conforme: conformeAwaitingPmcm }]);
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => { await result.current.countersignAddendumConforme({ ...addendumVersion2, conforme: conformeAwaitingPmcm }); });
    expect(countersignAddendumConforme).toHaveBeenCalledWith("evt_1", "addendum_1", {
      executionId: "acx_1", versionNumber: 2, documentSha256: "a".repeat(64), consentAccepted: true,
    });

    let saved = true;
    await act(async () => { saved = await result.current.countersignAddendumConforme(addendumVersion2); });
    expect(saved).toBe(false);
    expect(result.current.error).toBe("Request the addendum conforme before countersigning it.");
    expect(countersignAddendumConforme).toHaveBeenCalledTimes(1);
  });
});
