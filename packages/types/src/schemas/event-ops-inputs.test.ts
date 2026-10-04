import { describe, expect, it } from "vitest";
import { requestApprovalSchema } from "./auth-inputs.js";
import { pmcmCommandInboxQuerySchema } from "./event-ops-inputs.js";
import {
  createPrismInquirySchema,
  createGuestFeedbackSchema,
  coordinatorWalkInCheckInSchema,
  moderateGuestFeedbackSchema,
  withdrawGuestFeedbackConsentSchema,
  createSupplierApplicationSchema,
  createSupplierSchema,
  createSupplierReviewSchema,
  createSupplierReliabilityNoteSchema,
  promoteSupplierSchema,
  reviewEventProposalSchema,
  archiveSearchFiltersSchema,
  reviewSupplierApplicationSchema,
  updateSupplierEventStatusSchema,
  submitSupplierQuoteSchema,
  updateInquiryStatusSchema,
  createUrgentIssueSchema,
  updateUrgentIssueSchema,
  escalateLiveOpsRecordSchema,
  escalateEventDayTaskSchema,
  replaceCoordinatorAssignmentSchema,
  createCoordinatorAssignmentSchema,
  coordinatorAssignmentAcknowledgementSchema,
  withdrawCoordinatorAssignmentSchema,
  createCoordinatorAvailabilitySchema,
  createCoordinatorCoverageRequirementSchema,
  updateCoordinatorAttendanceSchema,
  verifySupplierStatusSchema,
  COORDINATOR_ROLES,
  canonicalCoordinatorRole,
  coordinatorRoleSchema,
  coordinatorSuggestionsQuerySchema,
  createEventDayTaskSchema,
  createEventHandoffSchema,
  createEventScheduleSegmentSchema,
  createEventEodReportSchema,
  createEventTaskReassignmentSchema,
  createFloorPlanDraftSchema,
  createFloorPlanPreferenceSchema,
  createPrivacyLegalHoldSchema,
  releasePrivacyLegalHoldSchema,
  createRegistrationPlatformSchema,
  updateRegistrationPlatformSchema,
  importHeadcountSchema,
  submitBriefingSchema,
  uploadConformeSchema,
  submitClientOcularVisitSchema,
  scheduleOcularVisitSchema,
  waiveOcularVisitSchema,
  parseContract,
  PrismContractError,
} from "./index.js";

describe("privacy legal hold contracts", () => {
  it("requires a supported identity and reason while allowing optional event scope", () => {
    expect(createPrivacyLegalHoldSchema.safeParse({
      subjectType: "client", subjectEmail: "ana@example.test", reason: "Preserve records",
    }).success).toBe(true);
    expect(createPrivacyLegalHoldSchema.safeParse({
      subjectType: "supplier", reason: "Preserve records",
    }).success).toBe(false);
    expect(createPrivacyLegalHoldSchema.safeParse({
      subjectType: "guest", subjectName: "Ana Reyes", reason: "Preserve records",
    }).success).toBe(true);
    expect(createPrivacyLegalHoldSchema.safeParse({
      subjectType: "guest", reason: "Preserve records",
    }).success).toBe(false);
    expect(createPrivacyLegalHoldSchema.safeParse({
      subjectType: "account", subjectEmail: "ana@example.test", reason: "Preserve records",
    }).success).toBe(false);
    expect(releasePrivacyLegalHoldSchema.safeParse({ reason: "Counsel confirmed release" }).success).toBe(true);
    expect(releasePrivacyLegalHoldSchema.safeParse({ reason: "  " }).success).toBe(false);
  });
});

