import {
  PRISM_EVENT_GAME_BRAND_THEMES,
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  eventGameMediaObjectIdSchema,
  eventGameParticipantResultSchema,
  prismEventGameBrandThemeSchema,
  prismEventGameKindSchema,
  readPrismSession,
  savePrismSession,
  type PrismEventGameLobby,
  type PrismEventGameSummary,
  type PrismGamePublicState,
  type PrismEventGameMediaAuthorization,
  type PrismSubmitEventGameActionInput,
} from "@prism/types";
import { createEventOpsClient, PrismApiError } from "@prism/api-client";
import {
  isActiveMultiplayerGameKind,
  isValidGamePin,
  normalizeGamePin,
} from "../model/event-game-entry-rules";

export interface GuestGameParticipantSession {
  eventId: string;
  currentSessionId: string | null;
  participantCredential: string;
}

const SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.gameParticipant;
const SESSION_FIELDS = new Set(["eventId", "currentSessionId", "participantCredential"]);
const PARTICIPANT_CREDENTIAL_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PIN_ERROR = "Enter the 6-digit game PIN.";
const JOIN_ERROR = "This game is unavailable. Check the PIN and try again.";
const LOBBY_ERROR = "This event games link is unavailable. Check the link and try again.";
const START_ERROR = "This event game is not available right now. Return to the event lobby and try again.";
const SESSION_ERROR = "This game session is not available on this device.";
const EXPIRED_SESSION_ERROR = "This game session is no longer available. Join again with its PIN or event link.";
const ACTION_ERROR = "Your response could not be sent. Refresh the game and try again.";
const MEDIA_ERROR = "This game image is not available right now.";
const GAME_SESSION_STATUSES = new Set<PrismGamePublicState["status"]>([
  "scheduled", "lobby", "live", "paused", "completed", "cancelled",
]);

const eventGames = createEventOpsClient().eventGames;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGuestGameParticipantSession(value: unknown): value is GuestGameParticipantSession {
  if (!isRecord(value)) return false;
  return typeof value.eventId === "string" && value.eventId.length > 0
    && (value.currentSessionId === null || (typeof value.currentSessionId === "string" && value.currentSessionId.length > 0))
    && typeof value.participantCredential === "string"
    && PARTICIPANT_CREDENTIAL_PATTERN.test(value.participantCredential);
}

function readSession(): GuestGameParticipantSession | null {
  const stored = readPrismSession<unknown>(SESSION_KEY);
  if (!stored) return null;
  if (!isGuestGameParticipantSession(stored)) {
    clearPrismSession(SESSION_KEY);
    return null;
  }
  const session = {
    eventId: stored.eventId,
    currentSessionId: stored.currentSessionId,
    participantCredential: stored.participantCredential,
  };
  if (Object.keys(stored).some((field) => !SESSION_FIELDS.has(field))) {
    savePrismSession(SESSION_KEY, session);
  }
  return session;
}

function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

function apiErrorDetails(error: unknown): { status: number | null; message: string | null } {
  if (error instanceof PrismApiError) {
    return { status: error.status, message: error.problem.message };
  }
  if (!isRecord(error)) return { status: null, message: null };
  return {
    status: typeof error.status === "number" ? error.status : null,
    message: typeof error.message === "string" ? error.message : null,
  };
}

function isRejectedParticipantCredential(error: unknown): boolean {
  const details = apiErrorDetails(error);
  return details.status === 403 && details.message === "Participant credential is not valid for this event";
}

function isGameSessionStatus(value: unknown): value is PrismGamePublicState["status"] {
  return typeof value === "string" && GAME_SESSION_STATUSES.has(value as PrismGamePublicState["status"]);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function sanitizeBrandColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}

function sanitizeBrandLogoUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname && !url.username && !url.password ? value : null;
  } catch {
    return null;
  }
}

