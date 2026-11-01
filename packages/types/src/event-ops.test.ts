import { describe, expect, it } from "vitest";
import {
  PRISM_DEFAULT_PAGE_LIMIT,
  PRISM_LIFECYCLE_STAGES,
  PRISM_LIFECYCLE_TRANSITIONS,
  PRISM_MAX_PAGE_LIMIT,
  canClientAccessPortal,
  canCreateEventWorkspace,
  derivePrismLifecycleStage,
  prismCalendarDateKey,
  selectCoordinatorFocusEventId,
  isBeforePrismEventDay,
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

  it("derives one display stage from event facts so every portal agrees", () => {
    const signed = { status: "briefing", clientPortalStatus: "unlocked" };
    expect(derivePrismLifecycleStage({ status: "briefing", clientPortalStatus: "locked" })).toBe("conforme");
    // An approved floorplan alone does not skip briefing: this was the PMCM/client disagreement.
    expect(derivePrismLifecycleStage({ ...signed, proposalClientStatus: "pending" })).toBe("briefing_proposal");
    expect(derivePrismLifecycleStage({ ...signed, proposalClientStatus: "approved" })).toBe("planning");
    // Submitting the briefing sets the operational status to planning; the stage waits for proposal approval.
    expect(derivePrismLifecycleStage({ ...signed, status: "planning", proposalClientStatus: "pending" })).toBe("briefing_proposal");
    expect(derivePrismLifecycleStage({ ...signed, status: "event_day" })).toBe("event_day");
    expect(derivePrismLifecycleStage({ ...signed, actualEndedAt: "2027-06-15T12:00:00Z" })).toBe("closure_archive");
    expect(derivePrismLifecycleStage({ ...signed, archived: true })).toBe("closure_archive");
    expect(isBeforePrismEventDay("planning")).toBe(true);
    expect(isBeforePrismEventDay("event_day")).toBe(false);
  });

  it("opens a coordinator on their next upcoming event, or the latest past one, by Philippine date", () => {
    const events = [{ id: "past", eventDate: "2026-10-01" }, { id: "later", eventDate: "2027-01-09" }, { id: "next", eventDate: "2026-11-02" }];
    expect(selectCoordinatorFocusEventId(events, "2026-11-01")).toBe("next");
    expect(selectCoordinatorFocusEventId(events, "2027-02-01")).toBe("later");
    expect(selectCoordinatorFocusEventId([], "2026-11-01")).toBeUndefined();
    // 2026-11-01 17:00 UTC is already 2 November in Manila.
    expect(prismCalendarDateKey(new Date("2026-11-01T17:00:00Z"))).toBe("2026-11-02");
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
