import type { PARESupplierRecord } from "@prism/types";
import { describe, expect, it } from "vitest";
import { buildPareEventContext } from "./context.js";
import { SAMPLE_PARE_SUPPLIERS, SAMPLE_PARE_TRIGGER } from "./fixtures.js";
import { computeReliabilityScore, detectHalal, rankSupplierCandidates } from "./scoring.js";

const ctx = buildPareEventContext(SAMPLE_PARE_TRIGGER);

function supplier(
  overrides: Partial<PARESupplierRecord> & Pick<PARESupplierRecord, "id" | "name">,
): PARESupplierRecord {
  return { tier: "tier_2", categoryName: "Technicals", ...overrides };
}

describe("rankSupplierCandidates", () => {
  it("shapes a candidate from a supplier with no reviews and no quote", () => {
    expect(rankSupplierCandidates(ctx, SAMPLE_PARE_SUPPLIERS)[0]).toEqual({
      supplierId: "sup_avbackup",
      supplierName: "AV Backup Crew",
      tier: "tier_1",
      quotedAmount: 0,
      reliabilityScore: 0.5,
      halal: false,
      priorPmcmEvents: 0,
      reason: "Tier 1, reliability score 0.5, no quote on file for this event",
    });
  });

  it("excludes the withdrawn supplier by id and by name", () => {
    const candidates = rankSupplierCandidates(ctx, [
      supplier({ id: "sup_sonicline", name: "Renamed SonicLine" }),
      supplier({ id: "sup_other_id", name: "SonicLine Technicals" }),
      ...SAMPLE_PARE_SUPPLIERS,
    ]);

    expect(candidates.map((candidate) => candidate.supplierId)).toEqual(["sup_avbackup"]);
  });

  it("excludes suppliers outside the withdrawn category", () => {
    const candidates = rankSupplierCandidates(ctx, [
      supplier({ id: "sup_catering", name: "Halal Kitchen", categoryName: "Catering" }),
      ...SAMPLE_PARE_SUPPLIERS,
    ]);

    expect(candidates.map((candidate) => candidate.supplierName)).toEqual(["AV Backup Crew"]);
  });

  it("deduplicates repeated supplier names from repeated seed runs", () => {
    const candidates = rankSupplierCandidates(ctx, [
      supplier({ id: "sup_dup_a", name: "Duplicate AV" }),
      supplier({ id: "sup_dup_b", name: "Duplicate AV" }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.supplierId).toBe("sup_dup_a");
  });

  it("skips suppliers already confirmed on the event", () => {
    const candidates = rankSupplierCandidates(ctx, [
      supplier({
        id: "sup_busy",
        name: "Busy Crew",
        quoteRequests: [{ assignmentStatus: "confirmed" }],
      }),
      supplier({
        id: "sup_free",
        name: "Free Crew",
        quoteRequests: [{ assignmentStatus: "pending" }],
      }),
    ]);

    expect(candidates.map((candidate) => candidate.supplierName)).toEqual(["Free Crew"]);
  });

  it("orders tier_1 before tier_2 before tier_3, then by reliability", () => {
    const candidates = rankSupplierCandidates(ctx, [
      supplier({ id: "c", name: "Third Tier", tier: "tier_3", reviews: [{ rating: 5 }] }),
      supplier({ id: "b", name: "Second Tier Weak", tier: "tier_2", reviews: [{ rating: 2 }] }),
      supplier({ id: "d", name: "Second Tier Strong", tier: "tier_2", reviews: [{ rating: 5 }] }),
      supplier({ id: "a", name: "First Tier", tier: "tier_1", reviews: [{ rating: 3 }] }),
    ]);

    expect(candidates.map((candidate) => candidate.supplierName)).toEqual([
      "First Tier",
      "Second Tier Strong",
      "Second Tier Weak",
      "Third Tier",
    ]);
  });

  it("caps the shortlist at five candidates", () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      supplier({ id: `sup_${index}`, name: `Crew ${index}` }),
    );

    expect(rankSupplierCandidates(ctx, many)).toHaveLength(5);
  });

  it("reports the quote on file and halal certification in the shortlist reason", () => {
    const [candidate] = rankSupplierCandidates(ctx, [
      supplier({
        id: "sup_quoted",
        name: "Quoted Crew",
        reviews: [{ rating: 5 }, { rating: 4 }],
        quotes: [{ amount: 145000 }],
        serviceInclusions: "Halal-friendly craft services",
      }),
    ]);

    expect(candidate?.quotedAmount).toBe(145000);
    expect(candidate?.priorPmcmEvents).toBe(2);
    expect(candidate?.reason).toBe(
      "Tier 2, reliability score 0.88, halal-certified, 2 prior PMCM event(s), quote on file: ₱145,000",
    );
  });
});

describe("computeReliabilityScore", () => {
  it("treats no reviews as neutral", () => {
    expect(computeReliabilityScore({ id: "x", name: "X", tier: "tier_2" })).toBe(0.5);
  });

  it("normalizes a 1-5 average onto 0-1 at two decimals", () => {
    expect(computeReliabilityScore({ id: "x", name: "X", tier: "tier_2", reviews: [{ rating: 5 }] })).toBe(1);
    expect(computeReliabilityScore({ id: "x", name: "X", tier: "tier_2", reviews: [{ rating: 1 }] })).toBe(0);
    expect(
      computeReliabilityScore({
        id: "x",
        name: "X",
        tier: "tier_2",
        reviews: [{ rating: 4 }, { rating: 3 }],
      }),
    ).toBe(0.63);
  });
});

describe("detectHalal", () => {
  it("reads halal out of inclusions or performance notes", () => {
    expect(detectHalal({ id: "x", name: "X", tier: "tier_2", serviceInclusions: "HALAL menu" })).toBe(true);
    expect(detectHalal({ id: "x", name: "X", tier: "tier_2", performanceNotes: "halal certified" })).toBe(true);
    expect(detectHalal({ id: "x", name: "X", tier: "tier_2", serviceInclusions: "Lights" })).toBe(false);
  });
});
