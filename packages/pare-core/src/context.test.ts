import { describe, expect, it } from "vitest";
import { buildPareEventContext, extractClientPreferences } from "./context.js";
import { SAMPLE_PARE_TRIGGER } from "./fixtures.js";

describe("buildPareEventContext", () => {
  it("normalizes a withdrawal into the shared PARE context", () => {
    const ctx = buildPareEventContext(SAMPLE_PARE_TRIGGER);

    expect(ctx).toMatchObject({
      triggerId: "qr_selected",
      eventId: "evt_sample",
      eventName: "Ayala Summit",
      eventDate: "2026-06-18",
      clientName: "Ana Reyes",
      withdrawnSupplier: {
        id: "sup_sonicline",
        name: "SonicLine Technicals",
        category: "Technicals",
        tier: "tier_1",
        quotedAmount: 0,
      },
    });
    expect(ctx.daysUntilEvent).toBe(42);
  });

  it("sums selected quotes and finds the withdrawn quote by request id", () => {
    const ctx = buildPareEventContext({
      ...SAMPLE_PARE_TRIGGER,
      selectedQuotes: [
        { requestId: "qr_selected", amount: 120000 },
        { requestId: "qr_catering", amount: 80000 },
        { requestId: "qr_no_amount" },
      ],
    });

    expect(ctx.spentBudget).toBe(200000);
    expect(ctx.withdrawnSupplier.quotedAmount).toBe(120000);
  });

  it("keeps the placeholder budget ceiling when the event records none", () => {
    const ctx = buildPareEventContext(SAMPLE_PARE_TRIGGER);

    expect(ctx.totalBudget).toBe(0);
    expect(ctx.remainingBudget).toBe(9999999);
  });

  it("uses a real budget ceiling when one is supplied", () => {
    const ctx = buildPareEventContext({
      ...SAMPLE_PARE_TRIGGER,
      totalBudget: 500000,
      remainingBudget: 90000,
    });

    expect(ctx.totalBudget).toBe(500000);
    expect(ctx.remainingBudget).toBe(90000);
  });

  it("reports an unknown tier and empty id when the request has no supplier row", () => {
    const ctx = buildPareEventContext({
      ...SAMPLE_PARE_TRIGGER,
      withdrawnRequest: { supplierName: "Nameless AV", category: "Technicals" },
    });

    expect(ctx.withdrawnSupplier.tier).toBe("unknown");
    expect(ctx.withdrawnSupplier.id).toBe("");
  });
});

describe("extractClientPreferences", () => {
  it("keeps non-blank strings from a requirements array", () => {
    expect(extractClientPreferences(["Halal catering", "  ", "LED wall"])).toEqual([
      "Halal catering",
      "LED wall",
    ]);
  });

  it("flattens a requirements record into labelled entries, skipping nested objects", () => {
    expect(
      extractClientPreferences({ catering: "halal", guests: 250, notes: null, nested: { a: 1 } }),
    ).toEqual(["catering: halal", "guests: 250"]);
  });

  it("returns nothing for absent or scalar requirements", () => {
    expect(extractClientPreferences(undefined)).toEqual([]);
    expect(extractClientPreferences(null)).toEqual([]);
    expect(extractClientPreferences("halal")).toEqual([]);
  });
});