describe("coordinator role contracts", () => {
  it("accepts the seven canonical roles and rejects new role values outside the catalog", () => {
    expect(COORDINATOR_ROLES).toEqual([
      "General Coordinator",
      "Event Day System Operator",
      "Registration Staff",
      "Floor Director",
      "Stage Director",
      "Ingress and Egress Assistant",
      "Usher",
    ]);
    for (const role of COORDINATOR_ROLES) expect(coordinatorRoleSchema.safeParse(role).success).toBe(true);
    expect(canonicalCoordinatorRole(" floor   director ")).toBe("Floor Director");
    expect(canonicalCoordinatorRole("Volunteer Lead")).toBeUndefined();
    expect(coordinatorRoleSchema.safeParse("Operations Hero").success).toBe(false);
    expect(createCoordinatorAssignmentSchema.safeParse({ coordinatorId: "coord_1", role: "Operations Hero" }).success).toBe(false);
    expect(createCoordinatorCoverageRequirementSchema.safeParse({ role: "Operations Hero", required: 1 }).success).toBe(false);
    expect(createCoordinatorCoverageRequirementSchema.safeParse({ role: "Floor Director", mapFromRole: "Volunteer Lead", required: 1 }).success).toBe(true);
    expect(createCoordinatorCoverageRequirementSchema.safeParse({ role: "Floor Director", mapFromRole: "Usher", required: 1 }).success).toBe(false);
    expect(replaceCoordinatorAssignmentSchema.safeParse({ replacementCoordinatorId: "coord_2", replacementRole: "Operations Hero", reason: "Changed assignment" }).success).toBe(false);
  });

  it("validates coordinator role writes while preserving flexible issue routing labels", () => {
    expect(createEventDayTaskSchema.safeParse({ title: "Check in", assignedRole: "Operations Hero" }).success).toBe(false);
    expect(createEventTaskReassignmentSchema.safeParse({ toOwnerRole: "Operations Hero", reason: "Coverage change" }).success).toBe(false);
    expect(escalateEventDayTaskSchema.safeParse({ notes: "Need backup", ownerRole: "Operations Hero" }).success).toBe(false);
    expect(createUrgentIssueSchema.safeParse({ title: "Queue delay", ownerRole: "Finance" }).success).toBe(true);
    expect(updateUrgentIssueSchema.safeParse({ ownerRole: "Finance" }).success).toBe(true);
    expect(escalateLiveOpsRecordSchema.safeParse({ ownerRole: "Finance" }).success).toBe(true);
    expect(createEventScheduleSegmentSchema.safeParse({
      title: "Doors open",
      plannedStartAt: "2026-10-02T08:00:00.000Z",
      plannedEndAt: "2026-10-02T09:00:00.000Z",
      ownerRole: "Operations Hero",
    }).success).toBe(false);
    expect(createEventHandoffSchema.safeParse({
      dayId: "day_1",
      role: "Operations Hero",
      fromAssignmentId: "asg_1",
      toAssignmentId: "asg_2",
    }).success).toBe(false);
    expect(createEventHandoffSchema.safeParse({
      dayId: "day_1",
      role: "Floor Director",
      fromAssignmentId: "asg_1",
      toAssignmentId: "asg_1",
    }).success).toBe(false);
  });

  it("requires useful content in an end-of-day report", () => {
    expect(createEventEodReportSchema.safeParse({ dayId: "day_1" }).success).toBe(false);
    expect(createEventEodReportSchema.safeParse({ dayId: "day_1", progress: ["Doors opened"] }).success).toBe(true);
    expect(createEventEodReportSchema.safeParse({ dayId: "day_1", issues: ["Queue delay"] }).success).toBe(true);
    expect(createEventEodReportSchema.safeParse({ dayId: "day_1", risksForTomorrow: ["Confirm power"] }).success).toBe(true);
  });

  it("parses optional single and repeated skills in suggestion query parameters", () => {
    expect(coordinatorSuggestionsQuerySchema.parse({ role: "Usher" })).toEqual({ role: "Usher", skills: [] });
    expect(coordinatorSuggestionsQuerySchema.parse({ role: "Usher", skills: "registration" })).toEqual({ role: "Usher", skills: ["registration"] });
    expect(coordinatorSuggestionsQuerySchema.parse({ role: "Usher", skills: ["registration", "first aid"] })).toEqual({ role: "Usher", skills: ["registration", "first aid"] });
    expect(coordinatorSuggestionsQuerySchema.safeParse({ role: "Usher", skills: Array.from({ length: 21 }, () => "skill") }).success).toBe(false);
  });
});
describe("event-ops write schemas", () => {
  it("validates supplier creation fields used by the PMCM command adapter", () => {
    expect(createSupplierSchema.safeParse({ categoryId: "cat_1", name: " " }).success).toBe(false);
    expect(
      createSupplierSchema.safeParse({
        categoryId: "cat_1",
        name: "Sound and Light Co.",
        email: "not-an-email",
      }).success,
    ).toBe(false);
    expect(
      createSupplierSchema.safeParse({
        categoryId: "cat_1",
        name: "Sound and Light Co.",
        email: "hello@sound.test",
      }).success,
    ).toBe(true);
  });

  it("accepts a valid inquiry payload", () => {
    const parsed = createPrismInquirySchema.parse({
      clientName: "Maria Santos",
      email: "maria@samplecorp.test",
      eventName: "Leadership Forum",
      eventDate: "2026-06-18",
      clientType: "Corporate",
      source: "P.R.I.S.M Website",
      message: "Need full planning support.",
      privacyConsentAccepted: true,
    });
    expect(parsed.email).toBe("maria@samplecorp.test");
    expect(parsed.eventDate).toBe("2026-06-18");
  });

  it("rejects invalid inquiry email and date", () => {
    const result = createPrismInquirySchema.safeParse({
      clientName: "Maria",
      email: "not-an-email",
      eventName: "Forum",
      eventDate: "not-a-date",
      clientType: "Corporate",
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("validates guest feedback rating bounds", () => {
    expect(
      createGuestFeedbackSchema.safeParse({
        guestName: "Alex",
        rating: 6,
      }).success,
    ).toBe(false);
    expect(
      createGuestFeedbackSchema.safeParse({
        guestName: "Alex",
        rating: 5,
        privacyConsentAccepted: true,
      }).success,
    ).toBe(true);
    expect(
      createGuestFeedbackSchema.safeParse({ guestName: "Alex", rating: 5 }).success,
    ).toBe(false);
    expect(
      createGuestFeedbackSchema.safeParse({
        guestName: "Alex",
        rating: 5,
        privacyConsentAccepted: false,
      }).success,
    ).toBe(false);
  });

  it("requires a guest name and explicit privacy consent for coordinator walk-ins", () => {
    expect(coordinatorWalkInCheckInSchema.parse({ guestName: "  Alex Santos  ", privacyConsentAccepted: true })).toEqual({
      guestName: "Alex Santos",
      privacyConsentAccepted: true,
    });
    expect(coordinatorWalkInCheckInSchema.safeParse({ guestName: "Alex Santos", privacyConsentAccepted: false }).success).toBe(false);
    expect(coordinatorWalkInCheckInSchema.safeParse({ guestName: "  ", privacyConsentAccepted: true }).success).toBe(false);
  });

  it("requires explicit consent for account approval requests", () => {
    expect(requestApprovalSchema.safeParse({ email: "ana@example.test" }).success).toBe(false);
    expect(requestApprovalSchema.safeParse({ email: "ana@example.test", privacyConsentAccepted: false }).success).toBe(false);
    expect(requestApprovalSchema.safeParse({ email: "ana@example.test", privacyConsentAccepted: true }).success).toBe(true);
  });

  it("caps inbox paging at one hundred pages and rejects invalid offsets", () => {
    expect(pmcmCommandInboxQuerySchema.parse({ page: "2" })).toEqual({ page: 2 });
    expect(pmcmCommandInboxQuerySchema.parse({})).toEqual({ page: 0 });
    expect(pmcmCommandInboxQuerySchema.safeParse({ page: "-1" }).success).toBe(false);
    expect(pmcmCommandInboxQuerySchema.safeParse({ page: "100" }).success).toBe(true);
    expect(pmcmCommandInboxQuerySchema.safeParse({ page: "101" }).success).toBe(false);
  });

  it("requires reasons for negative moderation and at least one consent withdrawal", () => {
    expect(moderateGuestFeedbackSchema.safeParse({ action: "approve" }).success).toBe(true);
    expect(moderateGuestFeedbackSchema.safeParse({ action: "reject" }).success).toBe(false);
    expect(moderateGuestFeedbackSchema.safeParse({ action: "hide", reason: "Contains private details" }).success).toBe(true);
    expect(withdrawGuestFeedbackConsentSchema.safeParse({}).success).toBe(false);
    expect(withdrawGuestFeedbackConsentSchema.safeParse({ withdrawMarketingConsent: true }).success).toBe(true);
  });

  it("validates supplier event-day status enum", () => {
    expect(updateSupplierEventStatusSchema.safeParse({ status: "arrived" }).success).toBe(true);
    expect(updateSupplierEventStatusSchema.safeParse({ status: "maybe" }).success).toBe(false);
  });

  it("validates PMCM supplier review ratings, notes, and dimensions", () => {
    const parsed = createSupplierReviewSchema.parse({
      eventId: "evt_close_1",
      rating: 5,
      notes: "Delivered on time and handled the stage reset well.",
      reviewedBy: "Maxine",
      dimensionRatings: [{ dimensionId: "dim_reliability", rating: 5 }],
      idempotencyKey: "review-draft-1",
    });

    expect(parsed.eventId).toBe("evt_close_1");
    expect(parsed).not.toHaveProperty("reviewedBy");
    expect(parsed.dimensionRatings?.[0].rating).toBe(5);
    expect(createSupplierReviewSchema.safeParse({ rating: 0, notes: "Too low" }).success).toBe(false);
    expect(createSupplierReviewSchema.safeParse({ rating: 6, notes: "Too high" }).success).toBe(false);
    expect(createSupplierReviewSchema.safeParse({ rating: 5, notes: "" }).success).toBe(false);
    expect(
      createSupplierReviewSchema.safeParse({
        rating: 5,
        notes: "Good",
        dimensionRatings: [{ dimensionId: "dim_reliability", rating: 6 }],
      }).success,
    ).toBe(false);
  });

  it("validates supplier quote amount", () => {
    expect(submitSupplierQuoteSchema.safeParse({ amount: 12000 }).success).toBe(true);
    expect(submitSupplierQuoteSchema.safeParse({ amount: -1 }).success).toBe(false);
  });

  it("requires an event and reason for supplier reliability and promotion actions", () => {
    expect(createSupplierReliabilityNoteSchema.safeParse({ eventId: "evt_1", note: "On time" }).success).toBe(true);
    expect(createSupplierReliabilityNoteSchema.safeParse({ eventId: "", note: "On time" }).success).toBe(false);
    expect(promoteSupplierSchema.safeParse({ eventId: "evt_1", tier: "tier_1", reason: "Completed assessment" }).success).toBe(true);
    expect(promoteSupplierSchema.safeParse({ eventId: "evt_1", tier: "pending_first_event", reason: "Promote" }).success).toBe(false);
  });

  it("validates inquiry status transitions", () => {
    expect(updateInquiryStatusSchema.safeParse({ status: "accepted" }).success).toBe(true);
    expect(updateInquiryStatusSchema.safeParse({ status: "nope" }).success).toBe(false);
  });

  it("requires a revision note only when the client requests a proposal change", () => {
    expect(reviewEventProposalSchema.safeParse({ action: "approve" }).success).toBe(true);
    expect(reviewEventProposalSchema.safeParse({ action: "request_revision" }).success).toBe(false);
    expect(
      reviewEventProposalSchema.safeParse({
        action: "request_revision",
        revisionNote: "Please reduce the AV package.",
      }).success,
    ).toBe(true);
  });

  it("validates archive search month as YYYY-MM", () => {
    expect(archiveSearchFiltersSchema.safeParse({ venue: "Shangri-La", month: "2026-06" }).success).toBe(true);
    expect(archiveSearchFiltersSchema.safeParse({ month: "June" }).success).toBe(false);
  });

  it("requires a decline reason for supplier application review", () => {
    expect(
      reviewSupplierApplicationSchema.safeParse({ action: "request_proposal" }).success,
    ).toBe(true);
    expect(reviewSupplierApplicationSchema.safeParse({ action: "decline" }).success).toBe(false);
    expect(
      reviewSupplierApplicationSchema.safeParse({
        action: "decline",
        declineReason: "Outside current roster",
      }).success,
    ).toBe(true);
  });

  it("validates registration platform writes", () => {
    expect(
      createRegistrationPlatformSchema.safeParse({
        platformType: "xperto",
        expectedPaxMin: 200,
        expectedPaxMax: 250,
      }).success,
    ).toBe(true);
    expect(createRegistrationPlatformSchema.safeParse({ platformType: "ticketmaster" }).success).toBe(false);
    expect(updateRegistrationPlatformSchema.safeParse({ status: "live" }).success).toBe(true);
    expect(updateRegistrationPlatformSchema.safeParse({ status: "done" }).success).toBe(false);
    expect(
      importHeadcountSchema.safeParse({ headcountSource: "XPERTO", importedHeadcount: 180 }).success,
    ).toBe(true);
    expect(
      importHeadcountSchema.safeParse({ headcountSource: "XPERTO", importedHeadcount: -1 }).success,
    ).toBe(false);
  });

  it("validates supplier application input", () => {
    expect(
      createSupplierApplicationSchema.safeParse({
        companyName: "Northstar Events",
        contactName: "Ava Cruz",
        email: "ava@northstar.test",
        privacyConsentAccepted: true,
      }).success,
    ).toBe(true);
    expect(
      createSupplierApplicationSchema.safeParse({
        companyName: "Northstar Events",
        contactName: "Ava Cruz",
        email: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("accepts affected area without accepting a caller-supplied reporter", () => {
    const parsed = createUrgentIssueSchema.parse({
      title: "Power outage",
      severity: "critical",
      affectedArea: "North Wing",
      openedBy: "Spoofed Administrator",
    });

    expect(parsed.affectedArea).toBe("North Wing");
    expect(parsed).not.toHaveProperty("openedBy");
  });

  it("covers the remaining live-ops write contracts", () => {
    const attendance = updateCoordinatorAttendanceSchema.parse({ status: "present", markedBy: "Spoofed Operator" });
    expect(attendance).not.toHaveProperty("markedBy");
    expect(updateUrgentIssueSchema.safeParse({ affectedArea: "North Wing" }).success).toBe(true);
    expect(escalateLiveOpsRecordSchema.safeParse({ notes: "Need backup" }).success).toBe(true);
    expect(
      replaceCoordinatorAssignmentSchema.safeParse({
        replacementCoordinatorId: "coord_backup",
        role: "Usher",
        reason: "Sick leave",
      }).success,
    ).toBe(true);
    const verification = verifySupplierStatusSchema.parse({ verificationStatus: "verified", verifiedBy: "Spoofed Operator" });
    expect(verification).not.toHaveProperty("verifiedBy");
    expect(verifySupplierStatusSchema.safeParse({ verificationStatus: "self_reported" }).success).toBe(false);
  });

  it("parseContract throws PrismContractError with issues", () => {
    expect(() =>
      parseContract(createPrismInquirySchema, { clientName: "" }, "Create inquiry"),
    ).toThrow(PrismContractError);
  });

  it("keeps floorplan writes on shared Zod contracts", () => {
    expect(
      createFloorPlanDraftSchema.safeParse({
        name: "Official layout",
        sourceType: "blank",
        width: 1200,
        height: 800,
      }).success,
    ).toBe(true);
    expect(
      createFloorPlanPreferenceSchema.safeParse({
        name: "Client preference",
        seatingStyle: "banquet",
        stagePreference: "front",
        flowNotes: "Keep a wide aisle",
        guestCount: 120,
        constraints: ["Accessible entrance"],
      }).success,
    ).toBe(true);
    expect(
      createFloorPlanPreferenceSchema.safeParse({
        name: "Client preference",
        seatingStyle: "banquet",
        stagePreference: "front",
        flowNotes: "Keep a wide aisle",
        guestCount: 0,
        constraints: [],
      }).success,
    ).toBe(false);
  });

  it("validates the client briefing write contract", () => {
    expect(
      submitBriefingSchema.safeParse({
        venue: "BGC Convention Hall",
        guestCount: 250,
        budgetRange: "500000-750000",
        serviceRequirements: ["registration", "stage"],
        notes: "Executive audience",
      }).success,
    ).toBe(true);
    expect(
      submitBriefingSchema.safeParse({
        venue: "",
        guestCount: 0,
        budgetRange: "",
        serviceRequirements: ["registration"],
        notes: "",
      }).success,
    ).toBe(false);
  });

  it("keeps conforme uploads on the shared file contract", () => {
    expect(uploadConformeSchema.safeParse({ fileName: "signed-conforme.pdf" }).success).toBe(true);
    expect(uploadConformeSchema.safeParse({ fileName: "malware.exe" }).success).toBe(false);
  });

  it("validates staffing availability, coverage, and acknowledgement writes", () => {
    expect(createCoordinatorAssignmentSchema.safeParse({ coordinatorId: "coord_1", role: "Floor Director" }).success).toBe(true);
    expect(createCoordinatorAssignmentSchema.safeParse({ role: "Floor Director" }).success).toBe(false);
    expect(coordinatorAssignmentAcknowledgementSchema.safeParse({ decision: "acknowledged" }).success).toBe(true);
    expect(coordinatorAssignmentAcknowledgementSchema.safeParse({ decision: "declined" }).success).toBe(false);
    expect(withdrawCoordinatorAssignmentSchema.safeParse({ reason: "No longer available" }).success).toBe(true);
    expect(withdrawCoordinatorAssignmentSchema.safeParse({ reason: " " }).success).toBe(false);
    expect(createCoordinatorAvailabilitySchema.safeParse({
      startsAt: "2026-06-18T00:00:00.000Z",
      endsAt: "2026-06-19T00:00:00.000Z",
      kind: "blocked",
    }).success).toBe(true);
    expect(createCoordinatorAvailabilitySchema.safeParse({
      startsAt: "2026-06-19T00:00:00.000Z",
      endsAt: "2026-06-18T00:00:00.000Z",
    }).success).toBe(false);
    expect(createCoordinatorCoverageRequirementSchema.safeParse({ role: "Floor Director", required: 2 }).success).toBe(true);
    expect(createCoordinatorCoverageRequirementSchema.safeParse({ role: "Floor Director", required: -1 }).success).toBe(false);
  });

  it("acceptsOptionalTrimmedClientOcularVisitNote", () => {
    expect(submitClientOcularVisitSchema.parse({ clientNote: "  Please coordinate with security.  " })).toEqual({
      clientNote: "Please coordinate with security.",
    });
    expect(submitClientOcularVisitSchema.parse({})).toEqual({});
  });

  it("requiresOffsetDatetimeForOcularVisitSchedule", () => {
    expect(scheduleOcularVisitSchema.safeParse({ scheduledAt: "2026-10-14T09:00:00+08:00" }).success).toBe(true);
    expect(scheduleOcularVisitSchema.safeParse({ scheduledAt: "2026-10-14T09:00:00" }).success).toBe(false);
  });

  it("rejectsBlankOcularVisitWaiverReason", () => {
    expect(waiveOcularVisitSchema.safeParse({ reason: "  " }).success).toBe(false);
    expect(waiveOcularVisitSchema.parse({ reason: "  Venue access is unavailable.  " })).toEqual({
      reason: "Venue access is unavailable.",
    });
  });
});
