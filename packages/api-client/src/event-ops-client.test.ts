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

    const result = await prismRequest<{ ok: boolean }>("/sample/state", {
      baseUrl: "http://localhost:4000/api",
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/sample/state", {
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
  it("loads PMCM state through the sample aggregate endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.sample.state();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/sample/state", {
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

  it("loads event file requirements as a scoped read model", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ eventId: "evt_1", items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.events.fileRequirements("evt_1", { actorRole: "client", clientName: "Ana Reyes" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/events/evt_1/file-requirements?actorRole=client&clientName=Ana+Reyes",
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  it("loads scoped client workspace through the shared contract", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.clientWorkspace.detail({ actorRole: "client", clientName: "Ana Reyes" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/client/workspace?actorRole=client&clientName=Ana+Reyes",
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  it("loads client action center through the shared contract", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.clientWorkspace.actionCenter({ actorRole: "client", clientName: "Ana Reyes" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/client/action-center?actorRole=client&clientName=Ana+Reyes",
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  it("loads scoped supplier workspace through the shared contract", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ quoteRequests: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.supplierWorkspace.detail({ actorRole: "supplier", actorEmail: "supplier@example.com" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/supplier/workspace?actorRole=supplier&actorEmail=supplier%40example.com",
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  it("loads supplier readiness board through the shared contract", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.supplierWorkspace.readinessBoard({ actorRole: "supplier", actorEmail: "supplier@example.com" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/supplier/readiness-board?actorRole=supplier&actorEmail=supplier%40example.com",
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  it("accepts the full shared actor context for scoped supplier reads", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ quoteRequests: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const actor = {
      actorRole: "supplier",
      actorName: "Sonic Line Events",
      actorEmail: "supplier@example.com",
      supplierId: "sup_sonicline",
      eventId: "evt_sample",
      accessCode: "supplier-access",
    } satisfies PrismEventOpsActorContext;

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.supplierWorkspace.detail(actor);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/supplier/workspace?actorRole=supplier&actorName=Sonic+Line+Events&actorEmail=supplier%40example.com&supplierId=sup_sonicline&eventId=evt_sample&accessCode=supplier-access",
      {
        headers: { "Content-Type": "application/json" },
      },
    );
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

  it("loads the PMCM command inbox as a scoped read model", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.pmcm.commandInbox({ actorName: "Ms. Mys", actorRole: "pmcm-admin" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/pmcm/command-inbox?actorName=Ms.+Mys&actorRole=pmcm-admin",
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
