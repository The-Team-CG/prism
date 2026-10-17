import type { PrismCursorPage } from "./event-ops.js";
import type { z } from "zod";
import { joinedMultiplayerGameSessionSchema } from "./schemas/event-games-inputs.js";
import type {
  PrismEventGameBrandTheme,
  PrismEventGameKind,
  PrismJoinActiveMultiplayerGameSessionInput,
} from "./schemas/event-games-inputs.js";

export type PrismGameSessionStatus =
  | "scheduled"
  | "lobby"
  | "live"
  | "paused"
  | "completed"
  | "cancelled";

export type PrismEventGameEntryMode = "active" | "independent";
export type PrismEventGameDefinitionStatus = "draft" | "published" | "removed";

export const PRISM_EVENT_GAME_BRAND_THEMES: Record<
  PrismEventGameBrandTheme,
  { primaryColor: string; secondaryColor: string }
> = {
  prism: { primaryColor: "#312E81", secondaryColor: "#0F766E" },
  ocean: { primaryColor: "#164E63", secondaryColor: "#1D4ED8" },
  sunset: { primaryColor: "#7C2D12", secondaryColor: "#9A3412" },
  forest: { primaryColor: "#14532D", secondaryColor: "#166534" },
};

/** PMCM-owned game definition returned by event-scoped organizer routes. */
export interface PrismEventGameDefinition {
  id: string;
  eventId: string;
  slug: string;
  title: string;
  description?: string;
  instructions?: string;
  kind: PrismEventGameKind;
  entryMode: PrismEventGameEntryMode;
  status: PrismEventGameDefinitionStatus;
  version: number;
  config: Readonly<Record<string, unknown>>;
  availableFrom: string | null;
  availableUntil: string | null;
  configVersionId?: string;
  /** True once any host or independent session for this definition has begun. */
  hasStartedSession?: boolean;
}