function hasValidCurrentRoundShape(
  value: Record<string, unknown>,
): value is Record<string, unknown> & { key: string; number: number; total: number } {
  return typeof value.key === "string" && /^[A-Za-z0-9:_-]{1,120}$/.test(value.key)
    && isPositiveInteger(value.number) && isPositiveInteger(value.total);
}

function isValidCurrentRoundDeadline(value: unknown): boolean {
  return value === undefined || value === null
    || (typeof value === "string" && Number.isFinite(Date.parse(value)));
}

function sanitizeCurrentRound(value: unknown): PrismGamePublicState["currentRound"] | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (!hasValidCurrentRoundShape(value) || !isValidCurrentRoundDeadline(value.deadlineAt)) return undefined;
  return {
    key: value.key,
    number: value.number,
    total: value.total,
    ...(value.deadlineAt !== undefined ? { deadlineAt: value.deadlineAt as string | null } : {}),
  };
}

function hasParticipantStateShape(
  value: unknown,
): value is Record<string, unknown> & { participantAlias: string; hasSubmitted: boolean; score: number | null; hasVoted?: boolean } {
  return isRecord(value) && typeof value.participantAlias === "string"
    && /^Guest [A-F0-9]{10}$/.test(value.participantAlias)
    && typeof value.hasSubmitted === "boolean" && isNullableFiniteNumber(value.score)
    && (value.hasVoted === undefined || typeof value.hasVoted === "boolean");
}

function sanitizeParticipantResult(value: unknown): PrismGamePublicState["participant"]["result"] | undefined {
  const parsed = eventGameParticipantResultSchema.safeParse(value);
  return parsed.success && parsed.data.kind === "singleplayer-choice" ? parsed.data : undefined;
}

function sanitizeParticipant(value: unknown): PrismGamePublicState["participant"] | null {
  if (!hasParticipantStateShape(value)) return null;
  const participantResult = sanitizeParticipantResult(value.result);
  const gameData = sanitizeParticipantGameData(value.gameData);
  return {
    participantAlias: value.participantAlias,
    hasSubmitted: value.hasSubmitted,
    ...(typeof value.hasVoted === "boolean" ? { hasVoted: value.hasVoted } : {}),
    score: value.score,
    ...(participantResult ? { result: participantResult } : {}),
    ...(gameData ? { gameData } : {}),
  };
}

function sanitizeParticipantGameData(value: unknown): PrismGamePublicState["participant"]["gameData"] | undefined {
  if (!isRecord(value)) return undefined;
  const trivia = sanitizeTriviaGameData(value);
  if (trivia) return trivia;
  const bingo = sanitizeBingoGameData(value);
  if (bingo) return bingo;
  const picture = sanitizePictureGameData(value);
  if (picture) return picture;
  const wordScramble = sanitizeWordScrambleGameData(value);
  if (wordScramble) return wordScramble;
  const pictureSolo = sanitizePictureSoloGameData(value);
  if (pictureSolo) return pictureSolo;
  const spotTheDifference = sanitizeSpotTheDifferenceGameData(value);
  if (spotTheDifference) return spotTheDifference;
  const thisOrThat = sanitizeThisOrThatGameData(value);
  if (thisOrThat) return thisOrThat;
  const familyFeud = sanitizeFamilyFeudGameData(value);
  if (familyFeud) return familyFeud;
  return sanitizeSplitTheRoomGameData(value);
}

function sanitizeWordScrambleGameData(value: Record<string, unknown>): PrismGamePublicState["participant"]["gameData"] | undefined {
  if (value.kind !== "word-scramble") return undefined;
  return { kind: "word-scramble" };
}

function sanitizePictureSoloGameData(value: Record<string, unknown>): PrismGamePublicState["participant"]["gameData"] | undefined {
  if (value.kind !== "guess-picture-solo" || !isPositiveInteger(value.stage)
    || !isPositiveInteger(value.totalStages) || value.totalStages > 10 || value.stage > value.totalStages) return undefined;
  const mediaObjectId = eventGameMediaObjectIdSchema.safeParse(value.mediaObjectId);
  if (!mediaObjectId.success) return undefined;
  return { kind: "guess-picture-solo", mediaObjectId: mediaObjectId.data, stage: value.stage, totalStages: value.totalStages };
}

