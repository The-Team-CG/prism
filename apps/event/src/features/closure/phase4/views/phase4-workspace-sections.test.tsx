/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismComplianceCheck } from "@prism/types";
import { Phase4SectionBoundary } from "./phase4-section-boundary";
import { Phase4ComplianceSection, Phase4InsightsSection } from "./phase4-workspace-sections";

afterEach(cleanup);

describe("Phase4InsightsSection coordinator staffing", () => {
  it("shows coordinator outcome counts in the generated insights card", () => {
    render(
      <Phase4InsightsSection
        busy={false}
        onGenerate={vi.fn()}
        latestInsight={{
          id: "ins_1",
          eventId: "evt_1",
          summary: "Event closed",
          highlights: [],
          risks: [],
          supplierNotes: [],
          financialSummary: {},
          documentSummary: {},
          feedbackSummary: {},
          dimensions: {
            coordinators: {
              status: "evidence",
              summary: "4 assignment(s); 1 awaiting acknowledgement; 1 late; 0 absent; 1 replaced; 0 cancelled or released; 2 reliability note(s)",
              evidence: ["assignments:4", "reliability-notes:2"],
            },
          },
          privateNotes: "PMCM-only",
          generatedAt: "2026-09-08T00:00:00.000Z",
          updatedAt: "2026-09-08T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Coordinator staffing")).toBeTruthy();
    expect(screen.getByText(/4 assignment\(s\); 1 awaiting acknowledgement/)).toBeTruthy();
    expect(screen.getByText("Evidence: assignments:4 · reliability-notes:2")).toBeTruthy();
  });

  it("explains why old insights do not include staffing history", () => {
    render(
      <Phase4InsightsSection
        busy={false}
        onGenerate={vi.fn()}
        latestInsight={{
          id: "ins_1",
          eventId: "evt_1",
          summary: "Event closed",
          highlights: [],
          risks: [],
          supplierNotes: [],
          financialSummary: {},
          documentSummary: {},
          feedbackSummary: {},
          dimensions: {},
          privateNotes: "PMCM-only",
          generatedAt: "2026-09-08T00:00:00.000Z",
          updatedAt: "2026-09-08T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText(/This insight predates coordinator staffing data/)).toBeTruthy();
  });
});

describe("Phase4ComplianceSection evidence", () => {
  function complianceCheck(overrides: Partial<PrismComplianceCheck> & Pick<PrismComplianceCheck, "id" | "title">): PrismComplianceCheck {
    return { eventId: "evt_1", layer: "Advisory", status: "open", note: "", evaluationStatus: "not_satisfied", evidence: [], definitionStatus: "PROVISIONAL", remediation: "", ...overrides };
  }

  function renderSection(checks: PrismComplianceCheck[], onRunCompliance = vi.fn()) {
    render(
      <Phase4ComplianceSection
        phase="planning"
        ruleTitle=""
        ruleKey=""
        ruleSeverity="must_fix"
        ruleNote=""
        checks={checks}
        rules={[]}
        openChecks={checks.filter((check) => check.status === "open")}
        busy={false}
        onPhase={vi.fn()}
        onRuleTitle={vi.fn()}
        onRuleKey={vi.fn()}
        onRuleSeverity={vi.fn()}
        onRuleNote={vi.fn()}
        onCreateRule={vi.fn()}
        onRunCompliance={onRunCompliance}
        onResolveCompliance={vi.fn()}
        onOverrideCompliance={vi.fn()}
      />,
    );
    return onRunCompliance;
  }

  it("renders a check with no evidence yet and offers to collect it", () => {
    const onRun = renderSection([complianceCheck({ id: "chk_1", layer: "Must-Fix", title: "Venue permit" })]);

    expect(screen.getByText("Venue permit")).toBeTruthy();
    expect(screen.getByText(/No evidence recorded for this check yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Collect evidence" }));
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Resolve" })).toBeTruthy();
  });

  it("lists recorded evidence", () => {
    renderSection([complianceCheck({ id: "chk_2", title: "Insurance", status: "resolved", evaluationStatus: "satisfied", evidence: ["policy.pdf"], definitionStatus: "DERIVED" })]);

    expect(screen.getByRole("list", { name: "Evidence" }).textContent).toBe("policy.pdf");
    expect(screen.queryByRole("button", { name: "Collect evidence" })).toBeNull();
  });

  it("keeps a failing section inside its frame with a Retry while siblings render", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error("boom");
      return <p>Recovered section</p>;
    }
    render(
      <>
        <Phase4SectionBoundary title="Compliance checks"><Flaky /></Phase4SectionBoundary>
        <p>Close gates still here</p>
      </>,
    );

    expect(screen.getByRole("alert").textContent).toContain("Compliance checks");
    expect(screen.getByText("Close gates still here")).toBeTruthy();
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Recovered section")).toBeTruthy();
    consoleError.mockRestore();
  });
});
