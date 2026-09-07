import { describe, expect, it } from "vitest";
import {
  createPrismInquirySchema,
  createGuestFeedbackSchema,
  createSupplierApplicationSchema,
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
  replaceCoordinatorAssignmentSchema,
  createCoordinatorAssignmentSchema,
  coordinatorAssignmentAcknowledgementSchema,
  withdrawCoordinatorAssignmentSchema,
  createCoordinatorAvailabilitySchema,
  createCoordinatorCoverageRequirementSchema,
  updateCoordinatorAttendanceSchema,
  verifySupplierStatusSchema,
  createFloorPlanDraftSchema,
  createFloorPlanPreferenceSchema,
  createRegistrationPlatformSchema,
  updateRegistrationPlatformSchema,
  importHeadcountSchema,
  submitBriefingSchema,
  uploadConformeSchema,
  parseContract,
  PrismContractError,
} from "./index.js";

describe("event-ops write schemas", () => {
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
      }).success,
    ).toBe(true);
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
});
