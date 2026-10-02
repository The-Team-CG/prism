/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Phase4InsightsSection } from "./phase4-workspace-sections";

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
