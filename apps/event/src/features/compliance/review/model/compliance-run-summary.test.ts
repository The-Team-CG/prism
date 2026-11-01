import { describe, expect, it } from "vitest";
import type { PrismComplianceCheck, PrismComplianceRun } from "@prism/types";
import { complianceRunSummary } from "./compliance-run-summary";

const check = (status: string) => ({ id: status + Math.random(), status }) as PrismComplianceCheck;
const run = (overrides: Partial<PrismComplianceRun>): PrismComplianceRun => ({
  id: "run", eventId: "evt", phase: "planning", trigger: "manual", status: "completed",
  startedAt: "2026-10-28T12:00:00.000Z", completedAt: "2026-10-28T12:00:49.000Z", ruleCount: 3, createdAt: "", ...overrides,
});

describe("complianceRunSummary", () => {
  it("summarises the latest run instead of listing its checks again", () => {
    const latest = run({ checks: [check("open"), check("resolved"), check("open")] });
    expect(complianceRunSummary([latest, run({ id: "older" })])).toBe("Last run Oct 28, 2026, 8:00 PM (run by PMCM) · 3 checks · 2 open · 2 runs so far");
  });

  it("explains how to start when nothing has run", () => {
    expect(complianceRunSummary([])).toMatch(/No compliance runs yet/);
  });
});
