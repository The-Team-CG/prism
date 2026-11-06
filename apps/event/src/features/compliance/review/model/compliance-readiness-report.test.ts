import { describe, expect, it } from "vitest";
import type { PrismComplianceCheck, PrismComplianceRisk, PrismComplianceRun } from "@prism/types";
import { complianceReadinessReport } from "./compliance-readiness-report";

const check = (overrides: Partial<PrismComplianceCheck>): PrismComplianceCheck => ({
  id: "c1",
  eventId: "evt_1",
  layer: "Must-Fix",
  title: "Supplier contracts ready",
  status: "open",
  note: "",
  evaluationStatus: "not_satisfied",
  evidence: [],
  definitionStatus: "DERIVED",
  remediation: "Attach the final quotation.",
  ...overrides,
});

const run = (checks: PrismComplianceCheck[], overrides: Partial<PrismComplianceRun> = {}): PrismComplianceRun => ({
  id: "run_1",
  eventId: "evt_1",
  phase: "planning",
  trigger: "manual",
  status: "completed",
  startedAt: "2026-10-01T00:00:00.000Z",
  ruleCount: checks.length,
  createdAt: "2026-10-01T00:00:00.000Z",
  checks,
  ...overrides,
});

const risk = (overrides: Partial<PrismComplianceRisk>): PrismComplianceRisk => ({
  id: "r1",
  eventId: "evt_1",
  phase: "closure",
  title: "Generator failure",
  severity: "high",
  owner: "PMCM",
  mitigation: "",
  status: "open",
  source: "pmcm",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  history: [],
  ...overrides,
});

describe("complianceReadinessReport", () => {
  it("asks for a first run when there is none", () => {
    expect(complianceReadinessReport([], []).verdict).toBe("no_run");
  });

  it("blocks readiness on an outstanding Must-Fix and lists what to do about it", () => {
    const report = complianceReadinessReport([run([check({}), check({ id: "c2", layer: "Advisory", title: "Photos" })])], []);

    expect(report.verdict).toBe("not_ready");
    expect(report.headline).toBe("Not ready: 1 Must-Fix item to clear.");
    expect(report.blockers).toEqual([{ id: "c1", title: "Supplier contracts ready", remediation: "Attach the final quotation." }]);
  });

  it("counts resolved, overridden, satisfied and not applicable checks as handled", () => {
    const report = complianceReadinessReport([run([
      check({ id: "a", status: "resolved" }),
      check({ id: "b", status: "overridden" }),
      check({ id: "c", evaluationStatus: "satisfied" }),
      check({ id: "d", evaluationStatus: "not_applicable" }),
    ])], []);

    expect(report.verdict).toBe("ready");
    expect(report.layers[0]).toMatchObject({ layer: "Must-Fix", total: 4, outstanding: 0, resolved: 1, overridden: 1 });
  });

  it("is ready with follow-ups for outstanding lower layers or open serious risks, not for low ones", () => {
    const outstandingShould = run([check({ layer: "Should-Fix" })]);
    expect(complianceReadinessReport([outstandingShould], []).headline).toBe("Ready, with 1 follow-up to watch.");
    expect(complianceReadinessReport([run([])], [risk({ severity: "critical" })]).verdict).toBe("ready_with_follow_ups");
    expect(complianceReadinessReport([run([])], [risk({ severity: "low" }), risk({ id: "r2", status: "closed" })]).verdict).toBe("ready");
  });

  it("reads the latest completed run rather than one still running", () => {
    const running = run([check({})], { id: "run_2", status: "running" });
    const completed = run([], { id: "run_1" });

    expect(complianceReadinessReport([running, completed], []).verdict).toBe("ready");
  });
});