function sanitizeSpotTheDifferenceGameData(value: Record<string, unknown>): PrismGamePublicState["participant"]["gameData"] | undefined {
  if (value.kind !== "spot-the-difference" || !isPositiveInteger(value.totalDifferences) || value.totalDifferences > 12) return undefined;
  const originalMediaObjectId = eventGameMediaObjectIdSchema.safeParse(value.originalMediaObjectId);
  const comparisonMediaObjectId = eventGameMediaObjectIdSchema.safeParse(value.comparisonMediaObjectId);
  if (!originalMediaObjectId.success || !comparisonMediaObjectId.success
    || originalMediaObjectId.data === comparisonMediaObjectId.data) return undefined;
  return {
    kind: "spot-the-difference",
    originalMediaObjectId: originalMediaObjectId.data,
    comparisonMediaObjectId: comparisonMediaObjectId.data,
    totalDifferences: value.totalDifferences,
  };
}

function sanitizeTriviaGameData(value: Record<string, unknown>): PrismGamePublicState["participant"]["gameData"] | undefined {
  if (value.kind !== "live-trivia" || !Array.isArray(value.options)) return undefined;
  const options = value.options;
  if (options.length < 2 || options.length > 6
    || !options.every((option) => typeof option === "string" && option.trim().length > 0 && option.length <= 120)) return undefined;
  return { kind: "live-trivia", options: options as string[] };
}

function isValidBingoCard(value: unknown): value is Array<number | "FREE"> {
  if (!Array.isArray(value) || value.length !== 25 || value.filter((cell) => cell === "FREE").length !== 1) return false;
  if (!value.every((cell) => cell === "FREE" || (typeof cell === "number" && Number.isInteger(cell) && cell >= 1 && cell <= 75))) return false;
  return new Set(value.filter((cell): cell is number => typeof cell === "number")).size === 24;
}

function isValidBingoCalls(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.every((number) => typeof number === "number" && Number.isInteger(number) && number >= 1 && number <= 75);
}

function sanitizeBingoGameData(value: Record<string, unknown>): PrismGamePublicState["participant"]["gameData"] | undefined {
  if (value.kind !== "bingo" || !isValidBingoCard(value.card) || !isValidBingoCalls(value.calledNumbers)) return undefined;
  return { kind: "bingo", card: value.card, calledNumbers: value.calledNumbers };
}

function sanitizePictureGameData(value: Record<string, unknown>): PrismGamePublicState["participant"]["gameData"] | undefined {
  if (value.kind !== "guess-picture" || !isPositiveInteger(value.stage)) return undefined;
  const mediaObjectId = eventGameMediaObjectIdSchema.safeParse(value.mediaObjectId);
  if (!mediaObjectId.success) return undefined;
  return { kind: "guess-picture", mediaObjectId: mediaObjectId.data, stage: value.stage };
}

function sanitizePublicChoices(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length !== 2
    || !value.every((option) => typeof option === "string" && option.trim().length > 0 && option.length <= 120)) return null;
  return value;
}

function sanitizeThisOrThatGameData(value: Record<string, unknown>): PrismGamePublicState["participant"]["gameData"] | undefined {
  const options = sanitizePublicChoices(value.options);
  if (value.kind !== "this-or-that" || !options) return undefined;
  return { kind: "this-or-that", options };
}

function sanitizeFamilyFeudGameData(value: Record<string, unknown>): PrismGamePublicState["participant"]["gameData"] | undefined {
  if (value.kind !== "family-feud" || typeof value.teamLabel !== "string"
    || !value.teamLabel.trim() || value.teamLabel.length > 80) return undefined;
  return { kind: "family-feud", teamLabel: value.teamLabel };
}

