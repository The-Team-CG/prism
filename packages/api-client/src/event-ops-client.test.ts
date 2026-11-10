import { afterEach, describe, expect, it, vi } from "vitest";
import { PRISM_PRIVACY_NOTICE_VERSION, PrismContractError, type PrismEventOpsActorContext } from "@prism/types";
import { PRISM_API_OFFLINE_MESSAGE, PrismApiError, PrismApiOfflineError, createEventOpsClient, normalizePrismApiProblem, prismRequest, toQueryString } from "./index";

let fixtureUuidSequence = 0;

function createFixtureUuid(version = "4"): string {
  const suffix = (++fixtureUuidSequence).toString(16).padStart(12, "0");
  return `00000000-0000-${version}${suffix.slice(0, 3)}-8000-${suffix}`;
}

const TEST_FIXTURES = {
  primaryId: createFixtureUuid(),
  secondId: createFixtureUuid(),
  thirdId: createFixtureUuid(),
  fourthId: createFixtureUuid(),
  invalidVersionId: createFixtureUuid("1"),
  gameMediaObjectId: "obj_" + createFixtureUuid(),
  secondGameMediaObjectId: "obj_" + createFixtureUuid(),
  lobbyLogoObjectId: "obj_" + createFixtureUuid(),
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("prismRequest", () => {
  it("keeps a session token off the public supplier quote link requests, and on the signed-in ones", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api", getAuthToken: () => "supplier-session" });

    await client.supplierWorkspace.submitQuoteByLink("link/1", { amount: 1 } as never);
    await client.supplierWorkspace.reviseQuoteByLink("link/1", { amount: 2 } as never);
    await client.supplierWorkspace.detail();

    const sent = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url).replace("https://api.example.test/api", "")}`);
    expect(sent).toEqual(["POST /quote-requests/link%2F1/quote", "PATCH /quote-requests/link%2F1/quote", "GET /supplier/workspace"]);
    const authorization = (index: number) => (fetchMock.mock.calls[index]?.[1]?.headers as Record<string, string>).Authorization;
    expect(authorization(0)).toBeUndefined();
    expect(authorization(1)).toBeUndefined();
    expect(authorization(2)).toBe("Bearer supplier-session");
  });

  it("sends the guest requests by access code with no token, and a feedback file as raw bytes with its own headers", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ data: { id: "x" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const guest = createEventOpsClient({ baseUrl: "https://api.example.test/api" }).guest;
    const file = new File([new Uint8Array([1, 2, 3])], "party pic.png", { type: "image/png" });
    const any = {} as never;

    await guest.eventPass("AYALA/1");
    await guest.watermark("AYALA-1");
    await guest.checkIn("AYALA-1", any);
    await guest.feedback("AYALA-1", any);
    await guest.withdrawFeedbackConsent("AYALA-1", "f/1", any);
    await guest.uploadFeedbackMedia("AYALA-1", file);

    const sent = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url).replace("https://api.example.test/api", "")}`);
    expect(sent).toEqual([
      "GET /guest/events/AYALA%2F1",
      "GET /guest/events/AYALA-1/watermark",
      "POST /guest/events/AYALA-1/check-ins",
      "POST /guest/events/AYALA-1/feedback",
      "POST /guest/events/AYALA-1/feedback/f%2F1/consent-withdrawal",
      "POST /guest/events/AYALA-1/feedback-media",
    ]);
    expect(fetchMock.mock.calls.every(([, init]) => (init?.headers as Record<string, string>).Authorization === undefined)).toBe(true);
    const upload = fetchMock.mock.calls[5]?.[1];
    expect(upload?.body).toBe(file);
    expect(upload?.headers).toMatchObject({ "Content-Type": "image/png", "x-prism-file-name": encodeURIComponent("party pic.png") });
  });

  it("sends the client's closeout, floorplan, briefing, conforme, inquiry-link and shared-record requests to their endpoints", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api", getAuthToken: () => "token" });
    const any = {} as never;

    await client.commercial.createClientBillingDispute("e1", any);
    await client.commercial.decideClientReviewItem("e1", "i1", any);
    await client.commercial.chooseVenueScoutingPreference("e1", any);
    await client.commercial.choosePresentationSlot("e/1", "m/1", { startsAt: "2026-12-01T09:00:00.000Z" } as never);
    await client.commercial.createClientOwnedSupplier("e1", any);
    await client.commercial.confirmClientOwnedSupplier("e1", "s/1");
    await client.clientPortal.closeout("e1");
    await client.clientPortal.acknowledgeWrapUp("e1", any);
    await client.clientPortal.acknowledgeDeliverable("e1", "d1", any);
    await client.clientPortal.submitCloseoutResponse("e1", any);
    await client.clientPortal.revokeTestimonialConsent("e1");
    await client.clientPortal.floorplanReview("e1", "d1");
    await client.clientPortal.decideFloorplan("e1", "d1", any);
    await client.clientPortal.annotateFloorplan("e1", "d1", any);
    await client.clientPortal.submitOcularVisit("e1", any);
    await client.clientPortal.submitBriefing("e1", any);
    await client.clientPortal.createFloorplanPreference("e1", any);
    await client.clientPortal.floorplanSnapshot("e/1", "d/1", "approved");
    await client.clientPortal.sharedFloorplans();
    await client.clientPortal.conformeExecutions();
    await client.clientPortal.signConforme(any);
    await client.clientPortal.saveInquiryDraft("t/1", any);
    await client.clientPortal.inquiryDraft("t/1");
    await client.clientPortal.discardInquiryDraft("t/1");
    await client.clientPortal.inquiryEdit("t/2");
    await client.clientPortal.saveInquiryEdit("t/2", any);

    const sent = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url).replace("https://api.example.test/api", "")}`);
    expect(sent).toEqual([
      "POST /events/e1/billing-disputes",
      "POST /events/e1/client-review-items/i1/decisions",
      "POST /events/e1/venue-scouting/preference",
      "POST /events/e%2F1/presentation-meetings/m%2F1/choice",
      "POST /events/e1/client-owned-suppliers",
      "POST /events/e1/client-owned-suppliers/s%2F1/confirm",
      "GET /events/e1/client-closeout",
      "POST /events/e1/client-closeout/acknowledgement",
      "POST /events/e1/client-closeout/deliverables/d1/acknowledgement",
      "POST /events/e1/client-closeout/response",
      "POST /events/e1/client-closeout/testimonial-consent/revoke",
      "GET /events/e1/floorplans/d1/client-review",
      "POST /events/e1/floorplans/d1/client-review",
      "POST /events/e1/floorplans/d1/client-annotations",
      "POST /events/e1/ocular-visit",
      "POST /events/e1/briefing",
      "POST /events/e1/floorplan-preferences",
      "GET /events/e%2F1/floorplans/d%2F1/snapshot?type=approved",
      "GET /client/shared-floorplans",
      "GET /client/conforme-execution",
      "POST /client/conforme-execution/sign",
      "PUT /public-inquiries/drafts/t%2F1",
      "GET /public-inquiries/drafts/t%2F1",
      "DELETE /public-inquiries/drafts/t%2F1",
      "GET /public-inquiries/edit/t%2F2",
      "PATCH /public-inquiries/edit/t%2F2",
    ]);
  });

  it("sends ticket, venue, meeting, follow-up, risk, accreditation, floorplan-access, booking, replacement and QR requests to their endpoints", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api", getAuthToken: () => "token" });
    const any = {} as never;

    await client.commercial.externalCreativeTickets("e1");
    await client.commercial.createExternalCreativeTicket("e1", any);
    await client.commercial.updateExternalCreativeTicket("e1", "t1", any);
    await client.commercial.completeExternalCreativeTicket("e1", "t1", any);
    await client.commercial.venueScouting("e1");
    await client.commercial.addVenueScoutingOption("e1", any);
    await client.commercial.withdrawVenueScoutingOption("e1", "o1");
    await client.commercial.publishVenueScouting("e1");
    await client.commercial.presentationMeetings("e/1");
    await client.commercial.proposePresentationMeeting("e1", any);
    await client.commercial.recordPresentationOutcome("e1", "m/1", any);
    await client.commercial.unresponsiveSuppliers("e1");
    await client.commercial.clientOwnedSuppliers("e1");
    await client.commercial.raiseClientSupplierRisk("e1", "s/1", any);
    await client.risks.list("e1");
    await client.risks.loadStandard("e1");
    await client.risks.create("e1", any);
    await client.risks.update("e1", "r1", any);
    await client.compliance.accreditationRequirements("e1");
    await client.compliance.createAccreditationRequirement("e1", any);
    await client.compliance.updateAccreditationRequirement("e1", "a1", any);
    await client.floorplans.clientAccess("e/1");
    await client.floorplans.searchClientCandidates("e1", "ana reyes");
    await client.floorplans.grantClientAccess("e1", "u1");
    await client.floorplans.revokeClientAccess("e1", "u/1");
    await client.closure.logisticsBookings("e1");
    await client.closure.createLogisticsBooking("e1", any);
    await client.staffing.replacementRecommendations("e1");
    await client.staffing.decideReplacement("e1", "x1", any);
    await client.guest.qrPasses("e1");
    await client.guest.issueQrPasses("e1");
    await client.guest.qrCheckIn("e1", any);

    const sent = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url).replace("https://api.example.test/api", "")}`);
    expect(sent).toEqual([
      "GET /events/e1/external-creative-tickets",
      "POST /events/e1/external-creative-tickets",
      "PATCH /events/e1/external-creative-tickets/t1",
      "POST /events/e1/external-creative-tickets/t1/complete",
      "GET /events/e1/venue-scouting",
      "POST /events/e1/venue-scouting/options",
      "POST /events/e1/venue-scouting/options/o1/withdraw",
      "POST /events/e1/venue-scouting/publish",
      "GET /events/e%2F1/presentation-meetings",
      "POST /events/e1/presentation-meetings",
      "POST /events/e1/presentation-meetings/m%2F1/outcome",
      "GET /events/e1/unresponsive-suppliers",
      "GET /events/e1/client-owned-suppliers",
      "POST /events/e1/client-owned-suppliers/s%2F1/risk-warning",
      "GET /events/e1/risks",
      "POST /events/e1/risks/standard",
      "POST /events/e1/risks",
      "PATCH /events/e1/risks/r1",
      "GET /events/e1/accreditation",
      "POST /events/e1/accreditation",
      "PATCH /events/e1/accreditation/a1",
      "GET /events/e%2F1/client-floorplan-access",
      "GET /events/e1/client-floorplan-access/candidates?query=ana+reyes",
      "POST /events/e1/client-floorplan-access",
      "DELETE /events/e1/client-floorplan-access/u%2F1",
      "GET /events/e1/logistics-bookings",
      "POST /events/e1/logistics-bookings",
      "GET /events/e1/coordinator-replacements",
      "POST /events/e1/coordinator-replacements/x1/decision",
      "GET /guest/events/e1/qr-passes",
      "POST /guest/events/e1/qr-passes",
      "POST /guest/events/e1/qr-check-in",
    ]);
    // Granting access names the user in the body, which is how the API finds who to add.
    expect(JSON.parse(String(fetchMock.mock.calls[23]?.[1]?.body))).toEqual({ userId: "u1" });
  });

  it("sends coordinator, supplier directory, advisory, Canva and PARE requests to their endpoints, and passes an abort signal on", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api", getAuthToken: () => "token" });
    const any = {} as never;
    const controller = new AbortController();

    await client.coordinator.focusRoleView({ signal: controller.signal });
    await client.coordinator.roleView("e1");
    await client.coordinator.acknowledgeAssignment("e1", "a1", any);
    await client.coordinator.withdrawAssignment("e1", "a1", any);
    await client.coordinator.reportSupplierStatus("e1", "r1", any);
    await client.coordinator.roleBriefs("e1");
    await client.coordinator.saveRoleBrief("e1", "Registration Lead" as never, any);
    await client.lifecycle.startEventDay("e1");
    await client.commercial.supplierGaps("e1");
    await client.commercial.acknowledgeSupplierGap("e1", "cat1", any);
    await client.commercial.supplierSchedules("e/1");
    await client.commercial.supplierCategories();
    await client.commercial.supplierDirectory({ q: "bloom", page: 0, pageSize: 25, rating: "" } as never, { signal: controller.signal });
    await client.commercial.supplierProfile("s/1", { period: "all" } as never);
    await client.commercial.supplierReviews("s1", { page: 0 } as never);
    await client.commercial.supplierCertifications("s1", {} as never);
    await client.commercial.supplierRecords("s1", { period: "30d" } as never);
    await client.commercial.supplierEngagements("s1", { page: 1 } as never);
    await client.advisory.compliance({ eventId: "e1" } as never);
    await client.advisory.themes({ eventId: "e1" } as never);
    await client.advisory.eventIntelligence({ eventId: "e1" } as never);
    await client.advisory.eventDayCopilot({ eventId: "e1" } as never);
    await client.advisory.askAssistant("e/1", any);
    await client.advisory.supplierReliabilityScore("s/1");
    await client.canva.status();
    await client.canva.authorize();
    await client.canva.disconnect();
    await client.canva.proposalDesign("e1");
    await client.canva.testimonialDesign("e1");
    await client.pare.pending();
    await client.pare.approve("p1");
    await client.pare.reject("p1");

    const sent = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url).replace("https://api.example.test/api", "")}`);
    expect(sent).toEqual([
      "GET /coordinator/focus-role-view",
      "GET /coordinator/events/e1/role-view",
      "PATCH /events/e1/coordinators/a1/acknowledge",
      "PATCH /events/e1/coordinators/a1/withdraw",
      "PATCH /events/e1/supplier-status/r1/report",
      "GET /events/e1/coordinator-role-briefs",
      "PUT /events/e1/coordinator-role-briefs/Registration%20Lead",
      "POST /events/e1/start-event-day",
      "GET /events/e1/supplier-gaps",
      "POST /events/e1/supplier-gaps/cat1/acknowledge",
      "GET /events/e%2F1/supplier-schedules",
      "GET /suppliers/categories",
      "GET /suppliers/directory?q=bloom&page=0&pageSize=25",
      "GET /suppliers/s%2F1/profile?period=all",
      "GET /suppliers/s1/reviews?page=0",
      "GET /suppliers/s1/certifications",
      "GET /suppliers/s1/records?period=30d",
      "GET /pmcm/suppliers/s1/engagements?page=1",
      "POST /ai-advisory/compliance",
      "POST /ai-advisory/themes",
      "POST /ai-advisory/event-intelligence",
      "POST /ai-advisory/event-day-copilot",
      "POST /ai-advisory/events/e%2F1/assistant",
      "GET /suppliers/s%2F1/reliability-score",
      "GET /integrations/canva",
      "POST /integrations/canva/authorize",
      "DELETE /integrations/canva",
      "POST /events/e1/proposal/canva",
      "POST /events/e1/client-closeout/testimonial/canva",
      "GET /ai/pare/pending",
      "PATCH /ai/pare/p1/approve",
      "PATCH /ai/pare/p1/reject",
    ]);
    // The abort signal reaches fetch, so a screen can cancel a read, and the start-day body is empty.
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    expect(fetchMock.mock.calls[12]?.[1]?.signal).toBe(controller.signal);
    expect(JSON.parse(String(fetchMock.mock.calls[7]?.[1]?.body))).toEqual({});
  });

  it("sends proposal, cost estimate, client review and client message requests to their endpoints", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { commercial } = createEventOpsClient({ baseUrl: "https://api.example.test/api", getAuthToken: () => "token" });
    const any = {} as never;

    await commercial.proposal("e1");
    await commercial.createCostEstimate("e1", any);
    await commercial.issueProposalVersion("e1", any);
    await commercial.selectedQuoteLines("e1");
    await commercial.previousCostEstimates("e1");
    await commercial.draftProposalWording(any);
    await commercial.proposalComments("e1");
    await commercial.addProposalComment("e1", any);
    await commercial.clientReviewItems("e1");
    await commercial.issueClientReviewItem("e1", any);
    await commercial.clientMessageTriggers("e1");
    await commercial.draftClientMessage(any);
    await commercial.sendClientMessage(any);

    const sent = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url).replace("https://api.example.test/api", "")}`);
    expect(sent).toEqual([
      "GET /events/e1/proposal",
      "POST /events/e1/cost-estimates",
      "POST /events/e1/proposal/versions",
      "GET /events/e1/cost-estimates/supplier-quote-lines",
      "GET /events/e1/cost-estimates/previous",
      "POST /proposal-drafts",
      "GET /events/e1/proposal/comments",
      "POST /events/e1/proposal/comments",
      "GET /events/e1/client-review-items",
      "POST /events/e1/client-review-items",
      "GET /events/e1/client-message-triggers",
      "POST /client-message-drafts",
      "POST /client-message-drafts/send",
    ]);
  });

  it("sends audit, privacy and retention requests with the filters the operator set and nothing else", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api", getAuthToken: () => "token" });
    const any = {} as never;

    await client.audit.integrity();
    await client.audit.logs({ category: "all", actor: "Maxine", eventId: "" } as never);
    await client.audit.logs({} as never);
    await client.audit.exportLogs({ category: "finance" } as never);
    await client.audit.alerts();
    await client.audit.loginHistory("u1");
    await client.audit.privacyInventory("all");
    await client.audit.privacyInventory("e 1");
    await client.privacyAdmin.requests({ status: "open", page: 2, limit: 25, assignedTo: "" } as never);
    await client.privacyAdmin.requests();
    await client.privacyAdmin.createRequest(any);
    await client.privacyAdmin.assignRequest("r1", any);
    await client.privacyAdmin.reviewRequest("r1", any);
    await client.privacyAdmin.executeRequest("r1", "done");
    await client.privacyAdmin.executeRequest("r1", "fixed", { name: "New" } as never);
    await client.privacyAdmin.legalHolds();
    await client.privacyAdmin.legalHolds("e1");
    await client.privacyAdmin.createLegalHold(any);
    await client.privacyAdmin.releaseLegalHold("h1", any);
    await client.privacyAdmin.retentionPolicies();
    await client.privacyAdmin.updateRetentionPolicy("guest records", any);
    await client.privacyAdmin.retentionReviewItems({ status: "pending", limit: 20, after: "cur" } as never);
    await client.privacyAdmin.executeRetentionReviewItem("i/1", any);
    await client.privacyAdmin.dismissRetentionReviewItem("i1", any);

    const sent = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url).replace("https://api.example.test/api", "")}`);
    expect(sent).toEqual([
      "GET /audit/integrity",
      "GET /audit/logs?actor=Maxine",
      "GET /audit/logs",
      "POST /audit/export",
      "GET /audit/alerts",
      "GET /auth/users/u1/login-history",
      "GET /privacy/inventory",
      "GET /privacy/inventory?eventId=e+1",
      "GET /privacy/requests?status=open&page=2&limit=25",
      "GET /privacy/requests",
      "POST /privacy/requests",
      "PATCH /privacy/requests/r1/assignment",
      "PATCH /privacy/requests/r1/review",
      "POST /privacy/requests/r1/execute",
      "POST /privacy/requests/r1/execute",
      "GET /privacy/legal-holds",
      "GET /privacy/legal-holds?eventId=e1",
      "POST /privacy/legal-holds",
      "POST /privacy/legal-holds/h1/release",
      "GET /privacy/retention-policies",
      "PATCH /privacy/retention-policies/guest%20records",
      "GET /privacy/retention-review-items?status=pending&limit=20&after=cur",
      "POST /privacy/retention-review-items/i%2F1/execute",
      "POST /privacy/retention-review-items/i1/dismiss",
    ]);
    // A correction is sent only when there is one.
    expect(JSON.parse(String(fetchMock.mock.calls[13]?.[1]?.body))).toEqual({ executionNotes: "done" });
    expect(JSON.parse(String(fetchMock.mock.calls[14]?.[1]?.body))).toEqual({ executionNotes: "fixed", correction: { name: "New" } });
  });

  it("sends inquiry intake, notes, conforme execution, triage and event storage requests to their endpoints", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api", getAuthToken: () => "token" });
    const any = {} as never;

    await client.inquiries.setIntakePath("i1", any);
    await client.inquiries.setLanguage("i/1", any);
    await client.inquiries.companyNameChanges("i1");
    await client.inquiries.updateCompanyName("i1", any);
    await client.inquiries.contextNotes("i1");
    await client.inquiries.addContextNote("i1", any);
    await client.inquiries.preConformeContext("e1");
    await client.inquiries.existingPreConformeWorkspace("i1");
    await client.inquiries.createPreConformeWorkspace("i1");
    await client.inquiries.latestConformeExecution("i1");
    await client.inquiries.createConformeExecution("i1", any);
    await client.inquiries.signConformeExecution("i1", "x/1", any);
    await client.inquiries.triageReview("i1");
    await client.inquiries.runTriage("i1");
    await client.events.storageObjects("e/1");

    const sent = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url).replace("https://api.example.test/api", "")}`);
    expect(sent).toEqual([
      "PATCH /inquiries/i1/intake-path",
      "PATCH /inquiries/i%2F1/language",
      "GET /inquiries/i1/company-name-changes",
      "PATCH /inquiries/i1/company-name",
      "GET /inquiries/i1/context-notes",
      "POST /inquiries/i1/context-notes",
      "GET /events/e1/pre-conforme-context",
      "GET /inquiries/i1/pre-conforme-workspace",
      "POST /inquiries/i1/pre-conforme-workspace",
      "GET /inquiries/i1/conforme-executions/latest",
      "POST /inquiries/i1/conforme-executions",
      "POST /inquiries/i1/conforme-executions/x%2F1/sign",
      "GET /inquiry-triage/i1",
      "POST /inquiry-triage",
      "GET /storage/objects/events/e%2F1",
    ]);
    // The triage run names the inquiry in its body, which is how the API finds it.
    expect(JSON.parse(String(fetchMock.mock.calls[13]?.[1]?.body))).toEqual({ inquiryId: "i1" });
    expect(fetchMock.mock.calls.every(([, init]) => (init?.headers as Record<string, string>).Authorization === "Bearer token")).toBe(true);
  });

  it("sends closure reads and writes, compliance runs and risks, decisions and status reads to their endpoints", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api", getAuthToken: () => "token" });
    const any = {} as never;

    await client.closure.compareArchived(["e1", "e2"]);
    await client.closure.completePostEventDocument("e/1", "d1");
    await client.closure.logisticsCompletion("e1");
    await client.closure.recordLogisticsCompletion("e1", any);
    await client.closure.clientCloseoutModeration("e1");
    await client.closure.moderateClientCloseout("e1", any);
    await client.compliance.runs("e1");
    await client.compliance.risks("e1");
    await client.compliance.createRisk("e1", any);
    await client.lifecycle.defenseReadiness("e1");
    await client.lifecycle.eventDayStatusFeed("e1");
    await client.lifecycle.cancellationSummary("e1");
    await client.lifecycle.venueConfirmations("e1");
    await client.lifecycle.resolveVenueConfirmation("e1", "t1", any);
    await client.floorplans.history("e/1", "d/1");
    await client.auth.approvalRequests();

    const sent = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url).replace("https://api.example.test/api", "")}`);
    expect(sent).toEqual([
      "GET /events/archive/compare?eventIds=e1%2Ce2",
      "PATCH /events/e%2F1/post-event-documents/d1/complete",
      "GET /events/e1/logistics-completion",
      "POST /events/e1/logistics-completion",
      "GET /events/e1/client-closeout/moderation",
      "PATCH /events/e1/client-closeout/moderation",
      "GET /events/e1/compliance/runs",
      "GET /events/e1/compliance/risks",
      "POST /events/e1/compliance/risks",
      "GET /events/e1/defense-readiness",
      "GET /events/e1/event-day/status-feed",
      "GET /events/e1/decisions/cancellation-summary",
      "GET /events/e1/decisions/venue-confirmations",
      "POST /events/e1/decisions/venue-confirmations/t1/resolve",
      "GET /events/e%2F1/floorplans/d%2F1/history",
      "GET /auth/approval-requests",
    ]);
  });

  it("sends event and inquiry lifecycle, staffing and supplier-status commands to their endpoints", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api", getAuthToken: () => "token" });
    const any = {} as never;

    await client.lifecycle.scheduleOcularVisit("e1", any);
    await client.lifecycle.completeOcularVisit("e1");
    await client.lifecycle.waiveOcularVisit("e1", any);
    await client.lifecycle.setModules("e1", any);
    await client.lifecycle.setPrivacy("e1", any);
    await client.lifecycle.setClientEventDayView("e1", any);
    await client.lifecycle.archive("e1", "reason");
    await client.lifecycle.recordActualEnd("e1", any);
    await client.inquiries.updateStatus("i1", { status: "pending" } as never);
    await client.inquiries.merge("i1", { sourceInquiryId: "i2", reason: "duplicate" });
    await client.inquiries.logOnBehalf(any);
    await client.inquiries.sendConformeReminder("i1");
    await client.inquiries.uploadConforme("i1", any);
    await client.staffing.reliabilityHistory("c/1");
    await client.staffing.assign("e1", any);
    await client.staffing.replace("e1", "a1", any);
    await client.staffing.poolAvailability("e1");
    await client.staffing.listAvailability("e1", "c1");
    await client.staffing.createAvailability("e1", "c1", any);
    await client.staffing.deleteAvailability("e1", "c1", "v1");
    await client.staffing.upsertCoverage("e1", any);
    await client.commercial.verifySupplierStatus("e1", "r1", any);

    const sent = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url).replace("https://api.example.test/api", "")}`);
    expect(sent).toEqual([
      "PATCH /events/e1/ocular-visit/schedule",
      "POST /events/e1/ocular-visit/complete",
      "POST /events/e1/ocular-visit/waive",
      "PATCH /events/e1/modules",
      "PATCH /events/e1/privacy",
      "PATCH /events/e1/client-event-day-view",
      "POST /events/e1/archive",
      "POST /events/e1/actual-end",
      "PATCH /inquiries/i1/status",
      "POST /inquiries/i1/merge",
      "POST /inquiries/log-on-behalf",
      "POST /inquiries/i1/conforme-reminders",
      "POST /inquiries/i1/conforme",
      "GET /pmcm/coordinators/c%2F1/reliability-history",
      "POST /events/e1/coordinators",
      "POST /events/e1/coordinators/a1/replace",
      "GET /events/e1/staffing/pool-availability",
      "GET /events/e1/coordinators/c1/availability",
      "POST /events/e1/coordinators/c1/availability",
      "DELETE /events/e1/coordinators/c1/availability/v1",
      "POST /events/e1/staffing/coverage",
      "PATCH /events/e1/supplier-status/r1/verify",
    ]);
    // Archiving sends its override reason under the field name the API reads, even when none is given.
    expect(JSON.parse(String(fetchMock.mock.calls[6]?.[1]?.body))).toEqual({ overrideReason: "reason" });
  });

  it("sends closure, compliance, floorplan and approval-request commands to their endpoints", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api", getAuthToken: () => "token" });
    const any = {} as never;

    await client.closure.closeGates("e1");
    await client.closure.insights("e1");
    await client.closure.generateInsights("e1");
    await client.closure.wrapUp("e1");
    await client.closure.startWrapUp("e1", any);
    await client.closure.updateWrapUp("e1", any);
    await client.compliance.createRule(any);
    await client.compliance.resolve("e1", "c1", any);
    await client.compliance.run("e1", { phase: "planning" } as never);
    await client.floorplans.createDraft("e1", any);
    await client.floorplans.submitDraft("e1", "d1");
    await client.floorplans.approveDraft("e1", "d1");
    await client.floorplans.reopenPreference("e1", "d1");
    await client.floorplans.plan("p1");
    await client.floorplans.savePlan("p1", { venue: "Hall" });
    await client.auth.approveApprovalRequest("r/1");
    await client.auth.declineApprovalRequest("r1");

    const sent = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url).replace("https://api.example.test/api", "")}`);
    expect(sent).toEqual([
      "GET /events/e1/close-gates",
      "GET /events/e1/insights",
      "POST /events/e1/insights/generate",
      "GET /events/e1/wrap-up",
      "POST /events/e1/wrap-up",
      "PATCH /events/e1/wrap-up",
      "POST /compliance/rules",
      "PATCH /events/e1/compliance/c1",
      "POST /events/e1/compliance",
      "POST /events/e1/floorplans",
      "POST /events/e1/floorplans/d1/submit",
      "POST /events/e1/floorplans/d1/approve",
      "POST /events/e1/floorplans/d1/reopen-preference",
      "GET /plans/p1",
      "PUT /plans/p1",
      "PATCH /auth/approval-requests/r%2F1/approve",
      "PATCH /auth/approval-requests/r1/decline",
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[14]?.[1]?.body))).toEqual({ venue: "Hall" });
    expect(fetchMock.mock.calls.every(([, init]) => (init?.headers as Record<string, string>).Authorization === "Bearer token")).toBe(true);
  });

  it("routes the event-day operator, escalation and issue commands to their API endpoints", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api", getAuthToken: () => "token" });

    await client.liveOps.operatorDesignation("evt 1");
    await client.liveOps.revokeOperator("evt 1");
    await client.liveOps.escalateTask("evt 1", "task-1", { reason: "Late" } as never);
    await client.liveOps.updateUrgentIssue("evt 1", "issue-1", { status: "resolved" } as never);
    await client.liveOps.escalateUrgentIssue("evt 1", "issue-1", { reason: "Unsafe" } as never);

    const calls = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`);
    expect(calls).toEqual([
      "GET https://api.example.test/api/events/evt 1/operator-designation",
      "DELETE https://api.example.test/api/events/evt 1/operator-designation",
      "POST https://api.example.test/api/events/evt 1/event-day/tasks/task-1/escalate",
      "PATCH https://api.example.test/api/events/evt 1/urgent-issues/issue-1",
      "POST https://api.example.test/api/events/evt 1/urgent-issues/issue-1/escalate",
    ]);
  });

  it("sends every commercial command to its endpoint with the body the API expects", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { commercial } = createEventOpsClient({ baseUrl: "https://api.example.test/api", getAuthToken: () => "token" });
    const any = {} as never;

    await commercial.createBillingSource("e1", any);
    await commercial.approveBillingSource("e1", "src1", "ok");
    await commercial.generateBillingStatement("e1", "src1");
    await commercial.sendBillingStatement("e1", "bill1");
    await commercial.recordPayment("e1", "m1", any);
    await commercial.markPayment("e1", "m1", any);
    await commercial.createBillingDispute("e1", any);
    await commercial.resolveBillingDispute("e1", "d1", any);
    await commercial.requestBillingCorrection("e1", any);
    await commercial.resolveBillingCorrection("e1", "c1", any);
    await commercial.createAdditionalBilling("e1", any);
    await commercial.waiveAdditionalBilling("e1", "a1", any);
    await commercial.createSupplier(any);
    await commercial.updateSupplier("s/1", any);
    await commercial.changeSupplierTier("s/1", any);
    await commercial.promoteSupplier("s1", any);
    await commercial.addSupplierCertification("s1", any);
    await commercial.addSupplierReliabilityNote("s1", any);
    await commercial.addSupplierReview("s1", any);
    await commercial.setSupplierAvailability("s1", any);
    await commercial.requestSupplierQuotes("e1", any);
    await commercial.withdrawQuoteRequest("e1", "r1");
    await commercial.compareQuoteRound("e1", "round 1");
    await commercial.selectSupplierQuote("e1", "q1");

    const sent = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url).replace("https://api.example.test/api", "")}`);
    expect(sent).toEqual([
      "POST /events/e1/billing-source",
      "PATCH /events/e1/billing-source/src1/approve",
      "POST /events/e1/billing-statements/generate",
      "POST /events/e1/billing-statements/bill1/send",
      "POST /events/e1/payments/m1/records",
      "PATCH /events/e1/payments/m1",
      "POST /events/e1/billing-disputes",
      "PATCH /events/e1/billing-disputes/d1",
      "POST /events/e1/billing-corrections",
      "PATCH /events/e1/billing-corrections/c1",
      "POST /events/e1/additional-billing",
      "PATCH /events/e1/additional-billing/a1/waive",
      "POST /suppliers",
      "PATCH /suppliers/s%2F1",
      "PATCH /suppliers/s%2F1/tier",
      "POST /suppliers/s1/promote",
      "POST /suppliers/s1/certifications",
      "POST /suppliers/s1/reliability-notes",
      "POST /suppliers/s1/reviews",
      "POST /suppliers/s1/availability",
      "POST /events/e1/quote-requests",
      "PATCH /events/e1/quote-requests/r1/withdraw",
      "GET /events/e1/quote-rounds/round%201/comparison",
      "PATCH /events/e1/supplier-quotes/q1/select",
    ]);
    // The API reads these two bodies by field name, so an omitted argument must still send the field.
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ approvalNotes: "ok" });
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({ sourceId: "src1" });
    expect(fetchMock.mock.calls.every(([, init]) => (init?.headers as Record<string, string>).Authorization === "Bearer token")).toBe(true);
  });

  it("tells the user the API is unreachable when the request cannot be sent, through the client too, but lets a cancel through", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api", getAuthToken: () => "token" });

    await expect(prismRequest("/health", { baseUrl: "https://api.example.test/api" })).rejects.toBeInstanceOf(PrismApiOfflineError);
    await expect(client.events.list()).rejects.toThrow(PRISM_API_OFFLINE_MESSAGE);

    const abort = new DOMException("The operation was aborted.", "AbortError");
    vi.stubGlobal("fetch", vi.fn(async () => { throw abort; }));
    await expect(prismRequest("/health", { baseUrl: "https://api.example.test/api" })).rejects.toBe(abort);
  });

  it("sends event-game host commands to the scoped API route with bearer auth", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: "live" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({
      baseUrl: "https://api.example.test/api",
      getAuthToken: () => "verified-role-session",
    });

    await client.eventGames.executeHostCommand("event-1", "session-1", {
      command: "start",
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/events/event-1/game-sessions/session-1/commands",
      {
        method: "POST",
        body: JSON.stringify({ command: "start", idempotencyKey: "00000000-0000-4000-8000-000000000001" }),
        headers: { "Content-Type": "application/json", Authorization: "Bearer verified-role-session" },
      },
    );
  });

  it("keeps a route's own query intact when actor context is added", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api" });

    await client.communication.listThreads("evt_1", { actorRole: "supplier", actorName: "Ops" });

    // A second `?` turned the event ID into `evt_1?actorRole=supplier`, which the API reported as "Event not found".
    const url = new URL(String((fetchMock.mock.calls[0] as unknown as [string])[0]));
    expect(url.searchParams.get("eventId")).toBe("evt_1");
    expect(url.searchParams.get("actorRole")).toBe("supplier");
  });

  it("returns the one-time typed host PIN issue result", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      eventId: "event-1",
      resourceType: "session",
      resourceId: "session-1",
      action: "enable_joins",
      outcome: "joins_enabled",
      resultId: "session-1",
      requestReceiptId: "digest-only-receipt",
      transition: { beforeStatus: "closed", afterStatus: "open", beforeVersion: null, afterVersion: null },
      pin: "042681",
      expiresAt: "2026-10-17T12:00:00.000Z",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({
      baseUrl: "https://api.example.test/api",
      getAuthToken: () => "verified-role-session",
    });

    const result = await client.eventGames.executeHostCommand("event-1", "session-1", {
      command: "enable-joins",
      idempotencyKey: "00000000-0000-4000-8000-000000000004",
    });

    expect(result.action).toBe("enable_joins");
    if (result.action === "enable_joins") {
      expect(result.pin).toBe("042681");
      expect(result.expiresAt).toBe("2026-10-17T12:00:00.000Z");
    }
  });

  it("joins multiplayer by PIN without organizer auth and sends a retained credential only as a header", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      eventId: "event-1",
      sessionId: "session-1",
      game: { title: "Opening Trivia", kind: "live-trivia" },
      status: "lobby",
      participantCredential: "A".repeat(43),
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api" });
    const input = { idempotencyKey: "00000000-0000-4000-8000-000000000001", pin: "042681" };

    await client.eventGames.joinActiveMultiplayerGameSession(input);
    await client.eventGames.joinActiveMultiplayerGameSession(input, "R".repeat(43));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.example.test/api/game-sessions/join", {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.example.test/api/game-sessions/join", {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json", "x-prism-game-credential": "R".repeat(43) },
    });
  });

  it("rejects a malformed successful PIN join response", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      sessionId: "session-1",
      game: { title: "Opening Trivia", kind: "live-trivia" },
      status: "lobby",
    }), { status: 200 })));
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api" });

    await expect(client.eventGames.joinActiveMultiplayerGameSession({
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      pin: "042681",
    })).rejects.toBeInstanceOf(PrismContractError);
  });

  it("surfaces the same generic unavailable message returned for rejected PIN joins", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      statusCode: 404,
      message: "Game session could not be joined",
    }), { status: 404 })));
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api" });

    await expect(client.eventGames.joinActiveMultiplayerGameSession({
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      pin: "042681",
    })).rejects.toMatchObject({ name: "PrismApiError", status: 404, message: "Game session could not be joined" });
  });

  it("submits a participant action with its credential in a header only", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      sessionId: "session-1",
      game: { title: "Opening Trivia", kind: "live-trivia" },
      status: "live",
      startedAt: "2026-10-16T12:00:00.000Z",
      currentRound: { key: 'round-1', number: 1, total: 5 },
      currentPrompt: "Question?",
      participant: { hasSubmitted: true, score: 20 },
      aggregateResults: [],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api" });
    const input = { roundKey: "round-1", actionKind: "answer" as const, payload: { answer: "B" } };
    const credential = "C".repeat(43);

    await client.eventGames.submitAction("session-1", input, credential);

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/api/game-sessions/session-1/actions", {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json", "x-prism-game-credential": credential },
    });
  });

  it("loads participant state with the exact session credential and no organizer identity", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api" });
    const credential = "G".repeat(43);

    await client.eventGames.getParticipantState("session-1", credential);

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/api/game-sessions/session-1/state", {
      headers: { "Content-Type": "application/json", "x-prism-game-credential": credential },
    });
  });

  it("requests participant game media with the session credential and no organizer identity", async () => {
    vi.stubGlobal("window", undefined);
    const response = {
      downloadUrl: "https://storage.example.test/signed-image",
      expiresAt: "2026-10-16T12:05:00.000Z",
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "https://api.example.test/api" });
    const credential = "M".repeat(43);
    const objectId = TEST_FIXTURES.gameMediaObjectId;

    await expect(client.eventGames.getParticipantMediaAuthorization("session-1", objectId, credential))
      .resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/api/game-sessions/session-1/media/${objectId}/download-authorization`,
      {
        headers: { "Content-Type": "application/json", "x-prism-game-credential": credential },
      },
    );
  });

  it("keeps moderation and awards on verified event-scoped organizer routes", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({
      baseUrl: "https://api.example.test/api",
      getAuthToken: () => "verified-role-session",
    });
    const moderation = {
      action: "hide_submission" as const,
      idempotencyKey: TEST_FIXTURES.primaryId,
      submissionId: TEST_FIXTURES.secondId,
      reason: "Contains personal information",
    };
    const award = {
      idempotencyKey: TEST_FIXTURES.primaryId,
      recipient: { type: "participant" as const, participationGrantId: TEST_FIXTURES.secondId },
      awardKind: "points" as const,
      label: "Round winner",
      points: 25,
    };

    await client.eventGames.moderate("event-1", "session-1", moderation);
    await client.eventGames.assignAward("event-1", "session-1", award);

    const [moderationUrl, moderationRequest] = fetchMock.mock.calls[0] ?? [];
    const [awardUrl, awardRequest] = fetchMock.mock.calls[1] ?? [];
    expect(moderationUrl).toBe("https://api.example.test/api/events/event-1/game-sessions/session-1/moderation");
    expect(moderationRequest).toMatchObject({ method: "POST", body: JSON.stringify(moderation) });
    expect(new Headers(moderationRequest?.headers).get("authorization")).toMatch(/^Bearer /);
    expect(awardUrl).toBe("https://api.example.test/api/events/event-1/game-sessions/session-1/awards");
    expect(awardRequest).toMatchObject({ method: "POST", body: JSON.stringify(award) });
    expect(new Headers(awardRequest?.headers).get("authorization")).toMatch(/^Bearer /);
  });

  it("loads PMCM response history with scoped pagination and bearer auth", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      sessionId: "session-1",
      items: [],
      limit: 25,
      nextCursor: null,
      hasMore: false,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const authToken = "verified-role-session";
    const client = createEventOpsClient({
      baseUrl: "https://api.example.test/api",
      getAuthToken: () => authToken,
    });

    await client.eventGames.getResponseHistory("event-1", "session-1", {
      limit: 25,
      cursor: "cursor:2",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      "https://api.example.test/api/events/event-1/game-sessions/session-1/responses?limit=25&cursor=cursor%3A2",
    );
    expect(request).toMatchObject({
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    });
  });

  it("requests event-scoped game analytics with the verified host session", async () => {
    vi.stubGlobal("window", undefined);
    const analytics = {
      eventId: "event/1",
      totals: {
        gamesCreated: 2,
        sessionsStarted: 2,
        sessionsCompleted: 1,
        distinctEventParticipants: 3,
        participantJoins: 4,
        roundsAnswered: 8,
        completionRate: 0.5,
      },
      sessions: [],
      participationOverTime: [],
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(analytics), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const authToken = "verified-role-session";
    const client = createEventOpsClient({
      baseUrl: "https://api.example.test/api",
      getAuthToken: () => authToken,
    });

    await expect(client.eventGames.getEventAnalytics("event/1")).resolves.toEqual(analytics);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/events/event%2F1/game-analytics",
      {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      },
    );
  });

  it("keeps lobby branding requests event-scoped and bearer-authenticated", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({
      baseUrl: "https://api.example.test/api",
      getAuthToken: () => "verified-role-session",
    });

    await client.eventGames.getLobbyBranding("event/1");
    await client.eventGames.updateLobbyBranding("event/1", {
      theme: "forest",
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
    });
    await client.eventGames.requestLobbyLogoUpload("event/1", {
      fileName: "logo.png",
      contentType: "image/png",
      declaredByteSize: 3,
      checksumSha256: "a".repeat(64),
      idempotencyKey: "00000000-0000-4000-8000-000000000003",
    });
    await client.eventGames.confirmLobbyLogoUpload("event/1", TEST_FIXTURES.lobbyLogoObjectId, {
      checksumSha256: "a".repeat(64),
      byteSize: 3,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.example.test/api/events/event%2F1/game-lobby/branding", {
      headers: { "Content-Type": "application/json", Authorization: "Bearer verified-role-session" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.example.test/api/events/event%2F1/game-lobby/branding", {
      headers: { "Content-Type": "application/json", Authorization: "Bearer verified-role-session" },
      method: "PATCH",
      body: JSON.stringify({ theme: "forest", idempotencyKey: "00000000-0000-4000-8000-000000000002" }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://api.example.test/api/events/event%2F1/game-lobby/branding/logo-upload-request", {
      headers: { "Content-Type": "application/json", Authorization: "Bearer verified-role-session" },
      method: "POST",
      body: JSON.stringify({
        fileName: "logo.png",
        contentType: "image/png",
        declaredByteSize: 3,
        checksumSha256: "a".repeat(64),
        idempotencyKey: "00000000-0000-4000-8000-000000000003",
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "https://api.example.test/api/events/event%2F1/game-lobby/branding/logos/" + TEST_FIXTURES.lobbyLogoObjectId + "/confirm", {
      headers: { "Content-Type": "application/json", Authorization: "Bearer verified-role-session" },
      method: "POST",
      body: JSON.stringify({ checksumSha256: "a".repeat(64), byteSize: 3 }),
    });
  });

  it("keeps game image upload requests scoped to an editable event game", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({
      baseUrl: "https://api.example.test/api",
      getAuthToken: () => "verified-role-session",
    });
    const request = {
      fileName: "clue.png", contentType: "image/png", declaredByteSize: 512,
      checksumSha256: "a".repeat(64), idempotencyKey: "00000000-0000-4000-8000-000000000004",
    } as const;

    await client.eventGames.requestGameMediaUpload("event/1", "game/1", request);
    await client.eventGames.confirmGameMediaUpload("event/1", "game/1", TEST_FIXTURES.lobbyLogoObjectId, {
      checksumSha256: request.checksumSha256, byteSize: request.declaredByteSize,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.example.test/api/events/event%2F1/games/game%2F1/media-upload-request", {
      headers: { "Content-Type": "application/json", Authorization: "Bearer verified-role-session" },
      method: "POST", body: JSON.stringify(request),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.example.test/api/events/event%2F1/games/game%2F1/media/" + TEST_FIXTURES.lobbyLogoObjectId + "/confirm", {
      headers: { "Content-Type": "application/json", Authorization: "Bearer verified-role-session" },
      method: "POST", body: JSON.stringify({ checksumSha256: request.checksumSha256, byteSize: request.declaredByteSize }),
    });
  });

  it("keeps organizer game and session requests event-scoped and bearer-authenticated", async () => {
    vi.stubGlobal("window", undefined);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({
      baseUrl: "https://api.example.test/api",
      getAuthToken: () => "verified-role-session",
    });
    const definition = { kind: "live-trivia" as const, title: "Opening Trivia" };
    const commandOptions = {
      headers: { "Content-Type": "application/json", Authorization: "Bearer verified-role-session" },
    };

    await client.eventGames.listForEvent("event-1");
    await client.eventGames.createDraft("event-1", definition);
    await client.eventGames.getForEvent("event-1", "game-1");
    await client.eventGames.updateDraft("event-1", "game-1", { title: "Final Trivia" });
    await client.eventGames.removeUnstartedGame("event-1", "game-1");
    await client.eventGames.publishDraft("event-1", "game-1");
    await client.eventGames.createHostSession("event-1", "game-1", { gameId: "game-1" });
    await client.eventGames.getHostState("event-1", "session-1");
    await client.eventGames.ensureLobby("event-1");
    await client.eventGames.getPublicLobby("opaque-lobby-token");
    await client.eventGames.startIndependentSingleplayerGameSession("opaque-lobby-token", "game-1", {
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
      participantCredential: "A".repeat(43),
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.example.test/api/events/event-1/games", commandOptions);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.example.test/api/events/event-1/games", {
      ...commandOptions,
      method: "POST",
      body: JSON.stringify(definition),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://api.example.test/api/events/event-1/games/game-1", commandOptions);
    expect(fetchMock).toHaveBeenNthCalledWith(4, "https://api.example.test/api/events/event-1/games/game-1", {
      ...commandOptions,
      method: "PATCH",
      body: JSON.stringify({ title: "Final Trivia" }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(5, "https://api.example.test/api/events/event-1/games/game-1", {
      ...commandOptions,
      method: "DELETE",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(6, "https://api.example.test/api/events/event-1/games/game-1/publish", {
      ...commandOptions,
      method: "POST",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(7, "https://api.example.test/api/events/event-1/games/game-1/sessions", {
      ...commandOptions,
      method: "POST",
      body: JSON.stringify({ gameId: "game-1" }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(8, "https://api.example.test/api/events/event-1/game-sessions/session-1/host-state", commandOptions);
    expect(fetchMock).toHaveBeenNthCalledWith(9, "https://api.example.test/api/events/event-1/game-lobby", {
      ...commandOptions,
      method: "POST",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(10, "https://api.example.test/api/game-lobbies/opaque-lobby-token", commandOptions);
    expect(fetchMock).toHaveBeenNthCalledWith(11, "https://api.example.test/api/game-lobbies/opaque-lobby-token/games/game-1/sessions", {
      ...commandOptions,
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
        participantCredential: "A".repeat(43),
      }),
    });
  });

  it("resolves API bindings when a request runs, preserving bearer authentication", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("PRISM_API_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const client = createEventOpsClient({ getAuthToken: () => "role-session" });
    // Constructing a client during build must not capture a missing binding.
    vi.stubEnv("PRISM_API_URL", "https://internal.example.test/");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal("fetch", fetchMock);

    await client.events.list();

    expect(fetchMock).toHaveBeenCalledWith("https://internal.example.test/api/events", {
      headers: { "Content-Type": "application/json", Authorization: "Bearer role-session" },
    });
  });

  it("uses the public same-origin API in browsers even when a binding is present", async () => {
    vi.stubGlobal("window", {});
    vi.stubEnv("PRISM_API_URL", "https://internal.example.test");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    vi.stubEnv("NEXT_PUBLIC_PRISM_API_BASE_URL", "/api");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal("fetch", fetchMock);

    await createEventOpsClient().events.list();

    expect(fetchMock).toHaveBeenCalledWith("/api/events", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("keeps an explicit API target and local development defaults", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("PRISM_API_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_PRISM_API_BASE_URL", undefined);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal("fetch", fetchMock);
    await prismRequest("/events");
    vi.stubEnv("PRISM_API_URL", "https://internal.example.test");
    await prismRequest("/events", { baseUrl: "https://explicit.example.test/api" });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:4000/api/events", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://explicit.example.test/api/events", expect.any(Object));
  });

  it("builds JSON requests from a base URL and path", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await prismRequest<{ ok: boolean }>("/health", {
      baseUrl: "http://localhost:4000/api",
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/health", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("serializes request bodies as JSON", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "inq_1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await prismRequest("/inquiries", {
      method: "POST",
      body: { clientName: "Acme" },
      baseUrl: "http://localhost:4000/api",
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/inquiries", {
      method: "POST",
      body: JSON.stringify({ clientName: "Acme" }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("normalizes API problem responses for role app empty and error states", () => {
    const problem = normalizePrismApiProblem(409, {
      code: "blocked_by_gate",
      message: "Upload sessions are gated.",
      retryable: false,
      emptyReason: "blocked_by_gate",
      fieldErrors: [{ field: "file", message: "Storage adapter is not configured." }],
      auditReference: "audit_1",
    });

    expect(problem).toEqual({
      code: "blocked_by_gate",
      message: "Upload sessions are gated.",
      status: 409,
      retryable: false,
      emptyReason: "blocked_by_gate",
      fieldErrors: [{ field: "file", message: "Storage adapter is not configured.", code: undefined }],
      auditReference: "audit_1",
    });

    const error = new PrismApiError(503, "Database unavailable");
    expect(error.problem).toEqual({
      code: "api_unavailable",
      message: "Database unavailable",
      status: 503,
      retryable: true,
    });
  });

  it("throws PrismApiError with status and response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 })),
    );

    await expect(prismRequest("/events", { baseUrl: "http://localhost:4000/api" })).rejects.toMatchObject({
      name: "PrismApiError",
      status: 403,
      body: { message: "Forbidden" },
      problem: {
        code: "api_error",
        message: "Forbidden",
        status: 403,
        retryable: false,
      },
    });
  });

  it("never shows an HTML error page as the problem message", async () => {
    const page = "<!DOCTYPE html><html><body><pre>Cannot GET /events/evt_1/floorplans/fp_1/history</pre></body></html>";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(page, { status: 404, headers: { "Content-Type": "text/html" } })));

    const error = await prismRequest("/events/evt_1/history", { baseUrl: "http://localhost:4000/api" }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(PrismApiError);
    expect((error as PrismApiError).problem.message).toBe("P.R.I.S.M API request failed: 404");
    expect((error as PrismApiError).message).not.toContain("<");
  });
});

describe("toQueryString", () => {
  it("drops empty query values", () => {
    expect(toQueryString({ role: "pmcm", eventId: "", page: undefined, active: true })).toBe("role=pmcm&active=true");
  });
});

describe("createEventOpsClient", () => {
  it("sends session, current-user and recovery calls with the session token and encoded account ids", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "usr_pmcm" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({
      baseUrl: "http://localhost:4000/api",
      getAuthToken: () => "session-token",
    });
    await client.auth.me();
    await client.auth.logout();
    await client.auth.unlockUser("usr pmcm/1");
    await client.auth.resetUserTwoFactor("usr_pmcm");

    const bearer = { Authorization: "Bearer session-token", "Content-Type": "application/json" };
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:4000/api/auth/me", expect.objectContaining({ method: "GET", headers: bearer }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:4000/api/auth/logout", expect.objectContaining({ method: "POST", headers: bearer }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://localhost:4000/api/auth/users/usr%20pmcm%2F1/unlock", expect.objectContaining({ method: "PATCH", headers: bearer }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, "http://localhost:4000/api/auth/users/usr_pmcm/two-factor/reset", expect.objectContaining({ method: "PATCH", headers: bearer }));
  });

  it("posts login and approval requests through the shared auth contract", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: "If an account exists for this email, PMCM will review the request." }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.auth.login({ email: "client@example.test", password: "not-a-real-password" });
    await client.auth.requestApproval({
      email: "client@example.test",
      privacyConsentAccepted: true,
      privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:4000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "client@example.test", password: "not-a-real-password" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:4000/api/auth/approval-requests", {
      method: "POST",
      body: JSON.stringify({
        email: "client@example.test",
        privacyConsentAccepted: true,
        privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
      }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("requests a development authenticator QR without caching the credential", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ otpauthUri: "otpauth://totp/test" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });

    await expect(client.auth.developmentTwoFactorQr("challenge-token")).resolves.toEqual({ otpauthUri: "otpauth://totp/test" });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/auth/2fa/development-qr", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ token: "challenge-token" }),
      cache: "no-store",
    }));
  });

  it("posts account activation, staff invites and invitation resends to their routes", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ outcome: "invited" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api", getAuthToken: () => "session-token" });
    await client.auth.activateAccount({ token: "a".repeat(43), password: "a sufficiently long password" });
    await client.auth.inviteStaff({ email: "coord@pmcm.test", name: "Coordinator", role: "coordinator", organization: "PMCM" });
    await client.auth.resendAccountInvitation("usr pmcm/1");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:4000/api/auth/activate", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ token: "a".repeat(43), password: "a sufficiently long password" }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:4000/api/auth/invitations", expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bearer session-token", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "coord@pmcm.test", name: "Coordinator", role: "coordinator", organization: "PMCM" }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://localhost:4000/api/auth/invitations/usr%20pmcm%2F1/resend", expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bearer session-token", "Content-Type": "application/json" },
    }));
  });

  it("posts a client portal invitation resend for an inquiry", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ outcome: { outcome: "invited" }, inquiry: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api", getAuthToken: () => "session-token" });
    await client.inquiries.resendPortalInvitation("inq 1/a");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/inquiries/inq%201%2Fa/portal-invitation/resend", expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bearer session-token", "Content-Type": "application/json" },
    }));
  });

  it("posts a supplier login re-send for an approved application", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ outcome: "invited" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api", getAuthToken: () => "session-token" });
    await client.supplierApplications.resendAccountInvitation("sap 1");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/supplier-applications/sap%201/account-invitation/resend", expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bearer session-token", "Content-Type": "application/json" },
    }));
  });

  it("sends actor query params for event lists", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.events.list({ actorName: "Ms. Mys", actorRole: "pmcm" }, 'cursor-2');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/events?actorName=Ms.+Mys&actorRole=pmcm&cursor=cursor-2', {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("loads event decision history through the event contract", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.events.decisionHistory("evt_1");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/events/evt_1/decisions", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("loads event-scoped coordinator handoffs through the live-ops contract", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.liveOps.listHandoffs("evt_1");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/events/evt_1/handoffs", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("loads the PMCM handoff brief from the event-scoped read route", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ eventId: "evt_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.liveOps.handoffBrief("evt_1");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/events/evt_1/handoff-brief", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("loads the run sheet for the event and an optional encoded schedule day", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ eventId: "evt_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.liveOps.runSheet("evt_1");
    await client.liveOps.runSheet("evt_1", "day 2", { role: "coordinator" });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:4000/api/events/evt_1/run-sheet",
      "http://localhost:4000/api/events/evt_1/run-sheet?role=coordinator&dayId=day%202",
    ]);
  });

  it("loads the coordinator event schedule through the coordinator route, not the PMCM events route", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ eventId: "evt_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.coordinator.eventSchedule("evt_1");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:4000/api/coordinator/events/evt_1/schedule",
    ]);
  });

  it("loads a redacted public supplier application status without caching", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            id: "sap_1",
            companyName: "Northstar",
            status: "pending",
            submittedAt: "2026-09-01T00:00:00.000Z",
            reviewedAt: null,
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.supplierApplications.getStatus({
      applicationId: "sap_1",
      email: "ava+status@northstar.test",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/supplier-applications/status?applicationId=sap_1&email=ava%2Bstatus%40northstar.test",
      {
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  it("loads event file requirements with bearer auth and no actor query", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ eventId: "evt_1", items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({
      baseUrl: "http://localhost:4000/api",
      getAuthToken: () => "client-session-token",
    });
    await client.events.fileRequirements("evt_1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/events/evt_1/file-requirements",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer client-session-token",
        },
      },
    );
  });

  it("writes PMCM file requirement overrides as bearer-authenticated JSON with an encoded key", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ key: "venue permit" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({
      baseUrl: "http://localhost:4000/api",
      getAuthToken: () => "pmcm-session-token",
    });
    await client.events.createFileRequirement("evt_1", { key: "venue_permit", label: "Venue permit", ownerRole: "client", visibleToRoles: ["pmcm-admin", "client"], required: true, sourceWorkflow: "custom" });
    await client.events.updateFileRequirement("evt_1", "venue permit", { required: false, expectedRevision: 2 });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/api/events/evt_1/file-requirements",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer pmcm-session-token" }) }),
    );
    expect(JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toMatchObject({ key: "venue_permit", sourceWorkflow: "custom" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/events/evt_1/file-requirements/venue%20permit",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(JSON.parse(String((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body))).toEqual({ required: false, expectedRevision: 2 });
  });

  it("loads the client workspace with bearer auth and no actor query", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({
      baseUrl: "http://localhost:4000/api",
      getAuthToken: () => "client-session-token",
    });
    await client.clientWorkspace.detail();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/client/workspace",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer client-session-token",
        },
      },
    );
  });

  it('sends the client workspace cursor with bearer auth', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            events: [],
            pagination: { nextCursor: null, hasMore: false, totalCount: 0 },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createEventOpsClient({
      baseUrl: 'http://localhost:4000/api',
      getAuthToken: () => 'client-session-token',
    });
    await client.clientWorkspace.detail({}, 'cursor-2');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4000/api/client/workspace?cursor=cursor-2', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer client-session-token',
      },
    });
  });
  it("loads the client action center with bearer auth and no actor query", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({
      baseUrl: "http://localhost:4000/api",
      getAuthToken: () => "client-session-token",
    });
    await client.clientWorkspace.actionCenter();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/client/action-center",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer client-session-token",
        },
      },
    );
  });

  // PA-284: supplier reads no longer carry an actor query. Identity is taken from
  // the session bearer token, so a caller cannot assert a role it does not hold.
  it("loads scoped supplier workspace with no actor query", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ quoteRequests: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.supplierWorkspace.detail();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/supplier/workspace", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("loads supplier readiness board with no actor query", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.supplierWorkspace.readinessBoard();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/supplier/readiness-board", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("loads PMCM event supplier readiness with the session bearer token and an encoded event id", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ eventId: "evt 1", items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({
      baseUrl: "http://localhost:4000/api",
      getAuthToken: () => "pmcm-session-token",
    });
    await client.pmcm.supplierReadiness("evt 1");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/pmcm/events/evt%201/supplier-readiness", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer pmcm-session-token",
      },
    });
  });

  it("sends the supplier session bearer token on scoped supplier reads", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ quoteRequests: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({
      baseUrl: "http://localhost:4000/api",
      getAuthToken: () => "supplier-session-token",
    });
    await client.supplierWorkspace.detail();
    await client.supplierWorkspace.readinessBoard();

    for (const path of ["/supplier/workspace", "/supplier/readiness-board"]) {
      expect(fetchMock).toHaveBeenCalledWith(`http://localhost:4000/api${path}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer supplier-session-token",
        },
      });
    }
  });

  it("loads billing as a scoped read model", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ paymentMilestones: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.billing.list({ actorName: "Ms. Mys", actorRole: "pmcm-admin" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/billing?actorName=Ms.+Mys&actorRole=pmcm-admin",
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  });


  it("sends bearer tokens when configured", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api", getAuthToken: () => "signed-token" });
    await client.pmcm.reference();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/pmcm/reference", {
      headers: { "Content-Type": "application/json", Authorization: "Bearer signed-token" },
    });
  });

  it("reports a 401 only for signed-in requests, never for failed sign-in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "Invalid credentials" }), { status: 401 })),
    );
    const onUnauthorized = vi.fn();
    const client = createEventOpsClient({
      baseUrl: "http://localhost:4000/api",
      getAuthToken: () => "stale-token",
      onUnauthorized,
    });

    await expect(client.pmcm.reference()).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    await expect(
      client.auth.login({ email: "mys@pmcm.test", password: "wrong" }),
    ).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    const anonymous = createEventOpsClient({ baseUrl: "http://localhost:4000/api", onUnauthorized });
    await expect(anonymous.pmcm.reference()).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("reports a pending privacy notice only for signed-in 403 privacy_notice_required responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ code: "privacy_notice_required", message: "Review the privacy notice to continue." }), { status: 403 })),
    );
    const onPrivacyNoticeRequired = vi.fn();
    const onUnauthorized = vi.fn();
    const client = createEventOpsClient({
      baseUrl: "http://localhost:4000/api",
      getAuthToken: () => "pending-token",
      onPrivacyNoticeRequired,
      onUnauthorized,
    });

    await expect(client.pmcm.reference()).rejects.toMatchObject({
      status: 403,
      problem: { code: "privacy_notice_required" },
    });
    expect(onPrivacyNoticeRequired).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();

    const anonymous = createEventOpsClient({ baseUrl: "http://localhost:4000/api", onPrivacyNoticeRequired });
    await expect(anonymous.pmcm.reference()).rejects.toMatchObject({ status: 403 });
    expect(onPrivacyNoticeRequired).toHaveBeenCalledTimes(1);
  });

  it("loads the PMCM reference with identity from the session, not query parameters", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.pmcm.reference();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/pmcm/reference", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("reviews a client proposal through the shared event contract", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "evt_1", proposalClientStatus: "approved" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.events.reviewProposal("evt_1", { action: "approve" });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/events/evt_1/proposal/review", {
      method: "PATCH",
      body: JSON.stringify({ action: "approve" }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("searches archived events by venue and month", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.events.searchArchive({ venue: "Shangri-La", month: "2026-06" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/events/archive?venue=Shangri-La&month=2026-06",
      { headers: { "Content-Type": "application/json" } },
    );
  });

  it("loads the PMCM command inbox as a scoped read model", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.pmcm.commandInbox({ page: 2 });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/pmcm/command-inbox?page=2",
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  it("loads the PMCM event summaries and the cross-event calendar window", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.pmcm.eventSummaries();
    await client.pmcm.fileSummaries();
    await client.pmcm.calendar({ from: "2026-10-01", to: "2027-01-31" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:4000/api/pmcm/event-summaries", { headers: { "Content-Type": "application/json" } });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:4000/api/pmcm/file-summaries", { headers: { "Content-Type": "application/json" } });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://localhost:4000/api/pmcm/calendar?from=2026-10-01&to=2027-01-31", { headers: { "Content-Type": "application/json" } });
  });

  it("loads the PMCM decision log from the event-scoped route with kind and paging filters", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ eventId: "evt_1", entries: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.pmcm.decisionLog("evt_1");
    await client.pmcm.decisionLog("evt_1", { kind: "archive_override", page: 1 });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:4000/api/events/evt_1/decision-log", {
      headers: { "Content-Type": "application/json" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:4000/api/events/evt_1/decision-log?kind=archive_override&page=1", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("loads the PMCM selected event workspace as a scoped read model", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ event: { id: "evt_1" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.pmcm.eventWorkspace("evt_1", { actorName: "Ms. Mys", actorRole: "pmcm-admin" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/pmcm/events/evt_1/workspace?actorName=Ms.+Mys&actorRole=pmcm-admin",
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  it("loads the guest event pass through the shared contract", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "evt_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.guest.eventPass("AYALA-TECH-YALA");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/guest/events/AYALA-TECH-YALA", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("searches the role-scoped registration roster and posts an event-scoped walk-in", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "gci_1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.guest.registrationRoster("evt_1", { query: "Mia" });
    await client.guest.registerWalkIn("evt_1", { guestName: "Mia Santos", privacyConsentAccepted: true });
    await client.guest.verifyRegistrationRoster("evt_1", "gre_1", { status: "verified" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:4000/api/guest/events/evt_1/roster/search?query=Mia", {
      headers: { "Content-Type": "application/json" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:4000/api/guest/events/evt_1/walk-ins", {
      method: "POST",
      body: JSON.stringify({ guestName: "Mia Santos", privacyConsentAccepted: true }),
      headers: { "Content-Type": "application/json" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://localhost:4000/api/guest/events/evt_1/roster/gre_1/verification", {
      method: "PATCH",
      body: JSON.stringify({ status: "verified" }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("requests the pending registration review queue through the scoped roster API", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.guest.registrationRoster("evt_1", { reviewQueue: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/guest/events/evt_1/roster/search?reviewQueue=true",
      { headers: { "Content-Type": "application/json" } },
    );
  });

  it("files and lists the signed-in requester's own privacy requests with the session token", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({
      baseUrl: "http://localhost:4000/api",
      getAuthToken: () => "client-session-token",
    });
    await client.privacy.submitOwnRequest({ requestType: "correction", details: "Fix my company name" });
    await client.privacy.listOwnRequests();

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4000/api/privacy/requests/mine");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ requestType: "correction", details: "Fix my company name" }),
    });
    expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:4000/api/privacy/requests/mine");
    expect(fetchMock.mock.calls[1][1]?.method ?? "GET").toBe("GET");
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("authorization")).toBe("Bearer client-session-token");
  });

  it("loads and updates guest privacy classification through the authenticated event contract", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      eventId: "evt_1",
      classification: "private",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({
      baseUrl: "http://localhost:4000/api",
      getAuthToken: () => "pmcm-session-token",
    });
    await client.guest.guestPrivacyClassification("evt_1");
    await client.guest.updateGuestPrivacyClassification("evt_1", { classification: "private" });

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4000/api/events/evt_1/guest-privacy");
    expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:4000/api/events/evt_1/guest-privacy");
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization")).toContain("Bearer");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ classification: "private" }),
    });
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("authorization")).toContain("Bearer");
  });

  it("posts inquiry payloads", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "inq_1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.inquiries.create({
      clientName: "Acme",
      email: "client@example.com",
      eventName: "Acme Summit",
      eventDate: "2026-07-01",
      clientType: "Corporate",
      source: "PMCM Facebook",
      message: "Need planning support.",
      privacyConsentAccepted: true,
      privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/inquiries", {
      method: "POST",
      body: JSON.stringify({
        clientName: "Acme",
        email: "client@example.com",
        eventName: "Acme Summit",
        eventDate: "2026-07-01",
        clientType: "Corporate",
        source: "PMCM Facebook",
        message: "Need planning support.",
        privacyConsentAccepted: true,
        privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
      }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("exposes PrismApiError for callers that need typed handling", () => {
    expect(new PrismApiError(500, "error").status).toBe(500);
  });
});
