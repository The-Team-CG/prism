/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { chooseSelectOption } from "@/test-support/select-test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const addRisk = vi.fn(async (_input: Record<string, unknown>) => undefined);
const viewModel = {
  runs: [{ id: "run_1", eventId: "evt_1", phase: "planning", trigger: "manual", status: "completed", startedAt: "2026-10-01T00:00:00.000Z", ruleCount: 1, createdAt: "2026-10-01T00:00:00.000Z", checks: [{ id: "c1", eventId: "evt_1", layer: "Must-Fix", title: "Supplier contracts ready", status: "open", note: "", evaluationStatus: "not_satisfied", evidence: [], definitionStatus: "DERIVED", remediation: "Attach the final quotation." }] }],
  risks: [
    { id: "r1", title: "Generator failure", severity: "critical", likelihood: "high", impact: "high", status: "open", owner: "PMCM", mitigation: "Rent a backup" },
    { id: "r2", title: "Rule-raised risk", severity: "medium", likelihood: null, impact: null, status: "open", owner: "", mitigation: "" },
  ],
  busy: false,
  error: null,
  addRisk,
};

vi.mock("../view-models/use-compliance-review-view-model", () => ({ useComplianceReviewViewModel: () => viewModel }));

import { ComplianceReviewPanel } from "./compliance-review-panel";

afterEach(() => {
  cleanup();
  addRisk.mockClear();
});

describe("ComplianceReviewPanel readiness", () => {
  it("states the verdict, the layer counts and what blocks readiness", () => {
    render(<ComplianceReviewPanel eventId="evt_1" />);

    expect(screen.getByText("Not ready: 1 Must-Fix item to clear.")).toBeTruthy();
    expect(screen.getByRole("row", { name: /Must-Fix 1 1 0 0/ })).toBeTruthy();
    expect(screen.getByText(/Attach the final quotation./)).toBeTruthy();
  });
});

describe("ComplianceReviewPanel risks", () => {
  it("shows likelihood and impact only for risks that have them", () => {
    render(<ComplianceReviewPanel eventId="evt_1" />);

    expect(screen.getByText(/Critical · likelihood high, impact high · Open/)).toBeTruthy();
    expect(screen.getByText(/Medium · Open · Owner: Unassigned/)).toBeTruthy();
  });

  it("records a risk with its ratings and leaves severity to the API", () => {
    render(<ComplianceReviewPanel eventId="evt_1" />);

    fireEvent.change(screen.getByLabelText("Risk"), { target: { value: "Venue power cut" } });
    fireEvent.change(screen.getByLabelText("Mitigation"), { target: { value: "Generator on site" } });
    chooseSelectOption(screen.getByLabelText("Likelihood"), "High");
    chooseSelectOption(screen.getByLabelText("Impact"), "Low");
    expect(screen.getByText("Recorded as Medium severity.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Record risk" }));

    expect(addRisk).toHaveBeenCalledWith(expect.objectContaining({ title: "Venue power cut", likelihood: "high", impact: "low" }));
    expect(addRisk.mock.calls[0]?.[0]).not.toHaveProperty("severity");
  });
});