function sanitizeSplitTheRoomGameData(value: Record<string, unknown>): PrismGamePublicState["participant"]["gameData"] | undefined {
  const options = sanitizePublicChoices(value.options);
  if (value.kind !== "split-the-room" || !options
    || typeof value.maxResponseLength !== "number" || !Number.isInteger(value.maxResponseLength)
    || value.maxResponseLength < 20 || value.maxResponseLength > 500) return undefined;
  return { kind: "split-the-room", options, maxResponseLength: value.maxResponseLength };
}

function sanitizeParticipantMediaAuthorization(value: unknown): PrismEventGameMediaAuthorization {
  if (!isRecord(value) || typeof value.downloadUrl !== "string" || typeof value.expiresAt !== "string") throw new Error(MEDIA_ERROR);
  const downloadUrl = new URL(value.downloadUrl);
  const expiresAt = new Date(value.expiresAt);
  if (!new Set(["http:", "https:"]).has(downloadUrl.protocol) || downloadUrl.username || downloadUrl.password
    || Number.isNaN(expiresAt.getTime())) throw new Error(MEDIA_ERROR);
  return { downloadUrl: downloadUrl.toString(), expiresAt: expiresAt.toISOString() };
}

function sanitizeAggregateResults(value: unknown): PrismGamePublicState["aggregateResults"] | null {
  if (!Array.isArray(value)) return null;
  return value.slice(0, 20).flatMap((candidate) => {
    if (!isRecord(candidate) || typeof candidate.label !== "string" || !isNonNegativeSafeInteger(candidate.count)) {
      return [];
    }
    return [{ label: candidate.label.slice(0, 120), count: candidate.count }];
  });
}

const PUBLIC_COMPETITIVE_GAME_KINDS = new Set<PrismGamePublicState["game"]["kind"]>([
  "live-trivia", "bingo", "guess-picture", "spin-wheel", "family-feud",
]);

function sanitizeSessionResult(value: unknown): PrismGamePublicState["sessionResult"] | undefined {
  const parsed = eventGameParticipantResultSchema.safeParse(value);
  return parsed.success && parsed.data.kind === "spin-wheel" ? parsed.data : undefined;
}

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : undefined;
}

function sanitizeLeaderboardEntry(
  candidate: unknown,
): NonNullable<PrismGamePublicState["leaderboard"]>[number] | null {
  if (!isRecord(candidate)) return null;
  const rank = isPositiveInteger(candidate.rank) ? candidate.rank : undefined;
  const score = isNonNegativeSafeInteger(candidate.score) ? candidate.score : undefined;
  const label = boundedText(candidate.label, 120);
  if (rank === undefined || score === undefined || label === undefined) return null;
  const teamLabel = boundedText(candidate.teamLabel, 80);
  return {
    rank,
    label,
    score,
    ...(teamLabel ? { teamLabel } : {}),
  };
}

function sanitizePublicLeaderboard(
  value: unknown,
  gameKind: PrismGamePublicState["game"]["kind"],
): PrismGamePublicState["leaderboard"] | undefined {
  if (!PUBLIC_COMPETITIVE_GAME_KINDS.has(gameKind)) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, 20).flatMap((candidate) => {
    const entry = sanitizeLeaderboardEntry(candidate);
    return entry ? [entry] : [];
  });
}

function sanitizeApprovedResponses(
  value: unknown,
  kind: PrismGamePublicState["game"]["kind"],
  status: PrismGamePublicState["status"],
): readonly string[] | undefined {
  if (kind !== "split-the-room" || status !== "paused" || !Array.isArray(value)) return undefined;
  return value.slice(0, 100).flatMap((response) =>
    typeof response === "string" && response.trim().length > 0 && response.length <= 500
      ? [response]
      : [],
  );
}

function requireStateRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(SESSION_ERROR);
  return value;
}

