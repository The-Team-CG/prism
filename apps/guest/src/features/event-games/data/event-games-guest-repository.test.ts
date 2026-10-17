import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRISM_SESSION_STORAGE_KEYS, readPrismSession, savePrismSession } from "@prism/types";

const api = vi.hoisted(() => ({
  joinActiveMultiplayerGameSession: vi.fn(),
  getPublicLobby: vi.fn(),
  startIndependentSingleplayerGameSession: vi.fn(),
  getParticipantState: vi.fn(),
  submitAction: vi.fn(),
  getParticipantMediaAuthorization: vi.fn(),
}));

const persisted = vi.hoisted(() => new Map<string, string>());

vi.mock("@prism/api-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@prism/api-client")>();
  return {
    ...original,
    createEventOpsClient: vi.fn(() => ({ eventGames: api })),
  };
});

import { eventGamesGuestRepository } from "./event-games-guest-repository";

const storage = {
  getItem: (key: string) => persisted.get(key) ?? null,
  setItem: (key: string, value: string) => persisted.set(key, value),
  removeItem: (key: string) => persisted.delete(key),
};

const eventALobby = {
  eventId: "event-a",
  eventSlug: "summer-party",
  eventName: "Summer Party",
  branding: { theme: "prism", primaryColor: "#312E81", secondaryColor: "#0F766E", logoUrl: null },
  games: [{ id: "solo-a", title: "Word Scramble", kind: "word-scramble", availableFrom: null, availableUntil: null }],
};

const joinResult = {
  eventId: "event-a",
  sessionId: "session-a1",
  game: { title: "Live Trivia", kind: "live-trivia" },
  status: "live",
  participantCredential: "A".repeat(43),
};

const participantState = {
  sessionId: "session-a1",
  game: { title: "Live Trivia", kind: "live-trivia" },
  status: "live",
  startedAt: "2026-10-17T10:00:00.000Z",
  currentRound: { key: 'round-1', number: 1, total: 3 },
  currentPrompt: "Choose the correct answer",
  participant: { participantAlias: "Guest A1B2C3D4E5", hasSubmitted: false, score: 0 },
  aggregateResults: [],
};

