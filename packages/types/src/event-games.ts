import type { PrismCursorPage } from "./event-ops.js";
import type { PrismEventGameKind } from "./schemas/event-games-inputs.js";

export type PrismGameSessionStatus =
  | "scheduled"
  | "lobby"
  | "live"
  | "paused"
  | "completed"
  | "cancelled";

export interface PrismEventGameSummary {
  id: string;
  title: string;
  kind: PrismEventGameKind;
  description?: string;
  availableFrom: string | null;
  availableUntil: string | null;
}

/** Public event lobby data; never includes unpublished games or host settings. */
export interface PrismEventGameLobby {
  eventSlug: string;
  eventName: string;
  branding: {
    primaryColor: string | null;
    secondaryColor: string | null;
    logoUrl: string | null;
  };
  games: PrismEventGameSummary[];
}

export interface PrismGameLeaderboardEntry {
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
  participantCount: number;
  currentRound: { number: number; total: number } | null;
  leaderboard: PrismGameLeaderboardEntry[];
}

export interface PrismGamePublicState {
  sessionId: string;
  game: Pick<PrismEventGameSummary, "title" | "kind">;
  status: PrismGameSessionStatus;
  startedAt: string | null;
  currentRound: { number: number; total: number } | null;
  currentPrompt: string | null;
  participant: {
    hasSubmitted: boolean;
    score: number | null;
  };
  aggregateResults: Array<{ label: string; count: number }>;
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