function requireNonEmptyText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(SESSION_ERROR);
  return value;
}

function requireNullableText(value: unknown): string | null {
  if (!isNullableString(value)) throw new Error(SESSION_ERROR);
  return value;
}

function requireGameKind(value: unknown): PrismGamePublicState["game"]["kind"] {
  const parsed = prismEventGameKindSchema.safeParse(value);
  if (!parsed.success) throw new Error(SESSION_ERROR);
  return parsed.data;
}

function requireGameStatus(value: unknown): PrismGamePublicState["status"] {
  if (!isGameSessionStatus(value)) throw new Error(SESSION_ERROR);
  return value;
}

async function resolveExpectedEventId(eventSlug?: string): Promise<string | null> {
  if (!eventSlug) return null;
  try {
    return (await eventGamesGuestRepository.getPublicLobby(eventSlug)).eventId;
  } catch {
    throw new Error(JOIN_ERROR);
  }
}

function clearRejectedCredential(retainedCredential: string | undefined, error: unknown): void {
  if (retainedCredential && isRejectedParticipantCredential(error)) {
    clearPrismSession(SESSION_KEY);
  }
}

function isValidActiveJoinResult(
  joined: Awaited<ReturnType<typeof eventGames.joinActiveMultiplayerGameSession>>,
  expectedEventId: string | null,
): boolean {
  return isActiveMultiplayerGameKind(joined.game.kind)
    && (expectedEventId === null || joined.eventId === expectedEventId);
}

function sanitizePublicLobby(value: unknown): PrismEventGameLobby {
  if (!isRecord(value) || typeof value.eventId !== "string" || typeof value.eventSlug !== "string"
    || typeof value.eventName !== "string" || !isRecord(value.branding) || !Array.isArray(value.games)) {
    throw new Error(LOBBY_ERROR);
  }

  const parsedTheme = prismEventGameBrandThemeSchema.safeParse(value.branding.theme);
  const theme = parsedTheme.success ? parsedTheme.data : "prism";
  const colors = PRISM_EVENT_GAME_BRAND_THEMES[theme];
  const games: PrismEventGameSummary[] = value.games.flatMap((candidate) => {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || typeof candidate.title !== "string") return [];
    const kind = prismEventGameKindSchema.safeParse(candidate.kind);
    if (!kind.success) return [];
    return [{
      id: candidate.id,
      title: candidate.title,
      kind: kind.data,
      availableFrom: typeof candidate.availableFrom === "string" ? candidate.availableFrom : null,
      availableUntil: typeof candidate.availableUntil === "string" ? candidate.availableUntil : null,
    }];
  });

  return {
    eventId: value.eventId,
    eventSlug: value.eventSlug,
    eventName: value.eventName,
    branding: {
      theme,
      primaryColor: sanitizeBrandColor(value.branding.primaryColor, colors.primaryColor),
      secondaryColor: sanitizeBrandColor(value.branding.secondaryColor, colors.secondaryColor),
      logoUrl: sanitizeBrandLogoUrl(value.branding.logoUrl),
    },
    games,
  };
}

function sanitizePublicParticipantState(value: unknown, expectedSessionId: string): PrismGamePublicState {
  const state = requireStateRecord(value);
  if (state.sessionId !== expectedSessionId) throw new Error(SESSION_ERROR);
  return mapPublicParticipantState(state, expectedSessionId);
}

interface ValidPublicParticipantState {
  title: string;
  kind: PrismGamePublicState["game"]["kind"];
  status: PrismGamePublicState["status"];
  startedAt: string | null;
  serverTime?: string;
  currentRound: NonNullable<PrismGamePublicState["currentRound"]> | null;
  currentPrompt: string | null;
  participant: PrismGamePublicState["participant"];
  aggregateResults: PrismGamePublicState["aggregateResults"];
}

