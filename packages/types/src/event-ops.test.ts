import { describe, expect, it } from "vitest";
import {
  PRISM_DEFAULT_PAGE_LIMIT,
  PRISM_LIFECYCLE_STAGES,
  PRISM_LIFECYCLE_TRANSITIONS,
  PRISM_MAX_PAGE_LIMIT,
  canClientAccessPortal,
  canCreateEventWorkspace,
  nextPrismLifecycleStages,
  normalizePrismPageLimit,
  type PrismActionResult,
  type PrismApiProblem,
  type PrismCursorPage,
  type PrismListQuery,
  type PrismFileRequirementsMatrix,
  type PrismLifecycleStage,
} from "./index.js";

describe("P.R.I.S.M lifecycle contract", () => {
  it("keeps the accepted inquiry plus signed conforme gate explicit", () => {
    expect(PRISM_LIFECYCLE_STAGES).toEqual([
      "inquiry",
      "conforme",
      "briefing_proposal",
      "planning",
      "event_day",
      "closure_archive",
    ]);

    const stage: PrismLifecycleStage = "planning";
    expect(stage).toBe("planning");
  });

  it("publishes lifecycle transition rules for role apps and API services", () => {
    expect(PRISM_LIFECYCLE_TRANSITIONS.inquiry).toEqual(["conforme"]);
    expect(PRISM_LIFECYCLE_TRANSITIONS.event_day).toEqual(["closure_archive"]);
    expect(nextPrismLifecycleStages("closure_archive")).toEqual([]);
  });

  it("allows client portal access only after inquiry acceptance and signed conforme", () => {
    expect(
      canClientAccessPortal({
        inquiryStatus: "accepted",
        conformeStatus: "signed",
      }),
    ).toBe(true);

    expect(
      canClientAccessPortal({
        inquiryStatus: "new",
        conformeStatus: "signed",
      }),
    ).toBe(false);

    expect(
      canClientAccessPortal({
        inquiryStatus: "accepted",
        conformeStatus: "pending",
      }),
    ).toBe(false);
  });

  it("allows event workspace creation only after the same gate", () => {
    expect(canCreateEventWorkspace({ inquiryStatus: "accepted", conformeStatus: "signed" })).toBe(true);
    expect(canCreateEventWorkspace({ inquiryStatus: "accepted", conformeStatus: "pending" })).toBe(false);
  });
  it("normalizes shared cursor page limits", () => {
    expect(PRISM_DEFAULT_PAGE_LIMIT).toBe(25);
    expect(PRISM_MAX_PAGE_LIMIT).toBe(100);
    expect(normalizePrismPageLimit(undefined)).toBe(25);
    expect(normalizePrismPageLimit(0)).toBe(25);
    expect(normalizePrismPageLimit(10.8)).toBe(10);
    expect(normalizePrismPageLimit(250)).toBe(100);
    expect(normalizePrismPageLimit("12")).toBe(12);
  });
  it("publishes the Sprint 2 UI contract gate types", () => {
    const query: PrismListQuery<"severity" | "eventDate"> = {
      limit: 25,
      cursor: "cursor_1",
      filters: [
        {
          field: "severity",
          operator: "equals",
          value: "blocked",
        },
      ],
      sort: [
        {
          field: "eventDate",
          direction: "asc",
        },
      ],
    };

    const page: PrismCursorPage<{ id: string }> = {
      items: [{ id: "item_1" }],
      limit: query.limit ?? 25,
      nextCursor: null,
      hasMore: false,
    };

    const problem: PrismApiProblem = {
      code: "blocked_by_gate",
      message: "Real uploads are gated until storage is approved.",
      status: 409,
      retryable: false,
      emptyReason: "blocked_by_gate",
      fieldErrors: [{ field: "file", message: "Storage adapter is not configured." }],
    };

    const result: PrismActionResult = {
      status: "denied",
      message: problem.message,
      problem,
      auditReference: "audit_1",
    };

    const matrix: PrismFileRequirementsMatrix = {
      eventId: "evt_1",
      items: [
        {
          key: "signed_conforme",
          label: "Signed conforme",
          ownerRole: "pmcm-admin",
          visibleToRoles: ["pmcm-admin", "client"],
          sourceWorkflow: "client_onboarding",
          status: "submitted",
          required: true,
          overdue: false,
          uploadedAssetId: "doc_conforme",
          auditCategory: "documents",
          detail: "Formal authorization file required before portal activation.",
        },
      ],
    };

    expect(page.items[0]?.id).toBe("item_1");
    expect(matrix.items[0]?.visibleToRoles).toContain("client");
    expect(result.problem?.emptyReason).toBe("blocked_by_gate");
  });
});