describe("event games guest repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persisted.clear();
    vi.stubGlobal("window", { localStorage: storage });
    api.getPublicLobby.mockResolvedValue(eventALobby);
    api.joinActiveMultiplayerGameSession.mockResolvedValue(joinResult);
    api.startIndependentSingleplayerGameSession.mockResolvedValue({
      eventId: "event-a",
      sessionId: "session-a2",
      game: { title: "Word Scramble", kind: "word-scramble" },
      status: "live",
      participantCredential: "A".repeat(43),
    });
    api.getParticipantState.mockResolvedValue(participantState);
    api.submitAction.mockResolvedValue(participantState);
    api.getParticipantMediaAuthorization.mockResolvedValue({
      downloadUrl: "https://media.example.test/signed-image", expiresAt: "2026-10-17T10:05:00.000Z",
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("joins an Active (Multiplayer) session with a normalized PIN and stores an anonymous event session", async () => {
    persisted.set(PRISM_SESSION_STORAGE_KEYS.guest, JSON.stringify({ id: "check-in-session" }));

    const result = await eventGamesGuestRepository.joinActiveGameByPin(" 12 34 56 ");

    expect(result.sessionId).toBe("session-a1");
    expect(api.joinActiveMultiplayerGameSession).toHaveBeenCalledWith(
      { pin: "123456", idempotencyKey: expect.any(String) },
      undefined,
    );
    expect(eventGamesGuestRepository.readParticipantSession()).toEqual({
      eventId: "event-a",
      currentSessionId: "session-a1",
      participantCredential: "A".repeat(43),
    });
    expect(persisted.get(PRISM_SESSION_STORAGE_KEYS.guest)).toBe(JSON.stringify({ id: "check-in-session" }));
  });

  it("uses a saved credential for another PIN game only when the supplied event lobby matches", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a",
      currentSessionId: "old-session",
      participantCredential: "A".repeat(43),
    });

    await eventGamesGuestRepository.joinActiveGameByPin("123456", "summer-party");

    expect(api.getPublicLobby).toHaveBeenCalledWith("summer-party");
    expect(api.joinActiveMultiplayerGameSession).toHaveBeenCalledWith(
      { pin: "123456", idempotencyKey: expect.any(String), expectedEventId: "event-a" },
      "A".repeat(43),
    );
  });

  it("does not accept an Independent game response from the PIN join route", async () => {
    api.joinActiveMultiplayerGameSession.mockResolvedValueOnce({
      ...joinResult,
      game: { title: "Word Scramble", kind: "word-scramble" },
    });

    await expect(eventGamesGuestRepository.joinActiveGameByPin("123456"))
      .rejects.toThrow("This game is unavailable. Check the PIN and try again.");
    expect(eventGamesGuestRepository.readParticipantSession()).toBeNull();
  });

  it("never sends an event A credential to a PIN join opened for event B", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a",
      currentSessionId: "old-session",
      participantCredential: "A".repeat(43),
    });
    api.getPublicLobby.mockResolvedValue({ ...eventALobby, eventId: "event-b", eventSlug: "other-party" });
    api.joinActiveMultiplayerGameSession.mockResolvedValue({ ...joinResult, eventId: "event-b", participantCredential: "B".repeat(43) });

    await eventGamesGuestRepository.joinActiveGameByPin("123456", "other-party");

    expect(api.joinActiveMultiplayerGameSession).toHaveBeenCalledWith(
      { pin: "123456", idempotencyKey: expect.any(String), expectedEventId: "event-b" },
      undefined,
    );
    expect(eventGamesGuestRepository.readParticipantSession()?.eventId).toBe("event-b");
  });

  it("does not call the API for an invalid PIN", async () => {
    await expect(eventGamesGuestRepository.joinActiveGameByPin("12-3456")).rejects.toThrow("Enter the 6-digit game PIN.");
    expect(api.joinActiveMultiplayerGameSession).not.toHaveBeenCalled();
  });

  it("removes legacy or injected profile fields from the saved game participant record", () => {
    persisted.set(PRISM_SESSION_STORAGE_KEYS.gameParticipant, JSON.stringify({
      eventId: "event-a",
      currentSessionId: "session-a1",
      participantCredential: "A".repeat(43),
      participantAlias: "Legacy alias",
      displayName: "Private name",
      photoUrl: "https://example.test/photo.png",
    }));

    expect(eventGamesGuestRepository.readParticipantSession()).toEqual({
      eventId: "event-a",
      currentSessionId: "session-a1",
      participantCredential: "A".repeat(43),
    });
    expect(JSON.parse(persisted.get(PRISM_SESSION_STORAGE_KEYS.gameParticipant) ?? "{}")).not.toHaveProperty("displayName");
    expect(JSON.parse(persisted.get(PRISM_SESSION_STORAGE_KEYS.gameParticipant) ?? "{}")).not.toHaveProperty("photoUrl");
  });

  it("maps an unavailable PIN to one generic guest-safe message", async () => {
    api.joinActiveMultiplayerGameSession.mockRejectedValueOnce({ status: 404, message: "private event details" });

    await expect(eventGamesGuestRepository.joinActiveGameByPin("123456"))
      .rejects.toThrow("This game is unavailable. Check the PIN and try again.");
  });

  it("returns only public lobby fields and public game summaries", async () => {
    api.getPublicLobby.mockResolvedValueOnce({
      ...eventALobby,
      privateNotes: "staff-only",
      games: [{ ...eventALobby.games[0], config: { answer: "secret" }, unpublishedDraft: true }],
    });

    const result = await eventGamesGuestRepository.getPublicLobby("summer-party");

    expect(result).toEqual(eventALobby);
    expect(JSON.stringify(result)).not.toContain("staff-only");
    expect(JSON.stringify(result)).not.toContain("answer");
  });

  it("preserves safe custom branding and an HTTPS logo URL", async () => {
    api.getPublicLobby.mockResolvedValueOnce({
      ...eventALobby,
      branding: {
        theme: "ocean",
        primaryColor: "#123abc",
        secondaryColor: "#ABCDEF",
        logoUrl: "https://media.example.test/logo.png?signature=public",
      },
    });

    await expect(eventGamesGuestRepository.getPublicLobby("summer-party")).resolves.toMatchObject({
      branding: {
        theme: "ocean",
        primaryColor: "#123abc",
        secondaryColor: "#ABCDEF",
        logoUrl: "https://media.example.test/logo.png?signature=public",
      },
    });
  });

  it("falls back from invalid colors and rejects non-HTTPS lobby logos", async () => {
    api.getPublicLobby.mockResolvedValueOnce({
      ...eventALobby,
      branding: { theme: "ocean", primaryColor: "red", secondaryColor: "#445566", logoUrl: "http://media.example.test/logo.png" },
    });

    await expect(eventGamesGuestRepository.getPublicLobby("summer-party")).resolves.toMatchObject({
      branding: {
        theme: "ocean",
        primaryColor: "#164E63",
        secondaryColor: "#445566",
        logoUrl: null,
      },
    });
  });

  it("keeps a Wheel result at session scope and strips participant and answer-key fields", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a", currentSessionId: "session-a1", participantCredential: "A".repeat(43),
    });
    api.getParticipantState.mockResolvedValueOnce({
      ...participantState,
      participant: {
        participantAlias: "Guest A1B2C3D4E5",
        hasSubmitted: true,
        score: 40,
        result: { kind: "spin-wheel", outcomeId: "large", label: "Large prize", points: 40 },
        gameData: { kind: "live-trivia", options: ["A", "B"], correctAnswer: "B" },
        answerKey: "B",
      },
      sessionResult: { kind: "spin-wheel", outcomeId: "large", label: "Large prize", points: 40 },
      privateConfiguration: { correctAnswer: "B" },
    });

    const state = await eventGamesGuestRepository.getParticipantState("session-a1");

    expect(state.participant).toEqual({
      participantAlias: "Guest A1B2C3D4E5",
      hasSubmitted: true,
      score: 40,
      gameData: { kind: "live-trivia", options: ["A", "B"] },
    });
    expect(state.sessionResult).toEqual({ kind: "spin-wheel", outcomeId: "large", label: "Large prize", points: 40 });
    expect(JSON.stringify(state)).not.toContain("correctAnswer");
  });

  it("sanitizes competitive standings and never returns host-only award identifiers", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a", currentSessionId: "session-a1", participantCredential: "A".repeat(43),
    });
    api.getParticipantState.mockResolvedValueOnce({
      ...participantState,
      leaderboard: [
        { rank: 1, label: "Player 1", score: 40, awardRecipient: { type: "participant", participationGrantId: "grant-secret" } },
        { rank: 2, label: "Blue", teamLabel: "Blue", score: 20, teamId: "team-secret" },
        { rank: "3", label: "Invalid", score: 10 },
      ],
    });

    const state = await eventGamesGuestRepository.getParticipantState("session-a1");

    expect(state.leaderboard).toEqual([
      { rank: 1, label: "Player 1", score: 40 },
      { rank: 2, label: "Blue", teamLabel: "Blue", score: 20 },
    ]);
    expect(JSON.stringify(state)).not.toContain("grant-secret");
    expect(JSON.stringify(state)).not.toContain("team-secret");
  });

  it("rejects participant state without a canonical server-issued alias", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a", currentSessionId: "session-a1", participantCredential: "A".repeat(43),
    });
    api.getParticipantState.mockResolvedValueOnce({
      ...participantState,
      participant: { ...participantState.participant, participantAlias: "Guest 1234" },
    });

    await expect(eventGamesGuestRepository.getParticipantState("session-a1")).rejects.toThrow();
  });

  it("submits a typed game action with only the saved current-session credential", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a", currentSessionId: "session-a1", participantCredential: "A".repeat(43),
    });
    const action = {
      templateId: "live-trivia" as const,
      roundKey: "round-1",
      actionKind: "answer" as const,
      payload: { answer: "B" },
    };

    await eventGamesGuestRepository.submitParticipantAction("session-a1", action);

    expect(api.submitAction).toHaveBeenCalledWith("session-a1", action, "A".repeat(43));
    await expect(eventGamesGuestRepository.submitParticipantAction("session-b1", action))
      .rejects.toThrow("This game session is not available on this device.");
  });

  it("requests picture media only for the current participant session and a stored object ID", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a", currentSessionId: "session-a1", participantCredential: "A".repeat(43),
    });
    const mediaObjectId = "obj_a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5";

    await expect(eventGamesGuestRepository.getParticipantMediaAuthorization("session-a1", mediaObjectId))
      .resolves.toEqual({ downloadUrl: "https://media.example.test/signed-image", expiresAt: "2026-10-17T10:05:00.000Z" });
    expect(api.getParticipantMediaAuthorization).toHaveBeenCalledWith("session-a1", mediaObjectId, "A".repeat(43));
    await expect(eventGamesGuestRepository.getParticipantMediaAuthorization("session-a1", "https://bad.test/image"))
      .rejects.toThrow("This game image is not available right now.");
  });

  it("rejects a lobby response scoped to a different event slug", async () => {
    api.getPublicLobby.mockResolvedValueOnce({ ...eventALobby, eventSlug: "different-party" });

    await expect(eventGamesGuestRepository.getPublicLobby("summer-party"))
      .rejects.toThrow("This event games link is unavailable. Check the link and try again.");
  });

  it("starts only a listed Independent (Singleplayer) game without a PIN and reuses a matching event credential", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a",
      currentSessionId: null,
      participantCredential: "A".repeat(43),
    });

    const result = await eventGamesGuestRepository.startIndependentGame("summer-party", "solo-a");

    expect(result.sessionId).toBe("session-a2");
    expect(api.startIndependentSingleplayerGameSession).toHaveBeenCalledWith(
      "summer-party",
      "solo-a",
      { idempotencyKey: expect.any(String), participantCredential: "A".repeat(43) },
    );
    expect(JSON.stringify(api.startIndependentSingleplayerGameSession.mock.calls[0]?.[2])).not.toContain("pin");
  });

  it("does not send an event A credential when an event B lobby starts a game", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a",
      currentSessionId: "session-a1",
      participantCredential: "A".repeat(43),
    });
    api.getPublicLobby.mockResolvedValueOnce({ ...eventALobby, eventId: "event-b", eventSlug: "other-party" });
    api.startIndependentSingleplayerGameSession.mockResolvedValueOnce({
      eventId: "event-b", sessionId: "session-b1", game: { title: "Word Scramble", kind: "word-scramble" },
      status: "live", participantCredential: "B".repeat(43),
    });

    await eventGamesGuestRepository.startIndependentGame("other-party", "solo-a");

    expect(api.startIndependentSingleplayerGameSession).toHaveBeenCalledWith(
      "other-party",
      "solo-a",
      { idempotencyKey: expect.any(String) },
    );
    expect(eventGamesGuestRepository.readParticipantSession()?.eventId).toBe("event-b");
  });

  it("does not start an unlisted game or expose a private game error", async () => {
    await expect(eventGamesGuestRepository.startIndependentGame("summer-party", "draft-game"))
      .rejects.toThrow("This event game is not available right now. Return to the event lobby and try again.");
    expect(api.startIndependentSingleplayerGameSession).not.toHaveBeenCalled();
  });

  it("clears a saved event credential when the server rejects it during a later game start", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a", currentSessionId: null, participantCredential: "A".repeat(43),
    });
    api.startIndependentSingleplayerGameSession.mockRejectedValueOnce({
      status: 403,
      message: "Participant credential is not valid for this event",
    });

    await expect(eventGamesGuestRepository.startIndependentGame("summer-party", "solo-a"))
      .rejects.toThrow("This event game is not available right now. Return to the event lobby and try again.");

    expect(eventGamesGuestRepository.readParticipantSession()).toBeNull();
  });

  it("does not send a credential to a session other than the saved current session", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a", currentSessionId: "session-a1", participantCredential: "A".repeat(43),
    });

    await expect(eventGamesGuestRepository.getParticipantState("session-b1"))
      .rejects.toThrow("This game session is not available on this device.");
    expect(api.getParticipantState).not.toHaveBeenCalled();
  });

  it("clears the current session reference after closure but retains the event credential", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a", currentSessionId: "session-a1", participantCredential: "A".repeat(43), participantAlias: "Legacy Alias", name: "Private name",
    });
    api.getParticipantState.mockResolvedValueOnce({ ...participantState, status: "completed" });

    await eventGamesGuestRepository.getParticipantState("session-a1");

    expect(api.getParticipantState).toHaveBeenCalledWith("session-a1", "A".repeat(43));

    expect(eventGamesGuestRepository.readParticipantSession()).toEqual({
      eventId: "event-a", currentSessionId: null, participantCredential: "A".repeat(43),
    });
    expect(JSON.parse(persisted.get(PRISM_SESSION_STORAGE_KEYS.gameParticipant) ?? "{}")).not.toHaveProperty("name");
    expect(JSON.parse(persisted.get(PRISM_SESSION_STORAGE_KEYS.gameParticipant) ?? "{}")).not.toHaveProperty("participantAlias");
  });

  it("returns only the public participant state fields", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a", currentSessionId: "session-a1", participantCredential: "A".repeat(43),
    });
    api.getParticipantState.mockResolvedValueOnce({
      ...participantState,
      correctAnswer: "A",
      moderationNotes: "staff-only",
      participantRecords: [{ name: "Private name" }],
      hostCommands: [{ action: "end_session" }],
    });

    const result = await eventGamesGuestRepository.getParticipantState("session-a1");

    expect(result).toEqual(participantState);
    expect(JSON.stringify(result)).not.toContain("staff-only");
    expect(JSON.stringify(result)).not.toContain("Private name");
    expect(JSON.stringify(result)).not.toContain("correctAnswer");
  });

  it("keeps Family Feud read data to the participant's team label only", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a", currentSessionId: "session-a1", participantCredential: "A".repeat(43),
    });
    api.getParticipantState.mockResolvedValueOnce({
      ...participantState,
      game: { title: "Family Feud", kind: "family-feud" },
      participant: {
        participantAlias: "Guest A1B2C3D4E5",
        hasSubmitted: false, hasVoted: false, score: 0,
        gameData: {
          kind: "family-feud", teamLabel: "Blue", teamId: "internal-team-id",
          answerBoard: [{ answer: "secret answer", points: 100 }], rawText: "unmoderated response",
        },
      },
    });

    const result = await eventGamesGuestRepository.getParticipantState("session-a1");

    expect(result.participant.gameData).toEqual({ kind: "family-feud", teamLabel: "Blue" });
    expect(JSON.stringify(result)).not.toContain("internal-team-id");
    expect(JSON.stringify(result)).not.toContain("secret answer");
    expect(JSON.stringify(result)).not.toContain("unmoderated response");
  });

  it("keeps solo puzzle state public while stripping answer keys and target geometry", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a", currentSessionId: "session-a1", participantCredential: "A".repeat(43),
    });
    const shared = {
      ...participantState,
      currentRound: { key: "puzzle-1", number: 1, total: 1 },
    };
    const puzzleStates = [
      {
        ...shared,
        game: { title: "Word Scramble", kind: "word-scramble" },
        participant: { participantAlias: "Guest A1B2C3D4E5", hasSubmitted: false, score: 0, gameData: { kind: "word-scramble", answer: "secret" } },
      },
      {
        ...shared,
        game: { title: "Picture Solo", kind: "guess-picture-solo" },
        participant: {
          participantAlias: "Guest A1B2C3D4E5",
          hasSubmitted: false, score: 0,
          gameData: { kind: "guess-picture-solo", mediaObjectId: "obj_123e4567-e89b-42d3-a456-426614174000", stage: 2, totalStages: 2, acceptedAnswers: ["secret"] },
        },
      },
      {
        ...shared,
        game: { title: "Spot the Difference", kind: "spot-the-difference" },
        participant: {
          participantAlias: "Guest A1B2C3D4E5",
          hasSubmitted: false, score: 0,
          gameData: {
            kind: "spot-the-difference", originalMediaObjectId: "obj_123e4567-e89b-42d3-a456-426614174000",
            comparisonMediaObjectId: "obj_123e4567-e89b-42d3-a456-426614174001", totalDifferences: 2,
            differences: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.4 }],
          },
        },
      },
    ];

    for (const [index, rawState] of puzzleStates.entries()) {
      api.getParticipantState.mockResolvedValueOnce(rawState);
      const result = await eventGamesGuestRepository.getParticipantState("session-a1");
      expect(result.participant.gameData).toEqual(rawState.participant.gameData?.kind === "word-scramble"
        ? { kind: "word-scramble" }
        : rawState.participant.gameData?.kind === "guess-picture-solo"
          ? { kind: "guess-picture-solo", mediaObjectId: "obj_123e4567-e89b-42d3-a456-426614174000", stage: 2, totalStages: 2 }
          : {
            kind: "spot-the-difference",
            originalMediaObjectId: "obj_123e4567-e89b-42d3-a456-426614174000",
            comparisonMediaObjectId: "obj_123e4567-e89b-42d3-a456-426614174001",
            totalDifferences: 2,
          });
      expect(JSON.stringify(result)).not.toContain("secret");
      expect(JSON.stringify(result)).not.toContain('"differences"');
      expect(result.game.kind).toBe(["word-scramble", "guess-picture-solo", "spot-the-difference"][index]);
    }
  });

  it("accepts only bounded Split the Room text in a paused public state", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a", currentSessionId: "session-a1", participantCredential: "A".repeat(43),
    });
    api.getParticipantState.mockResolvedValueOnce({
      ...participantState,
      game: { title: "Split the Room", kind: "split-the-room" },
      status: "paused",
      approvedResponses: ["Approved response", { response: "not plain text" }, "x".repeat(501)],
      moderationQueue: [{ response: "pending response" }],
    });

    const paused = await eventGamesGuestRepository.getParticipantState("session-a1");

    expect(paused.approvedResponses).toEqual(["Approved response"]);
    expect(JSON.stringify(paused)).not.toContain("pending response");

    api.getParticipantState.mockResolvedValueOnce({
      ...participantState,
      game: { title: "Split the Room", kind: "split-the-room" },
      status: "live",
      approvedResponses: ["Not yet revealed"],
    });
    const live = await eventGamesGuestRepository.getParticipantState("session-a1");
    expect(live).not.toHaveProperty("approvedResponses");
  });

  it("clears a rejected participant credential without touching the guest check-in session", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a", currentSessionId: "session-a1", participantCredential: "A".repeat(43),
    });
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.guest, { id: "check-in-session" });
    api.getParticipantState.mockRejectedValueOnce({ status: 404, message: "private event details" });

    await expect(eventGamesGuestRepository.getParticipantState("session-a1"))
      .rejects.toThrow("This game session is no longer available. Join again with its PIN or event link.");

    expect(eventGamesGuestRepository.readParticipantSession()).toBeNull();
    expect(readPrismSession(PRISM_SESSION_STORAGE_KEYS.guest)).toEqual({ id: "check-in-session" });
  });

  it("clears an expired or revoked participant token after the server rejects the grant", async () => {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, {
      eventId: "event-a", currentSessionId: "session-a1", participantCredential: "A".repeat(43),
    });
    api.getParticipantState.mockRejectedValueOnce({ status: 410, message: "expired" });

    await expect(eventGamesGuestRepository.getParticipantState("session-a1"))
      .rejects.toThrow("This game session is no longer available. Join again with its PIN or event link.");
    expect(eventGamesGuestRepository.readParticipantSession()).toBeNull();
  });
});
