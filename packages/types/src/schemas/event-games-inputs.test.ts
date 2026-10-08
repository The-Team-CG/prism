import { describe, expect, it } from "vitest";
import type {
  PrismEventGameKind,
  PrismEventGameLobby,
  PrismGameHostState,
  PrismGamePublicState,
  PrismGameSessionResponsePage,
} from "../index.js";
import {
  createEventGameSchema,
  createGameSessionSchema,
  gameHostCommandSchema,
  joinActiveMultiplayerGameSessionSchema,
  prismEventGameKindSchema,
  startIndependentSingleplayerGameSessionSchema,
  updateEventGameSchema,
} from "./event-games-inputs.js";

const GAME_KINDS = [
  "live-trivia",
  "bingo",
  "guess-picture",
  "spin-wheel",
  "this-or-that",
  "family-feud",
  "split-the-room",
  "word-scramble",
  "would-you-rather",
  "guess-picture-solo",
  "this-or-that-solo",
  "spot-the-difference",
] as const;

describe("event game shared contracts", () => {
  it("accepts all twelve game kinds and rejects unknown templates", () => {
    for (const kind of GAME_KINDS) {
      expect(prismEventGameKindSchema.safeParse(kind).success).toBe(true);
    }
    expect(prismEventGameKindSchema.safeParse("raffle").success).toBe(false);
  });

  it("accepts valid draft metadata and rejects malformed or server-owned fields", () => {
    const draft = {
      kind: "live-trivia",
      title: "Welcome trivia",
      description: "A short opening game",
      instructions: "Choose one answer per round",
    };

    expect(createEventGameSchema.safeParse(draft).success).toBe(true);
    expect(createEventGameSchema.safeParse({ ...draft, title: "  " }).success).toBe(false);
    expect(createEventGameSchema.safeParse({ ...draft, ownerId: "guest-1" }).success).toBe(false);
    expect(createEventGameSchema.safeParse({ ...draft, eventId: "event-1" }).success).toBe(false);
    expect(createEventGameSchema.safeParse({ ...draft, score: 500 }).success).toBe(false);
  });

  it("updates only mutable draft metadata and rejects empty or authoritative updates", () => {
    expect(updateEventGameSchema.safeParse({ title: "Updated title" }).success).toBe(true);
    expect(updateEventGameSchema.safeParse({}).success).toBe(false);
    expect(updateEventGameSchema.safeParse({ kind: "bingo" }).success).toBe(false);
    expect(updateEventGameSchema.safeParse({ actorId: "guest-1" }).success).toBe(false);
  });

  it("creates a session with a game reference and optional ISO schedule only", () => {
    expect(createGameSessionSchema.safeParse({ gameId: "a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5" }).success).toBe(true);
    expect(createGameSessionSchema.safeParse({
      gameId: "a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5",
      scheduledStartAt: "2026-10-08T10:00:00.000Z",
    }).success).toBe(true);
    expect(createGameSessionSchema.safeParse({
      gameId: "a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5",
      eventId: "event-1",
    }).success).toBe(false);
  });

  it("accepts only the shared host lifecycle commands", () => {
    expect(gameHostCommandSchema.safeParse({
      command: "start",
      idempotencyKey: "a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5",
    }).success).toBe(true);
    expect(gameHostCommandSchema.safeParse({
      command: "start",
      idempotencyKey: "a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5",
      score: 500,
    }).success).toBe(false);
    expect(gameHostCommandSchema.safeParse({
      command: "reveal-answer",
      idempotencyKey: "a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5",
    }).success).toBe(false);
  });

  it("accepts PIN only for Active joins and rejects it for Independent starts", () => {
    expect(joinActiveMultiplayerGameSessionSchema.safeParse({
      idempotencyKey: "a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5",
      pin: "042681",
    }).success).toBe(true);
    expect(startIndependentSingleplayerGameSessionSchema.safeParse({
      idempotencyKey: "a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5",
      pin: "042681",
    }).success).toBe(false);
  });

  it("exposes typed public, host, and historical response read models", () => {
    const kind: PrismEventGameKind = "this-or-that-solo";
    const lobby: PrismEventGameLobby = {
      eventSlug: "annual-gathering",
      eventName: "Annual Gathering",
      branding: { primaryColor: null, secondaryColor: null, logoUrl: null },
      games: [{
        id: "game-1",
        title: "Choose a side",
        kind,
        availableFrom: null,
        availableUntil: null,
      }],
    };
    const host: PrismGameHostState = {
      eventId: "event-1",
      sessionId: "session-1",
      game: { id: "game-1", title: "Choose a side", kind },
      status: "live",
      scheduledStartAt: null,
      startedAt: "2026-10-08T10:00:00.000Z",
      endedAt: null,
      participantCount: 3,
      currentRound: { number: 1, total: 5 },
      leaderboard: [],
    };
    const participant: PrismGamePublicState = {
      sessionId: "session-1",
      game: { title: "Choose a side", kind },
      status: "live",
      startedAt: "2026-10-08T10:00:00.000Z",
      currentRound: { number: 1, total: 5 },
      currentPrompt: "Tea or coffee?",
      participant: { hasSubmitted: false, score: null },
      aggregateResults: [],
    };
    const responses: PrismGameSessionResponsePage = {
      sessionId: "session-1",
      items: [],
      limit: 25,
      nextCursor: null,
      hasMore: false,
    };

    expect([lobby.games[0].kind, host.status, participant.status, responses.items]).toEqual([
      "this-or-that-solo",
      "live",
      "live",
      [],
    ]);
  });
});