function parsePublicParticipantState(state: Record<string, unknown>): ValidPublicParticipantState {
  const game = requireStateRecord(state.game);
  const title = requireNonEmptyText(game.title);
  const kind = requireGameKind(game.kind);
  const status = requireGameStatus(state.status);
  const startedAt = requireNullableText(state.startedAt);
  const currentPrompt = requireNullableText(state.currentPrompt);
  const serverTime = sanitizeServerTime(state.serverTime);
  const currentRound = sanitizeCurrentRound(state.currentRound);
  if (currentRound === undefined) throw new Error(SESSION_ERROR);
  const participant = sanitizeParticipant(state.participant);
  if (!participant) throw new Error(SESSION_ERROR);
  const aggregateResults = sanitizeAggregateResults(state.aggregateResults);
  if (!aggregateResults) throw new Error(SESSION_ERROR);
  return { title, kind, status, startedAt, ...(serverTime ? { serverTime } : {}), currentRound, currentPrompt, participant, aggregateResults };
}

function sanitizeServerTime(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error(SESSION_ERROR);
  return value;
}

function participantPublicExtras(
  state: Record<string, unknown>,
  kind: PrismGamePublicState["game"]["kind"],
  status: PrismGamePublicState["status"],
): Pick<PrismGamePublicState, "sessionResult" | "leaderboard" | "approvedResponses"> {
  const approvedResponses = sanitizeApprovedResponses(state.approvedResponses, kind, status);
  const sessionResult = sanitizeSessionResult(state.sessionResult);
  const leaderboard = sanitizePublicLeaderboard(state.leaderboard, kind);
  return {
    ...(sessionResult ? { sessionResult } : {}),
    ...(leaderboard ? { leaderboard } : {}),
    ...(approvedResponses?.length ? { approvedResponses } : {}),
  };
}

function mapPublicParticipantState(state: Record<string, unknown>, expectedSessionId: string): PrismGamePublicState {
  const parsed = parsePublicParticipantState(state);
  return {
    sessionId: expectedSessionId,
    game: { title: parsed.title.slice(0, 120), kind: parsed.kind },
    status: parsed.status,
    startedAt: parsed.startedAt,
    ...(parsed.serverTime ? { serverTime: parsed.serverTime } : {}),
    currentRound: parsed.currentRound,
    currentPrompt: parsed.currentPrompt === null ? null : parsed.currentPrompt.slice(0, 500),
    participant: parsed.participant,
    aggregateResults: parsed.aggregateResults,
    ...participantPublicExtras(state, parsed.kind, parsed.status),
  };
}

function storeSession(
  eventId: string,
  sessionId: string,
  participantCredential: string,
): GuestGameParticipantSession {
  const session: GuestGameParticipantSession = {
    eventId,
    currentSessionId: sessionId,
    participantCredential,
  };
  savePrismSession(SESSION_KEY, session);
  return session;
}

