import { afterEach, describe, expect, it, vi } from "vitest";
import { recordRiskAssessmentUseCase } from "./risk-assessment-use-cases";

const { record } = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("../data/risk-assessment-repository", () => ({
  riskAssessmentRepository: { load: vi.fn(), record },
}));

afterEach(() => vi.clearAllMocks());

const lowering = { level: "medium" as const, summary: "Venue access confirmed", expectedRevision: 1 };

describe("recordRiskAssessmentUseCase", () => {
  it("refuses to lower the recorded level without a reason, before anything is sent", () => {
    expect(() => recordRiskAssessmentUseCase("evt_1", lowering, "critical")).toThrow("Give a reason for lowering the event risk level.");
    expect(record).not.toHaveBeenCalled();
  });

  it("sends a lowering with its reason and the revision the PMCM user last read", () => {
    recordRiskAssessmentUseCase("evt_1", { ...lowering, reason: "Venue confirmed the access route in writing" }, "critical");

    expect(record).toHaveBeenCalledWith("evt_1", expect.objectContaining({ level: "medium", expectedRevision: 1, reason: "Venue confirmed the access route in writing" }));
  });

  it("does not need a reason to raise or repeat the recorded level", () => {
    recordRiskAssessmentUseCase("evt_1", { level: "high", summary: "Escalated after site visit", expectedRevision: 0 }, "medium");

    expect(record).toHaveBeenCalledWith("evt_1", expect.objectContaining({ level: "high" }));
  });
});
