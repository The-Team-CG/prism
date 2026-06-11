import { afterEach, describe, expect, it, vi } from "vitest";
import { PrismApiError, createEventOpsClient, prismRequest, toQueryString } from "./index";

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

  it("throws PrismApiError with status and response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 })),
    );

    await expect(prismRequest("/events", { baseUrl: "http://localhost:4000/api" })).rejects.toMatchObject({
      name: "PrismApiError",
      status: 403,
      body: { message: "Forbidden" },
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
