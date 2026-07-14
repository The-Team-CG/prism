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
  type PrismPmcmDashboardWorkspace,
  type PrismSampleState,
  type PrismEvent,
  type PrismFileRequirementsMatrix,
  type PrismFloorPlanDraft,
  type PrismInquiry,
  type PrismSupplier,
  type PrismUser,
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

describe("event-ops shared read model types", () => {
  it("allows role apps to import the same Prism sample state shape", () => {
    const user: PrismUser = {
      id: "user_pmcm",
      name: "Ms. Mys",
      email: "mys@pmcm.test",
      role: "pmcm-admin",
      organization: "PMCM",
      approvalStatus: "approved",
    };

    const inquiry: PrismInquiry = {
      id: "inq_1",
      clientName: "Acme Client",
      companyName: "Acme",
      email: "client@example.com",
      eventName: "Acme Summit",
      eventType: "Corporate",
      eventDate: "2026-07-01",
      clientType: "corporate",
      source: "Website",
      message: "Need full planning support.",
      status: "accepted",
      createdAt: "2026-06-10T00:00:00.000Z",
    };

    const draft: PrismFloorPlanDraft = {
      id: "draft_1",
      eventId: "evt_1",
      floorPlanId: "floor_1",
      name: "Official layout",
      status: "approved",
      isActive: true,
      sourceType: "blank",
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
    };

    const event: PrismEvent = {
      id: "evt_1",
      inquiryId: inquiry.id,
      eventName: inquiry.eventName,
      clientName: inquiry.clientName,
      eventDate: inquiry.eventDate,
      status: "planning",
      clientPortalStatus: "unlocked",
      readiness: "Planning",
      archived: false,
      floorPlanStatus: "approved",
      floorPlanId: draft.floorPlanId,
      activeFloorPlanDraftId: draft.id,
      floorPlanDrafts: [draft],
    };

    const supplier: PrismSupplier = {
      id: "sup_1",
      name: "Prime Lights",
      categoryId: "cat_lights",
      categoryName: "Lights and Sounds",
      categorySlug: "lights-sounds",
      tier: "tier_1",
      bniMember: true,
      autoTrust: true,
      contactName: "Supplier Rep",
      email: "supplier@example.com",
      phone: "09170000000",
      serviceInclusions: "lights, sounds",
      performanceNotes: "Reliable.",
      applicationDate: "2026-06-10T00:00:00.000Z",
      aggregateRating: 4.8,
      lastEventDate: null,
      pastEvents: [],
      reviews: [],
      reliabilityNotes: [],
      certifications: [],
    };

    const state = {
      users: [user],
      inquiries: [inquiry],
      events: [event],
      documents: [],
      briefings: [],
      supplierQuoteRequests: [],
      supplierQuotes: [],
      coordinators: [],
      coordinatorRoleRequirements: [],
      coordinatorAssignments: [],
      complianceRules: [],
      complianceChecks: [],
      billingSources: [],
      billingStatements: [],
      paymentMilestones: [],
      paymentRecords: [],
      postEventDocuments: [],
      eventInsights: [],
      floorPlanDrafts: [draft],
      supplierCategories: [],
      suppliers: [supplier],
      auditLogs: [],
      notificationLogs: [],
    } satisfies PrismSampleState;

    const pmcmWorkspace: PrismPmcmDashboardWorkspace = state;
    expect(state.events[0]?.id).toBe("evt_1");
    expect(pmcmWorkspace.events[0]?.id).toBe("evt_1");
    expect(state.suppliers[0]?.tier).toBe("tier_1");
  });
});
