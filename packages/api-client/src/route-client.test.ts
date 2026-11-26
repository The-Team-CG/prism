import { afterEach, describe, expect, it, vi } from "vitest";
import { paymentReceiptRoutes } from "@prism/types";
import { PrismContractError, bindRoutes, createPmcmClient } from "./route-client";

afterEach(() => vi.unstubAllGlobals());

const receipt = {
  id: "prc 1", amount: 5000, receivedDate: "2026-11-20", method: "GCash", referenceNumber: "GC-1", payerName: "Ana",
  eventId: "evt_1", notes: "", status: "verified", source: "pmcm", intendedMilestoneId: null, intendedMilestoneLabel: null,
  legacy: false, evidenceObjectId: null, evidence: null, verifiedAt: "2026-11-21T00:00:00.000Z", verifiedBy: "Finance",
  verificationNotes: "Bank line 12", rejectionReason: null, reversalReason: null, possibleDuplicateOfId: null,
  applied: 0, refunded: 0, unapplied: 5000, allocations: [], refunds: [], recordedBy: "Finance", recordedAt: "2026-11-20T00:00:00.000Z",
};

function stubFetch(body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("route clients", () => {
  it("calls a route from its contract: path parameters, method, body and bearer token", async () => {
    const fetchMock = stubFetch(receipt);
    const pmcm = createPmcmClient({ baseUrl: "http://api.test/api", getAuthToken: () => "token" });

    await expect(pmcm.paymentReceipts.verify({ params: { receiptId: "prc 1" }, body: { notes: "Bank line 12" } })).resolves.toMatchObject({ id: "prc 1", status: "verified" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/api/payment-receipts/prc%201/verify");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ notes: "Bank line 12" });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token");
  });

  it("sends a read's query and no method or body", async () => {
    const fetchMock = stubFetch([receipt]);
    const pmcm = createPmcmClient({ baseUrl: "http://api.test/api" });

    await pmcm.paymentReceipts.list({ query: { status: "recorded", unapplied: true } });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/api/payment-receipts?status=recorded&unapplied=true");
    expect(init.method).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it("rejects an answer that does not match the route's response contract, naming the route", async () => {
    stubFetch({ ...receipt, unapplied: "5000", allocations: undefined });
    const pmcm = createPmcmClient({ baseUrl: "http://api.test/api" });

    const failure = await pmcm.paymentReceipts.reject({ params: { receiptId: "prc_1" }, body: { reason: "No match" } }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PrismContractError);
    expect((failure as PrismContractError).route).toBe("POST /payment-receipts/:receiptId/reject");
    expect((failure as PrismContractError).issues.map((issue) => issue.path.join("."))).toEqual(["unapplied", "allocations"]);
  });

  it("gives a role only the routes its contract lists", () => {
    const guest = bindRoutes("guest", paymentReceiptRoutes, {});
    expect(Object.keys(guest)).toEqual([]);
    // Calling a PMCM finance route from another role's client does not compile.
    // @ts-expect-error payment receipts are PMCM-only
    void guest.verify;
    // A missing path parameter does not compile either.
    // @ts-expect-error verify needs params.receiptId
    void createPmcmClient().paymentReceipts.verify({ body: { notes: "x" } }).catch(() => undefined);
  });
});
