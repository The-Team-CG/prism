import { randomUUID } from "node:crypto";
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
  assignEventGameAwardSchema,
  eventGameTemplateConfigurationSchema,
  activeMultiplayerGameActionSchema,
  gameHostCommandSchema,
  submitEventGameActionSchema,
  moderateEventGameSchema,
  joinActiveMultiplayerGameSessionSchema,
  joinedMultiplayerGameSessionSchema,
  prismEventGameBrandThemeSchema,
  prismEventGameKindSchema,
  requestEventGameMediaUploadSchema,
  requestEventGameLobbyLogoUploadSchema,
  startIndependentSingleplayerGameSessionSchema,
  updateEventGameLobbyBrandingSchema,
  updateEventGameSchema,
} from "./event-games-inputs.js";
import { storageUsageSchema } from "./storage.js";

function createFixtureUuid(version = "4"): string {
  const parts = randomUUID().split("-");
  parts[2] = version + (parts[2] ?? "").slice(1);
  return parts.join("-");
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

  it("accepts only strict, mode-matched Active (Multiplayer) configurations", () => {
    const configurations = [
      {
        kind: "live-trivia",
        rounds: [{
          key: "round-1", prompt: "Which answer is correct?", options: ["A", "B"],
          correctAnswer: "B", points: 100, durationSeconds: 30, speedBonusPoints: 20,
        }],
      },
      {
        kind: "bingo", callSequence: Array.from({ length: 24 }, (_, index) => index + 1),
        callIntervalSeconds: 10, winPattern: "line", points: 100,
      },
      {
        kind: "guess-picture", mediaObjectId: TEST_FIXTURES.gameMediaObjectId,
        acceptedAnswers: ["A cat"],
        stages: [{ afterSeconds: 0, hint: "Look closely", points: 100 }],
      },
      {
        kind: "spin-wheel", outcomes: [
          { id: "small", label: "Small prize", weight: 2, points: 5, eligible: true },
          { id: "large", label: "Large prize", weight: 1, points: 20, eligible: true },
        ],
      },
      {
        kind: "this-or-that",
        rounds: [{ key: "round-1", prompt: "Tea or coffee?", options: ["Tea", "Coffee"], durationSeconds: 30 }],
      },
      {
        kind: "family-feud",
        teams: [
          { id: TEST_FIXTURES.primaryId, label: "Blue" },
          { id: TEST_FIXTURES.secondId, label: "Gold" },
        ],
        rounds: [{
          key: "round-1", prompt: "Name a popular fruit.", durationSeconds: 30,
          answers: [{ answer: "Mango", alternatives: ["Mangga"], points: 10 }],
        }],
      },
      {
        kind: "split-the-room",
        rounds: [{
          key: "round-1", prompt: "Would you rather?", leftLabel: "Left", rightLabel: "Right",
          maxResponseLength: 160, durationSeconds: 30,
        }],
      },
    ];

    for (const configuration of configurations) {
      expect(eventGameTemplateConfigurationSchema.safeParse(configuration).success).toBe(true);
    }
    expect(eventGameTemplateConfigurationSchema.safeParse({
      ...configurations[0], answerKey: "forged",
    }).success).toBe(false);
    expect(eventGameTemplateConfigurationSchema.safeParse({
      ...configurations[3], outcomes: [{ id: "only", label: "Only outcome", weight: 1, points: 0, eligible: false }],
    }).success).toBe(false);
    expect(createEventGameSchema.safeParse({
      kind: "bingo", title: "Wrong config", configuration: configurations[0],
    }).success).toBe(false);
    expect(createEventGameSchema.safeParse({
      kind: "live-trivia", title: "Opening trivia", configuration: configurations[0],
    }).success).toBe(true);
    expect(updateEventGameSchema.safeParse({ configuration: configurations[0] }).success).toBe(true);
  });

  it("accepts strict Independent (Singleplayer) puzzle configurations without exposing answer geometry", () => {
    const mediaA = TEST_FIXTURES.gameMediaObjectId;
    const mediaB = TEST_FIXTURES.secondGameMediaObjectId;
    const spotDifferenceConfiguration = {
      kind: "spot-the-difference",
      rounds: [{
        key: "difference-1", originalMediaObjectId: mediaA, comparisonMediaObjectId: mediaB, durationSeconds: 120,
        differences: [
          { x: 0.2, y: 0.3, width: 0.08, height: 0.08, points: 10 },
          { x: 0.7, y: 0.6, width: 0.1, height: 0.12, points: 15 },
        ],
      }],
    };
    const configurations = [
      {
        kind: "word-scramble",
        rounds: [{ key: "word-1", scrambledWord: "SACRIT", answer: "ARCTIC", points: 30, durationSeconds: 60 }],
      },
      {
        kind: "guess-picture-solo",
        rounds: [{
          key: "picture-1", mediaObjectId: mediaA, acceptedAnswers: ["Arctic fox"], durationSeconds: 90,
          stages: [{ afterSeconds: 0, hint: "A winter animal", points: 50 }, { afterSeconds: 30, hint: "It has a white coat", points: 25 }],
        }],
      },
      spotDifferenceConfiguration,
      {
        kind: "would-you-rather",
        rounds: [{ key: "rather-1", prompt: "Would you rather?", options: ["Fly", "Be invisible"], durationSeconds: 45, aggregateResults: false }],
      },
      {
        kind: "this-or-that-solo",
        rounds: [{ key: "solo-choice-1", prompt: "Tea or coffee?", options: ["Tea", "Coffee"], durationSeconds: 45 }],
      },
    ];

    for (const configuration of configurations) {
      expect(eventGameTemplateConfigurationSchema.safeParse(configuration).success).toBe(true);
    }
    expect(eventGameTemplateConfigurationSchema.safeParse({
      ...spotDifferenceConfiguration, rounds: [{
        ...spotDifferenceConfiguration.rounds[0],
        differences: [{ ...spotDifferenceConfiguration.rounds[0].differences[0], x: 0.95 }],
      }],
    }).success).toBe(false);
    expect(eventGameTemplateConfigurationSchema.safeParse({
      ...configurations[1], rounds: [{ ...configurations[1].rounds[0], acceptedAnswers: ["Fox", " fox "] }],
    }).success).toBe(false);
    expect(createEventGameSchema.safeParse({ kind: "word-scramble", title: "Word game", configuration: configurations[0] }).success).toBe(true);
    expect(createEventGameSchema.safeParse({ kind: "word-scramble", title: "Wrong kind", configuration: configurations[1] }).success).toBe(false);
    expect(createEventGameSchema.safeParse({ kind: "would-you-rather", title: "Would you rather?", configuration: configurations[3] }).success).toBe(true);
    expect(createEventGameSchema.safeParse({ kind: "this-or-that-solo", title: "Solo choices", configuration: configurations[4] }).success).toBe(true);
  });

  it("validates each Active (Multiplayer) action with its template-specific payload", () => {
    const actions = [
      {
        templateId: "live-trivia", roundKey: "round-1", actionKind: "answer",
        payload: { answer: "B" },
      },
      {
        templateId: "bingo", roundKey: "call-24", actionKind: "mark",
        payload: { claim: "bingo", markedNumbers: [1, 2, 3] },
      },
      {
        templateId: "guess-picture", roundKey: "picture-1", actionKind: "guess",
        payload: { answer: "a cat" },
      },
      {
        templateId: "this-or-that", roundKey: "round-1", actionKind: "vote",
        payload: { option: "Tea" },
      },
      {
        templateId: "family-feud", roundKey: "round-1", actionKind: "answer",
        payload: { answer: "Mango" },
      },
      {
        templateId: "split-the-room", roundKey: "round-1", actionKind: "answer",
        payload: { response: "I would choose the left side." },
      },
      {
        templateId: "split-the-room", roundKey: "round-1", actionKind: "vote",
        payload: { option: "Left" },
      },
    ];
    for (const action of actions) {
      expect(activeMultiplayerGameActionSchema.safeParse(action).success).toBe(true);
    }
    expect(activeMultiplayerGameActionSchema.safeParse({
      ...actions[0], payload: { answer: "B", points: 100 },
    }).success).toBe(false);
    expect(activeMultiplayerGameActionSchema.safeParse({
      templateId: "spin-wheel", roundKey: "spin-1", actionKind: "spin",
      payload: { spinRequestId: TEST_FIXTURES.primaryId },
    }).success).toBe(false);
    expect(activeMultiplayerGameActionSchema.safeParse({
      ...actions[3], payload: { option: "Unknown" },
    }).success).toBe(true);
    expect(activeMultiplayerGameActionSchema.safeParse({
      ...actions[5], payload: { answer: "Mango", teamId: TEST_FIXTURES.primaryId },
    }).success).toBe(false);
    expect(activeMultiplayerGameActionSchema.safeParse({
      ...actions[6], payload: { response: "x".repeat(501) },
    }).success).toBe(false);
    expect(submitEventGameActionSchema.safeParse(actions[1]).success).toBe(true);
  });

  it("allows a host to request one session-level Spin the Wheel result", () => {
    expect(gameHostCommandSchema.safeParse({
      command: "spin-wheel", idempotencyKey: TEST_FIXTURES.primaryId,
    }).success).toBe(true);
    expect(gameHostCommandSchema.safeParse({
      command: "spin-wheel", idempotencyKey: TEST_FIXTURES.primaryId, roundKey: "spin-1",
    }).success).toBe(false);
  });

  it("accepts only bounded, template-specific Independent (Singleplayer) puzzle actions", () => {
    const actions = [
      { templateId: "word-scramble", roundKey: "word-1", actionKind: "answer", payload: { answer: "Arctic" } },
      { templateId: "guess-picture-solo", roundKey: "picture-1", actionKind: "answer", payload: { answer: "Arctic fox" } },
      { templateId: "spot-the-difference", roundKey: "difference-1", actionKind: "select", payload: { selections: [{ x: 0.21, y: 0.32 }] } },
    ];
    for (const action of actions) {
      expect(submitEventGameActionSchema.safeParse(action).success).toBe(true);
    }
    expect(submitEventGameActionSchema.safeParse({
      ...actions[0], payload: { answer: "Arctic", points: 10 },
    }).success).toBe(false);
    expect(submitEventGameActionSchema.safeParse({
      ...actions[2], payload: { selections: [{ x: 1.01, y: 0.2 }] },
    }).success).toBe(false);
    expect(submitEventGameActionSchema.safeParse({
      ...actions[2], payload: { selections: Array.from({ length: 13 }, () => ({ x: 0.5, y: 0.5 })) },
    }).success).toBe(false);
  });

  it("allows private completion or explicit poll sharing without client-awarded points", () => {
    const actions = [
      { templateId: "would-you-rather", roundKey: "rather-1", actionKind: "complete", payload: { option: "Fly" } },
      { templateId: "would-you-rather", roundKey: "rather-1", actionKind: "vote", payload: { option: "Fly" } },
      { templateId: "this-or-that-solo", roundKey: "solo-choice-1", actionKind: "complete", payload: { option: "Tea" } },
      { templateId: "this-or-that-solo", roundKey: "solo-choice-1", actionKind: "vote", payload: { option: "Tea" } },
    ];
    for (const action of actions) expect(submitEventGameActionSchema.safeParse(action).success).toBe(true);
    expect(submitEventGameActionSchema.safeParse({
      ...actions[3], payload: { option: "Tea", points: 1000 },
    }).success).toBe(false);
    expect(submitEventGameActionSchema.safeParse({
      ...actions[3], payload: { option: "Tea", participationGrantId: "forged" },
    }).success).toBe(false);
  });

  it("accepts organizer availability windows and rejects an end that is not after the start", () => {
    expect(createEventGameSchema.safeParse({
      kind: "word-scramble",
      title: "Word Scramble",
      availableFrom: "2026-10-16T09:00:00.000Z",
      availableUntil: "2026-10-16T10:00:00.000Z",
    }).success).toBe(true);
    expect(updateEventGameSchema.safeParse({
      availableFrom: "2026-10-16T10:00:00.000Z",
      availableUntil: "2026-10-16T09:00:00.000Z",
    }).success).toBe(false);
    expect(createEventGameSchema.safeParse({
      kind: "word-scramble",
      title: "Offset window",
      availableFrom: "2026-10-16T10:00:00+02:00",
      availableUntil: "2026-10-16T09:00:00Z",
    }).success).toBe(true);
    expect(createEventGameSchema.safeParse({
      kind: "word-scramble",
      title: "Reverse offset window",
      availableFrom: "2026-10-16T10:00:00Z",
      availableUntil: "2026-10-16T10:30:00+02:00",
    }).success).toBe(false);
  });

  it("updates only mutable draft metadata and rejects empty or authoritative updates", () => {
    expect(updateEventGameSchema.safeParse({ title: "Updated title" }).success).toBe(true);
    expect(updateEventGameSchema.safeParse({}).success).toBe(false);
    expect(updateEventGameSchema.safeParse({ kind: "bingo" }).success).toBe(false);
    expect(updateEventGameSchema.safeParse({ actorId: "guest-1" }).success).toBe(false);
  });
  it("accepts only bounded storage IDs for game media", () => {
    const mediaObjectId = TEST_FIXTURES.gameMediaObjectId;

    expect(updateEventGameSchema.safeParse({ mediaObjectIds: [mediaObjectId] }).success).toBe(true);
    expect(updateEventGameSchema.safeParse({ mediaObjectIds: ["https://example.test/image.png"] }).success).toBe(false);
    expect(updateEventGameSchema.safeParse({ mediaObjectIds: [mediaObjectId, mediaObjectId] }).success).toBe(false);
    expect(updateEventGameSchema.safeParse({ mediaObjectIds: Array(21).fill(mediaObjectId) }).success).toBe(false);
  });

  it("creates a session with a game reference and optional ISO schedule only", () => {
    expect(createGameSessionSchema.safeParse({ gameId: TEST_FIXTURES.primaryId }).success).toBe(true);
    expect(createGameSessionSchema.safeParse({
      gameId: TEST_FIXTURES.primaryId,
      scheduledStartAt: "2026-10-08T10:00:00.000Z",
    }).success).toBe(true);
    expect(createGameSessionSchema.safeParse({
      gameId: TEST_FIXTURES.primaryId,
      eventId: "event-1",
    }).success).toBe(false);
  });

  it("accepts only the shared host lifecycle commands", () => {
    expect(gameHostCommandSchema.safeParse({
      command: "start",
      idempotencyKey: TEST_FIXTURES.primaryId,
    }).success).toBe(true);
    expect(gameHostCommandSchema.safeParse({
      command: "start",
      idempotencyKey: TEST_FIXTURES.primaryId,
      score: 500,
    }).success).toBe(false);
    expect(gameHostCommandSchema.safeParse({
      command: "reveal-answer",
      idempotencyKey: TEST_FIXTURES.primaryId,
    }).success).toBe(false);
  });

  it("requires a current round key for the host next-round command", () => {
    const idempotencyKey = TEST_FIXTURES.primaryId;
    expect(gameHostCommandSchema.safeParse({ command: "advance-round", idempotencyKey, roundKey: "round-2" }).success).toBe(true);
    expect(gameHostCommandSchema.safeParse({ command: "advance-round", idempotencyKey }).success).toBe(false);
    expect(gameHostCommandSchema.safeParse({ command: "pause", idempotencyKey, roundKey: "round-2" }).success).toBe(false);
  });

  it("validates lobby colors, logo object references, and idempotency keys", () => {
    const idempotencyKey = TEST_FIXTURES.primaryId;
    const logoObjectId = TEST_FIXTURES.lobbyLogoObjectId;
    expect(prismEventGameBrandThemeSchema.safeParse("forest").success).toBe(true);
    expect(prismEventGameBrandThemeSchema.safeParse("custom").success).toBe(false);
    expect(updateEventGameLobbyBrandingSchema.safeParse({ theme: "forest", idempotencyKey }).success).toBe(true);
    expect(updateEventGameLobbyBrandingSchema.safeParse({ theme: "custom", idempotencyKey }).success).toBe(false);
    expect(updateEventGameLobbyBrandingSchema.safeParse({ theme: "forest", idempotencyKey, primaryColor: "#fff" }).success).toBe(false);
    expect(updateEventGameLobbyBrandingSchema.safeParse({
      theme: "forest", idempotencyKey, primaryColor: "#14532D", secondaryColor: "#166534", logoObjectId,
    }).success).toBe(true);
    expect(updateEventGameLobbyBrandingSchema.safeParse({ theme: "forest", idempotencyKey, primaryColor: "#FFFFFF" }).success).toBe(false);
    expect(updateEventGameLobbyBrandingSchema.safeParse({ theme: "forest", idempotencyKey, logoObjectId: "https://example.test/logo.png" }).success).toBe(false);
    expect(updateEventGameLobbyBrandingSchema.safeParse({ theme: "forest" }).success).toBe(false);
    expect(storageUsageSchema.safeParse("event_game_branding").success).toBe(true);
    expect(requestEventGameLobbyLogoUploadSchema.safeParse({
      fileName: "logo.png", contentType: "image/png", declaredByteSize: 512,
      checksumSha256: "a".repeat(64), idempotencyKey,
    }).success).toBe(true);
    expect(requestEventGameLobbyLogoUploadSchema.safeParse({
      fileName: "logo.svg", contentType: "image/svg+xml", declaredByteSize: 512,
      checksumSha256: "a".repeat(64), idempotencyKey,
    }).success).toBe(false);
    expect(requestEventGameMediaUploadSchema.safeParse({
      fileName: "clue.png", contentType: "image/png", declaredByteSize: 8 * 1024 * 1024,
      checksumSha256: "b".repeat(64), idempotencyKey,
    }).success).toBe(true);
    expect(requestEventGameMediaUploadSchema.safeParse({
      fileName: "clue.webp", contentType: "image/webp", declaredByteSize: 512,
      checksumSha256: "b".repeat(64), idempotencyKey,
    }).success).toBe(false);
    expect(requestEventGameMediaUploadSchema.safeParse({
      fileName: "clue.png", contentType: "image/png", declaredByteSize: 8 * 1024 * 1024 + 1,
      checksumSha256: "b".repeat(64), idempotencyKey,
    }).success).toBe(false);
  });

  it("validates the minimal successful multiplayer join response and rejects malformed data", () => {
    const response = {
      eventId: "event-1",
      sessionId: "session-1",
      game: { title: "Opening Trivia", kind: "live-trivia" },
      status: "lobby",
      participantCredential: "A".repeat(43),
    };

    expect(joinedMultiplayerGameSessionSchema.safeParse(response).success).toBe(true);
    expect(joinedMultiplayerGameSessionSchema.safeParse({ ...response, participantCredential: "short" }).success).toBe(false);
    expect(joinedMultiplayerGameSessionSchema.safeParse({ ...response, privateAnswerKey: "A" }).success).toBe(false);
    expect(joinedMultiplayerGameSessionSchema.safeParse({ ...response, status: "completed" }).success).toBe(false);
  });

  it("accepts bounded player actions and rejects client-owned scoring or identity fields", () => {
    const action = {
      roundKey: "round-1",
      actionKind: "answer",
      payload: { answer: "B" },
    };

    expect(submitEventGameActionSchema.safeParse(action).success).toBe(true);
    for (const field of [
      "isCorrect", "is_correct", "points", "score", "teamId", "team_id",
      "actor", "actorId", "actor_id", "userId", "participantCredential",
      "answerKey", "answer_key", "correctness", "moderator", "moderatorStatus",
      "moderation_status", "eventId", "session_id", "roundNumber", "timestamp",
      "displayName", "display_name", "photoUrl", "photo_url", "profile", "email", "phone",
      "name", "fullName", "participantName", "username", "bio", "imageUrl",
    ]) {
      expect(submitEventGameActionSchema.safeParse({
        ...action,
        payload: { answer: "B", [field]: "forged" },
      }).success).toBe(false);
    }
    expect(submitEventGameActionSchema.safeParse({ ...action, actorId: "guest-1" }).success).toBe(false);
    expect(submitEventGameActionSchema.safeParse({ ...action, roundKey: "" }).success).toBe(false);
    expect(submitEventGameActionSchema.safeParse({ ...action, actionKind: "unsupported" }).success).toBe(false);
  });

  it("requires audited moderation targets and bounded, role-neutral awards", () => {
    const idempotencyKey = TEST_FIXTURES.primaryId;
    const submissionId = TEST_FIXTURES.secondId;
    const participationGrantId = TEST_FIXTURES.thirdId;
    const teamId = TEST_FIXTURES.fourthId;

    expect(moderateEventGameSchema.safeParse({
      action: "approve_submission", idempotencyKey, submissionId,
    }).success).toBe(true);
    expect(moderateEventGameSchema.safeParse({
      action: "resolve_family_feud_answer", idempotencyKey, submissionId, boardAnswer: "Mango",
    }).success).toBe(true);
    expect(moderateEventGameSchema.safeParse({
      action: "resolve_family_feud_answer", idempotencyKey, submissionId, boardAnswer: null,
    }).success).toBe(true);
    expect(moderateEventGameSchema.safeParse({
      action: "resolve_family_feud_answer", idempotencyKey, submissionId, boardAnswer: "Mango", points: 1000,
    }).success).toBe(false);
    expect(moderateEventGameSchema.safeParse({
      action: "hide_submission", idempotencyKey, submissionId,
      reason: "Contains personal information", actorId: "forged",
    }).success).toBe(false);
    expect(moderateEventGameSchema.safeParse({
      action: "remove_participant", idempotencyKey, participationGrantId,
      reason: "Abusive conduct",
    }).success).toBe(true);
    expect(moderateEventGameSchema.safeParse({
      action: "remove_participant", idempotencyKey, participationGrantId,
    }).success).toBe(false);

    expect(assignEventGameAwardSchema.safeParse({
      idempotencyKey, recipient: { type: "participant", participationGrantId },
      awardKind: "points", label: "Round winner", points: 25,
    }).success).toBe(true);
    expect(assignEventGameAwardSchema.safeParse({
      idempotencyKey, recipient: { type: "team", teamId },
      awardKind: "prize", label: "Gift basket", prizeReference: "prize-1",
    }).success).toBe(true);
    expect(assignEventGameAwardSchema.safeParse({
      idempotencyKey, recipient: { type: "participant", participationGrantId },
      awardKind: "points", label: "Round winner", points: -1,
    }).success).toBe(false);
    expect(assignEventGameAwardSchema.safeParse({
      idempotencyKey, recipient: { type: "team", teamId },
      awardKind: "badge", label: "Winner", teamName: "Caller supplied",
    }).success).toBe(false);
  });

  it("accepts PIN only for Active joins and rejects it for Independent starts", () => {
    expect(joinActiveMultiplayerGameSessionSchema.safeParse({
      idempotencyKey: TEST_FIXTURES.primaryId,
      pin: "042681",
    }).success).toBe(true);
    expect(startIndependentSingleplayerGameSessionSchema.safeParse({
      idempotencyKey: TEST_FIXTURES.primaryId,
      pin: "042681",
    }).success).toBe(false);
    expect(startIndependentSingleplayerGameSessionSchema.safeParse({
      idempotencyKey: TEST_FIXTURES.primaryId,
    }).success).toBe(true);
    expect(startIndependentSingleplayerGameSessionSchema.safeParse({
      idempotencyKey: TEST_FIXTURES.primaryId,
      participantToken: "A".repeat(43),
    }).success).toBe(false);
    expect(startIndependentSingleplayerGameSessionSchema.safeParse({
      idempotencyKey: TEST_FIXTURES.primaryId,
      participantCredential: "A".repeat(43),
    }).success).toBe(true);
    expect(startIndependentSingleplayerGameSessionSchema.safeParse({
      idempotencyKey: TEST_FIXTURES.primaryId,
      participantCredential: "caller-chosen",
    }).success).toBe(false);
  });

  it("leaves malformed PIN rejection to the guest-safe join response and requires UUIDv4 idempotency", () => {
    expect(joinActiveMultiplayerGameSessionSchema.safeParse({
      idempotencyKey: TEST_FIXTURES.primaryId,
      pin: "bad-pin",
    }).success).toBe(true);
    expect(joinActiveMultiplayerGameSessionSchema.safeParse({
      idempotencyKey: TEST_FIXTURES.invalidVersionId,
      pin: "042681",
    }).success).toBe(false);
  });

  it("requires UUIDv4 start idempotency keys", () => {
    expect(startIndependentSingleplayerGameSessionSchema.safeParse({
      idempotencyKey: TEST_FIXTURES.primaryId,
    }).success).toBe(true);
    expect(startIndependentSingleplayerGameSessionSchema.safeParse({
      idempotencyKey: TEST_FIXTURES.invalidVersionId,
    }).success).toBe(false);
  });

  it("exposes typed public, host, and historical response read models", () => {
    const kind: PrismEventGameKind = "this-or-that-solo";
    const lobby: PrismEventGameLobby = {
      eventId: "event-1",
      eventSlug: "annual-gathering",
      eventName: "Annual Gathering",
      branding: { theme: "prism", primaryColor: "#312E81", secondaryColor: "#0F766E", logoUrl: null },
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
      currentRound: { key: "round-1", number: 1, total: 5, prompt: "Choose a side" },
      leaderboard: [],
    };
    const participant: PrismGamePublicState = {
      sessionId: "session-1",
      game: { title: "Choose a side", kind },
      status: "live",
      startedAt: "2026-10-08T10:00:00.000Z",
      currentRound: { key: "round-1", number: 1, total: 5 },
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
