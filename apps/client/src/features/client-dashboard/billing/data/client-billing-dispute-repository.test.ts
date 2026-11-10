import { beforeEach, describe, expect, it, vi } from "vitest";

import { clientBillingDisputeRepository } from "./client-billing-dispute-repository";

describe("clientBillingDisputeRepository", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: { id: "dispute_1" } }), { status: 201, headers: { "content-type": "application/json" } }))));
  });

  it("raises a dispute on the event's billing-disputes route, with a single /api prefix", async () => {
    await clientBillingDisputeRepository.create("evt_1", { statementId: "bill_1", amount: 1000, reason: "Charged twice", severity: "standard" } as never);

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    // The route used to be built as /api/events/... on a client that already adds /api, which gave /api/api/events/... and a 404.
    expect(String(url)).toBe("http://localhost:4000/api/events/evt_1/billing-disputes");
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(init?.body))).toMatchObject({ statementId: "bill_1", amount: 1000 });
  });
});
