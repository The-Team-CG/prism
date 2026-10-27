import { afterEach, describe, expect, it, vi } from "vitest";
import { PRISM_PRIVACY_NOTICE_VERSION, PrismContractError, type PrismEventOpsActorContext } from "@prism/types";
import { PrismApiError, createEventOpsClient, normalizePrismApiProblem, prismRequest, toQueryString } from "./index";

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
    await client.pmcmDashboard.detail();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/pmcm/dashboard", {
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

    await expect(client.pmcmDashboard.detail()).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    await expect(
      client.auth.login({ email: "mys@pmcm.test", password: "wrong" }),
    ).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    const anonymous = createEventOpsClient({ baseUrl: "http://localhost:4000/api", onUnauthorized });
    await expect(anonymous.pmcmDashboard.detail()).rejects.toMatchObject({ status: 401 });
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

    await expect(client.pmcmDashboard.detail()).rejects.toMatchObject({
      status: 403,
      problem: { code: "privacy_notice_required" },
    });
    expect(onPrivacyNoticeRequired).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();

    const anonymous = createEventOpsClient({ baseUrl: "http://localhost:4000/api", onPrivacyNoticeRequired });
    await expect(anonymous.pmcmDashboard.detail()).rejects.toMatchObject({ status: 403 });
    expect(onPrivacyNoticeRequired).toHaveBeenCalledTimes(1);
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
