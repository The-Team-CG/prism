/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismComplianceCheck } from "@prism/types";
import { Phase4SectionBoundary } from "./phase4-section-boundary";
import { Phase4CloseGatesSection, Phase4ComplianceSection, Phase4InsightsSection } from "./phase4-workspace-sections";

afterEach(cleanup);

describe("Phase4CloseGatesSection", () => {
  it("links each unpassed gate to the place that resolves it and leaves passed gates unlinked", () => {
    const onOpenDestination = vi.fn();
    render(
      <Phase4CloseGatesSection
        closeGates={{
          eventId: "evt_1",
          ready: false,
          missingKeys: ["documents", "billing"],
          gates: [
            { key: "documents", label: "Deliverables", passed: false, detail: "2 deliverables pending" },
            { key: "billing", label: "Billing and payment schedule", passed: false, detail: "No approved statement" },
            { key: "logistics", label: "Logistics", passed: true, detail: "Returns verified" },
          ],
        }}
        overrideReason=""
        busy={false}
        onOverrideReason={vi.fn()}
        onRefresh={vi.fn()}
        onArchive={vi.fn()}
        onOpenDestination={onOpenDestination}
      />,
    );

    expect(screen.queryByRole("button", { name: "Open Wrap up" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open Deliverables" }));
    expect(onOpenDestination).toHaveBeenCalledWith({ kind: "closure-tab", tabId: "deliverables", label: "Open Deliverables" });
    fireEvent.click(screen.getByRole("button", { name: "Open Billing" }));
    expect(onOpenDestination).toHaveBeenLastCalledWith({ kind: "event-tab", tab: "billing", label: "Open Billing" });
  });
});

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
        checks={checks}
        rules={[]}
        openChecks={checks.filter((check) => check.status === "open")}
        busy={false}
        onPhase={vi.fn()}
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

  it("links an open event-date check to closure and to recording a postponement, and nowhere else", () => {
    const dateCheck = { id: "chk_date", title: "Event date is upcoming", conditionKey: "event_date_relative_to_now" };
    const { unmount } = render(
      <Phase4ComplianceSection phase="planning" checks={[complianceCheck(dateCheck)]} rules={[]} openChecks={[]} busy={false} onPhase={vi.fn()} onRunCompliance={vi.fn()} onResolveCompliance={vi.fn()} onOverrideCompliance={vi.fn()} />,
    );
    expect(screen.getByRole("link", { name: "Open Closure" }).getAttribute("href")).toBe("/dashboard/events/evt_1/closure");
    expect(screen.getByRole("link", { name: "Record a postponement" }).getAttribute("href")).toBe("/dashboard/events/evt_1/briefing?part=changes");
    unmount();

    render(
      <Phase4ComplianceSection phase="planning" checks={[complianceCheck({ ...dateCheck, status: "resolved" }), complianceCheck({ id: "chk_other", title: "Venue permit" })]} rules={[]} openChecks={[]} busy={false} onPhase={vi.fn()} onRunCompliance={vi.fn()} onResolveCompliance={vi.fn()} onOverrideCompliance={vi.fn()} />,
    );
    expect(screen.queryByRole("link", { name: "Open Closure" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Record a postponement" })).toBeNull();
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
