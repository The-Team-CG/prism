import { afterEach, describe, expect, it, vi } from "vitest";
import { PrismApiError, createEventOpsClient, prismRequest, toQueryString } from "./index";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("prismRequest", () => {
  it("builds JSON requests from a base URL and path", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await prismRequest<{ ok: boolean }>("/demo/state", {
      baseUrl: "http://localhost:4000/api",
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/demo/state", {
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
  it("loads PMCM state through the demo aggregate endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createEventOpsClient({ baseUrl: "http://localhost:4000/api" });
    await client.demo.state();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/demo/state", {
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