/** Host-created session record; the immutable config snapshot stays host-only. */
export interface PrismGameHostSession {
  id: string;
  eventId: string;
  gameId: string;
  configVersionId: string;
  configSnapshot: Readonly<Record<string, unknown>>;
  title: string;
  kind: PrismEventGameKind;
  entryMode: PrismEventGameEntryMode;
  status: PrismGameSessionStatus;
  scheduledStartAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

interface PrismGameHostCommandResultBase {
  eventId: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  resultId: string;
  requestReceiptId: string;
  transition: {
    beforeStatus: string | null;
    afterStatus: string | null;
    beforeVersion: number | null;
    afterVersion: number | null;
  };
}

export interface PrismGameHostPinIssueResult extends PrismGameHostCommandResultBase {
  resourceType: "session";
  action: "enable_joins";
  outcome: "joins_enabled";
  /** Six-digit PIN disclosed once to the authorized host. */
  pin: string;
  expiresAt: string;
}

export interface PrismGameHostCommandTransitionResult extends PrismGameHostCommandResultBase {
  action: "start_session" | "pause_session" | "resume_session" | "end_session" | "cancel_session" | "disable_joins";
}

export type PrismGameHostCommandResult = PrismGameHostPinIssueResult | PrismGameHostCommandTransitionResult;

export interface PrismEventGameSummary {
  id: string;
  title: string;
  kind: PrismEventGameKind;
  description?: string;
  availableFrom: string | null;
  availableUntil: string | null;
}

export interface PrismEventGameLobbyBranding {
  theme: PrismEventGameBrandTheme;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
}

/** Host-only branding state. Public lobby responses omit the stored object ID. */
export interface PrismEventGameHostLobbyBranding extends PrismEventGameLobbyBranding {
  logoObjectId: string | null;
}

export interface PrismEventGameLobbyLogoUploadTicket {
  objectId: string;
  uploadUrl: string | null;
  expiresAt: string | null;
  alreadyStored: boolean;
}

export interface PrismEventGameMediaUploadTicket {
  objectId: string;
  uploadUrl: string | null;
  expiresAt: string | null;
  alreadyStored: boolean;
}

export interface PrismEventGameHostLobby {
  eventSlug: string;
  branding: PrismEventGameHostLobbyBranding;
}

/** Public event lobby data; never includes unpublished games or host settings. */
export interface PrismEventGameLobby {
  eventId: string;
  eventSlug: string;
  eventName: string;
  branding: PrismEventGameLobbyBranding;
  games: PrismEventGameSummary[];
}

/** Minimal result for an anonymous Independent (Singleplayer) start. */
export interface PrismIndependentGameSessionStart {
  eventId: string;
  sessionId: string;
  game: Pick<PrismEventGameSummary, "title" | "kind">;
  status: "live";
  /** The caller supplied this event-scoped credential; the server stores only its digest. */
  participantCredential: string;
}

/** Minimal Active (Multiplayer) PIN join result; no host configuration is returned. */
export type PrismJoinedMultiplayerGameSession = z.infer<typeof joinedMultiplayerGameSessionSchema>;

export type PrismJoinActiveMultiplayerGameInput = PrismJoinActiveMultiplayerGameSessionInput;

export interface PrismGameLeaderboardEntry {
  rank: number;
  label: string;
  score: number;
  teamLabel?: string;
  /** Host-only reference used to assign an event-scoped award. */
  awardRecipient?:
    | { type: "participant"; participationGrantId: string }
    | { type: "team"; teamId: string };
}

/** Guest-visible standing; intentionally omits award assignment references. */
export interface PrismGamePublicLeaderboardEntry {
  rank: number;
  label: string;
  score: number;
  teamLabel?: string;
}

export interface PrismGameHostState {
  eventId: string;
  sessionId: string;
  game: Pick<PrismEventGameSummary, "id" | "title" | "kind">;
  status: PrismGameSessionStatus;
  scheduledStartAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  /** Server game-time snapshot used only to display round countdowns. */
  serverTime?: string;
  participantCount: number;
  /** Host-only current round context; reveal data is present only while paused. */
  currentRound: {
    key: string;
    number: number;
    total: number;
    prompt: string;
    deadlineAt?: string | null;
    revealedAnswer?: string;
    answerBoard?: readonly { answer: string; alternatives: readonly string[]; points: number }[];
    /** Live Split the Room text awaiting host approval or hiding; never sent to participants. */
    pendingSubmissions?: readonly { id: string; roundNumber: number; response: string }[];
    /** Live Family Feud answers awaiting host scoring; never sent to participants. */
    pendingAnswers?: readonly { id: string; roundNumber: number; answer: string }[];
  } | null;
  /** One immutable host-selected result for Spin the Wheel. */
  sessionResult?: PrismGameSessionResult | null;
  aggregateResults?: Array<{ label: string; count: number }>;
  leaderboard: PrismGameLeaderboardEntry[];
}

/** Event-scoped aggregate analytics; contains no participant-level details. */
export interface PrismEventGameAnalytics {
  eventId: string;
  totals: {
    gamesCreated: number;
    sessionsStarted: number;
    sessionsCompleted: number;
    /** Counts event-scoped browser credentials, not verified people. */
    distinctEventParticipants: number;
    participantJoins: number;
    roundsAnswered: number;
    completionRate: number;
  };
  sessions: Array<{
    sessionId: string;
    gameTitle: string;
    kind: PrismEventGameKind;
    status: PrismGameSessionStatus;
    participantJoins: number;
    roundsAnswered: number;
  }>;
  participationOverTime: Array<{
    date: string;
    participantJoins: number;
  }>;
}

/** Short-lived signed read authorization for one configured game image. */
export interface PrismEventGameMediaAuthorization {
  downloadUrl: string;
  expiresAt: string;
}

export interface PrismGamePublicState {
  sessionId: string;
  game: Pick<PrismEventGameSummary, "title" | "kind">;
  status: PrismGameSessionStatus;
  startedAt: string | null;
  /** Server game-time snapshot used only to display round countdowns. */
  serverTime?: string;
  currentRound: { key: string; number: number; total: number; deadlineAt?: string | null } | null;
  currentPrompt: string | null;
  participant: {
    hasSubmitted: boolean;
    hasVoted?: boolean;
    score: number | null;
    result?: PrismGameParticipantResult;
    gameData?: PrismGameParticipantData;
  };
  /** Only the server-selected Spin the Wheel outcome; shared with the session. */
  sessionResult?: PrismGameSessionResult;
  /** Sanitized current standings for competitive Active (Multiplayer) games. */
  leaderboard?: PrismGamePublicLeaderboardEntry[];
  aggregateResults: Array<{ label: string; count: number }>;
  /** Approved Split the Room text is exposed only while its host has paused the session. */
  approvedResponses?: readonly string[];
}

export type PrismGameParticipantData =
  | { kind: "live-trivia"; options: readonly string[] }
  | { kind: "bingo"; card: readonly (number | "FREE")[]; calledNumbers: readonly number[] }
  | { kind: "guess-picture"; mediaObjectId: string; stage: number }
  | { kind: "word-scramble" }
  | { kind: "guess-picture-solo"; mediaObjectId: string; stage: number; totalStages: number }
  | {
    kind: "spot-the-difference";
    originalMediaObjectId: string;
    comparisonMediaObjectId: string;
    totalDifferences: number;
  }
  | { kind: "would-you-rather"; options: readonly string[]; aggregateResults: boolean }
  | { kind: "this-or-that-solo"; options: readonly string[] }
  | { kind: "this-or-that"; options: readonly string[] }
  | { kind: "family-feud"; teamLabel: string }
  | { kind: "split-the-room"; options: readonly string[]; maxResponseLength: number };

export type PrismGameParticipantResult =
  | { kind: "singleplayer-choice"; option: string };

/** Shared outcome selected by the host and persisted once on a Spin the Wheel session. */
export interface PrismGameSessionResult {
  kind: "spin-wheel";
  outcomeId: string;
  label: string;
  points: number;
}

export type PrismGameResponseValue =
  | string
  | number
  | boolean
  | readonly string[]
  | Readonly<Record<string, string | number | boolean | readonly string[]>>;

export interface PrismGameSessionResponse {
  id: string;
  roundNumber: number;
  /** Server-generated anonymous alias; never a consented profile field. */
  participantAlias: string;
  response: PrismGameResponseValue;
  moderationStatus: "pending" | "visible" | "hidden";
  scoreAwarded: number | null;
  submittedAt: string;
}

/** PMCM-only historical response page, returned after event closure/archive. */
export interface PrismGameSessionResponsePage extends PrismCursorPage<PrismGameSessionResponse> {
  sessionId: string;
}

export interface PrismEventGameAward {
  id: string;
  sessionId: string;
  recipientType: "participant" | "team";
  recipientLabel: string;
  awardKind: "points" | "badge" | "prize";
  label: string;
  points: number | null;
  prizeReference: string | null;
  assignedAt: string;
}
