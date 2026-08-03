import type { PARECandidate, PAREContext } from "@prism/types";
import { describe, expect, it } from "vitest";
import { analyzePareBudget, noCandidateBudgetAnalysis } from "./budget.js";
import { buildPareEventContext } from "./context.js";
import { draftPareMessages } from "./drafts.js";
import { SAMPLE_PARE_TRIGGER } from "./fixtures.js";
import { assessPareRisk } from "./risk.js";

function candidate(overrides: Partial<PARECandidate> = {}): PARECandidate {
  return {
    supplierId: "sup_avbackup",
    supplierName: "AV Backup Crew",
    tier: "tier_1",
    quotedAmount: 0,
    reliabilityScore: 0.8,
    halal: false,
    priorPmcmEvents: 3,
    reason: "Tier 1",
    ...overrides,
  };
}

function context(overrides: Partial<PAREContext> = {}): PAREContext {
  return { ...buildPareEventContext(SAMPLE_PARE_TRIGGER), ...overrides };
}

describe("analyzePareBudget", () => {
  it("asks for a quote when the replacement has none on file", () => {
    const analysis = analyzePareBudget(context(), candidate({ quotedAmount: 0 }));

    expect(analysis.feasible).toBe(true);
    expect(analysis.summary).toContain("has no quote on file");
    expect(analysis.costDeltaLabel).toBe("same cost as withdrawn supplier");
  });

  it("reports an overage against the withdrawn quote", () => {
    const ctx = context({
      withdrawnSupplier: { ...context().withdrawnSupplier, quotedAmount: 100000 },
      remainingBudget: 50000,
    });
    const analysis = analyzePareBudget(ctx, candidate({ quotedAmount: 130000 }));

    expect(analysis.costDelta).toBe(30000);
    expect(analysis.costDeltaLabel).toBe("₱30,000 over withdrawn quote");
    expect(analysis.feasible).toBe(true);
    expect(analysis.summary).toContain("is within budget at ₱130,000");
  });

  it("escalates when the replacement exceeds the remaining budget", () => {
    const ctx = context({
      withdrawnSupplier: { ...context().withdrawnSupplier, quotedAmount: 100000 },
      remainingBudget: 10000,
    });
    const analysis = analyzePareBudget(ctx, candidate({ quotedAmount: 130000 }));

    expect(analysis.feasible).toBe(false);
    expect(analysis.summary).toContain("exceeds available budget");
    expect(analysis.summary).toContain("Escalate to Ms. Mys.");
  });

  it("labels a cheaper replacement as savings", () => {
    const ctx = context({
      withdrawnSupplier: { ...context().withdrawnSupplier, quotedAmount: 100000 },
    });
    const analysis = analyzePareBudget(ctx, candidate({ quotedAmount: 80000 }));

    expect(analysis.costDelta).toBe(-20000);
    expect(analysis.costDeltaLabel).toBe("₱20,000 under withdrawn quote (savings)");
  });

  it("returns an infeasible verdict when the category has no replacement", () => {
    const analysis = noCandidateBudgetAnalysis();

    expect(analysis.feasible).toBe(false);
    expect(analysis.selectedCandidate.supplierName).toBe("No candidate found");
    expect(analysis.costDeltaLabel).toBe("N/A");
  });
});

describe("assessPareRisk", () => {
  it("stays LOW for a comfortable timeline and a proven tier_1 replacement", () => {
    const risk = assessPareRisk(context({ candidates: [candidate({ quotedAmount: 90000 })] }));

    expect(risk.level).toBe("LOW");
    expect(risk.recommendation).toContain("Proceed with replacement");
    expect(risk.factors[0]).toBe("Adequate timeline: event is in 42 days");
  });

  it("goes HIGH when the event is days away and nothing was found", () => {
    const risk = assessPareRisk(context({ daysUntilEvent: 3, candidates: [] }));

    expect(risk.level).toBe("HIGH");
    expect(risk.factors).toContain("Critical timeline: event is in 3 day(s)");
    expect(risk.factors).toContain("No replacement candidates found — high operational risk");
    expect(risk.recommendation).toContain("Escalate to Ms. Mys immediately");
  });

  it("flags an unproven tier_3 first booking with no quote", () => {
    const risk = assessPareRisk(
      context({
        daysUntilEvent: 14,
        candidates: [
          candidate({ tier: "tier_3", quotedAmount: 0, priorPmcmEvents: 0, reliabilityScore: 0.5 }),
        ],
      }),
    );

    expect(risk.level).toBe("HIGH");
    expect(risk.factors).toContain("No quote on file — pricing unconfirmed");
    expect(risk.factors).toContain("No prior events with PMCM — first booking");
    expect(risk.factors).toContain("Low reliability score (0.5)");
  });

  it("flags an unmet halal requirement, which alone is not enough to leave LOW", () => {
    const withHalal = assessPareRisk(
      context({
        clientPreferences: ["catering: Halal required"],
        candidates: [candidate({ halal: false, quotedAmount: 90000 })],
      }),
    );

    expect(withHalal.factors).toContain("Client requires halal — replacement is NOT halal-certified");
    expect(withHalal.level).toBe("LOW");
  });

  it("tips to MEDIUM when an unmet halal requirement meets a short timeline", () => {
    const risk = assessPareRisk(
      context({
        daysUntilEvent: 14,
        clientPreferences: ["catering: Halal required"],
        candidates: [candidate({ halal: false, quotedAmount: 90000 })],
      }),
    );

    expect(risk.level).toBe("MEDIUM");
    expect(risk.recommendation).toContain("Proceed with caution");
  });

  it("ignores the halal check when the client never asked for it", () => {
    const risk = assessPareRisk(
      context({ clientPreferences: [], candidates: [candidate({ halal: false, quotedAmount: 90000 })] }),
    );

    expect(risk.factors).not.toContain("Client requires halal — replacement is NOT halal-certified");
  });
});

describe("draftPareMessages", () => {
  it("names the selected replacement in both messages", () => {
    const ctx = context({
      budgetAnalysis: analyzePareBudget(context(), candidate({ supplierName: "AV Backup Crew" })),
    });
    const drafts = draftPareMessages(ctx);

    expect(drafts.supplierNotification).toContain("Dear AV Backup Crew Team,");
    expect(drafts.supplierNotification).toContain("Event: Ayala Summit");
    expect(drafts.supplierNotification).toContain("Category Required: Technicals");
    expect(drafts.clientReassurance).toContain("Dear Ana Reyes,");
    expect(drafts.clientReassurance).toContain("a qualified Tier 1 replacement — AV Backup Crew");
  });

  it("falls back to neutral wording when no candidate was selected", () => {
    const drafts = draftPareMessages(context());

    expect(drafts.supplierNotification).toContain("Dear a qualified replacement supplier Team,");
    expect(drafts.clientReassurance).toContain("a qualified Tier 2 replacement");
  });

  it("never claims a message was sent", () => {
    const drafts = draftPareMessages(context());

    expect(drafts.supplierNotification).toContain("Please confirm your availability");
    expect(drafts.clientReassurance).toContain("Your event plans remain on track");
  });
});
