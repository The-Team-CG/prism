import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismEventOpsActorContext } from "@prism/types";
import { PrismApiError, createEventOpsClient, normalizePrismApiProblem, prismRequest, toQueryString } from "./index";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("prismRequest", () => {
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
});

describe("toQueryString", () => {
  it("drops empty query values", () => {
    expect(toQueryString({ role: "pmcm", eventId: "", page: undefined, active: true })).toBe("role=pmcm&active=true");
  });
});

describe("createEventOpsClient", () => {
  it("posts login and approval requests through the shared auth contract", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "approval_1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.auth.login({ email: "client@example.test", password: "not-a-real-password" });
    await client.auth.requestApproval({
      email: "client@example.test",
      privacyConsentAccepted: true,
      privacyNoticeVersion: "2026-05-01",
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
        privacyNoticeVersion: "2026-05-01",
      }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("sends actor query params for event lists", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.events.list({ actorName: "Ms. Mys", actorRole: "pmcm" });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/events?actorName=Ms.+Mys&actorRole=pmcm", {
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
    await client.pmcmDashboard.detail();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/pmcm/dashboard", {
      headers: { "Content-Type": "application/json", Authorization: "Bearer signed-token" },
    });
  });
  it("loads the PMCM dashboard as a scoped read model", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.pmcmDashboard.detail({ actorName: "Ms. Mys", actorRole: "pmcm-admin" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/pmcm/dashboard?actorName=Ms.+Mys&actorRole=pmcm-admin",
      {
        headers: { "Content-Type": "application/json" },
      },
    );
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

  it("submits a client floorplan revision comment through the shared event contract", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "fpd_1", status: "revision_requested" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.events.reviewFloorPlanDraft("evt_1", "fpd_1", {
      revisionNote: "Move the mingle space next to the bar.",
      idempotencyKey: "key-1",
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/events/evt_1/floorplans/fpd_1/review", {
      method: "PATCH",
      body: JSON.stringify({ revisionNote: "Move the mingle space next to the bar.", idempotencyKey: "key-1" }),
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

  it("posts inquiry payloads", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "inq_1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.inquiries.create({
      clientName: "Acme",
      email: "client@example.com",
      eventName: "Acme Summit",
      eventDate: "2026-07-01",
      clientType: "corporate",
      source: "PMCM Facebook",
      message: "Need planning support.",
      privacyConsentAccepted: true,
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/inquiries", {
      method: "POST",
      body: JSON.stringify({
        clientName: "Acme",
        email: "client@example.com",
        eventName: "Acme Summit",
        eventDate: "2026-07-01",
        clientType: "corporate",
        source: "PMCM Facebook",
        message: "Need planning support.",
        privacyConsentAccepted: true,
      }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("exposes PrismApiError for callers that need typed handling", () => {
    expect(new PrismApiError(500, "error").status).toBe(500);
  });
});