export const eventGamesGuestRepository = {
  readParticipantSession: readSession,

  clearParticipantSession(): void {
    clearPrismSession(SESSION_KEY);
  },

  async getPublicLobby(eventSlug: string): Promise<PrismEventGameLobby> {
    try {
      const lobby = sanitizePublicLobby(await eventGames.getPublicLobby(eventSlug));
      if (lobby.eventSlug !== eventSlug) throw new Error(LOBBY_ERROR);
      return lobby;
    } catch {
      throw new Error(LOBBY_ERROR);
    }
  },

  async joinActiveGameByPin(rawPin: string, expectedEventSlug?: string) {
    const pin = normalizeGamePin(rawPin);
    if (!isValidGamePin(pin)) throw new Error(PIN_ERROR);

    const expectedEventId = await resolveExpectedEventId(expectedEventSlug);

    const previous = readSession();
    const retainedCredential = expectedEventId && previous && previous.eventId === expectedEventId
      ? previous.participantCredential
      : undefined;
    try {
      const joined = await eventGames.joinActiveMultiplayerGameSession(
        {
          pin,
          idempotencyKey: newIdempotencyKey(),
          ...(expectedEventId ? { expectedEventId } : {}),
        },
        retainedCredential,
      );
      if (!isValidActiveJoinResult(joined, expectedEventId)) throw new Error(JOIN_ERROR);
      storeSession(joined.eventId, joined.sessionId, joined.participantCredential);
      return joined;
    } catch (error) {
      clearRejectedCredential(retainedCredential, error);
      throw new Error(JOIN_ERROR);
    }
  },

  async startIndependentGame(eventSlug: string, gameId: string) {
    const lobby = await this.getPublicLobby(eventSlug);
    if (!lobby.games.some((game) => game.id === gameId)) throw new Error(START_ERROR);

    const previous = readSession();
    const retainedCredential = previous?.eventId === lobby.eventId ? previous.participantCredential : undefined;
    try {
      const started = await eventGames.startIndependentSingleplayerGameSession(eventSlug, gameId, {
        idempotencyKey: newIdempotencyKey(),
        ...(retainedCredential ? { participantCredential: retainedCredential } : {}),
      });
      if (started.eventId !== lobby.eventId || !lobby.games.some((game) => game.id === gameId)) {
        throw new Error(START_ERROR);
      }
      storeSession(started.eventId, started.sessionId, started.participantCredential);
      return started;
    } catch (error) {
      if (retainedCredential && isRejectedParticipantCredential(error)) this.clearParticipantSession();
      throw new Error(START_ERROR);
    }
  },

  async getParticipantState(sessionId: string): Promise<PrismGamePublicState> {
    const session = readSession();
    if (!session || session.currentSessionId !== sessionId) throw new Error(SESSION_ERROR);
    try {
      const state = sanitizePublicParticipantState(
        await eventGames.getParticipantState(sessionId, session.participantCredential),
        sessionId,
      );
      if (state.status === "completed" || state.status === "cancelled") {
        savePrismSession(SESSION_KEY, { ...session, currentSessionId: null });
      }
      return state;
    } catch (error) {
      const { status } = apiErrorDetails(error);
      if (status === 401 || status === 403 || status === 404 || status === 410) {
        this.clearParticipantSession();
        throw new Error(EXPIRED_SESSION_ERROR);
      }
      throw new Error("Game updates are unavailable. Try again in a moment.");
    }
  },

  async submitParticipantAction(
    sessionId: string,
    input: PrismSubmitEventGameActionInput,
  ): Promise<PrismGamePublicState> {
    const session = readSession();
    if (!session || session.currentSessionId !== sessionId) throw new Error(SESSION_ERROR);
    try {
      const state = sanitizePublicParticipantState(
        await eventGames.submitAction(sessionId, input, session.participantCredential),
        sessionId,
      );
      if (state.status === "completed" || state.status === "cancelled") {
        savePrismSession(SESSION_KEY, { ...session, currentSessionId: null });
      }
      return state;
    } catch (error) {
      const { status } = apiErrorDetails(error);
      if (status === 401 || status === 403 || status === 404 || status === 410) {
        this.clearParticipantSession();
        throw new Error(EXPIRED_SESSION_ERROR);
      }
      throw new Error(ACTION_ERROR);
    }
  },

  async getParticipantMediaAuthorization(sessionId: string, objectId: string): Promise<PrismEventGameMediaAuthorization> {
    const session = readSession();
    if (!session || session.currentSessionId !== sessionId) throw new Error(SESSION_ERROR);
    const parsedId = eventGameMediaObjectIdSchema.safeParse(objectId);
    if (!parsedId.success) throw new Error(MEDIA_ERROR);
    try {
      const value = await eventGames.getParticipantMediaAuthorization(sessionId, parsedId.data, session.participantCredential);
      return sanitizeParticipantMediaAuthorization(value);
    } catch {
      throw new Error(MEDIA_ERROR);
    }
  },
};
