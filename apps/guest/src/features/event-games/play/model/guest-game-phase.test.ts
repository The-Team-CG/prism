import { describe, expect, it } from "vitest";
import type { PrismGamePublicState } from "@prism/types";
import { guestGamePhase, isScoredGame, showsStandings } from "./guest-game-phase";

type StateOverrides = Partial<Omit<PrismGamePublicState, "participant">> & { participant?: Partial<PrismGamePublicState["participant"]> };

function state(overrides: StateOverrides = {}): PrismGamePublicState {
  const { participant, ...rest } = overrides;
  return {
    sessionId: "session-1",
    game: { title: "Trivia", kind: "live-trivia" },
    status: "live",
    startedAt: "2026-10-17T10:00:00.000Z",
    currentRound: { key: "q1", number: 1, total: 3, resultsOpen: false },
    currentPrompt: "Which?",
    aggregateResults: [],
    ...rest,
    participant: { participantAlias: "Guest 1", hasSubmitted: false, score: 0, ...participant },
  };
}

describe("guest game phase", () => {
  it("follows a shared round from answering to locked in to the reveal", () => {
    expect(guestGamePhase(state(), 12)).toBe("answering");
    expect(guestGamePhase(state({ participant: { hasSubmitted: true } }), 12)).toBe("locked");
    expect(guestGamePhase(state({ participant: { hasSubmitted: true } }), 0)).toBe("closed");
    expect(guestGamePhase(state({
      currentRound: { key: "q1", number: 1, total: 3, resultsOpen: true, revealedAnswer: "B" },
      participant: { hasSubmitted: true, roundOutcome: { isCorrect: true, points: 10, answer: "B" } },
    }), null)).toBe("reveal");
  });

  it("reveals the answer to a guest who did not answer once the round closes", () => {
    expect(guestGamePhase(state({ status: "paused", currentRound: { key: "q1", number: 1, total: 3, revealedAnswer: "B" } }), null)).toBe("reveal");
  });

  it("shows a puzzle result as soon as the server sends it, and separates waiting and finished games", () => {
    expect(guestGamePhase(state({ game: { title: "Scramble", kind: "word-scramble" }, participant: {
      hasSubmitted: true, roundOutcome: { isCorrect: false, points: 0 },
    } }), 30)).toBe("reveal");
    expect(guestGamePhase(state({ status: "lobby", currentRound: null }), null)).toBe("waiting");
    expect(guestGamePhase(state({ status: "completed" }), null)).toBe("finished");
  });

  it("keeps score and standings to competitive games, and standings out of the answering screen", () => {
    expect(isScoredGame("live-trivia")).toBe(true);
    expect(isScoredGame("live-poll")).toBe(false);
    expect(isScoredGame("this-or-that")).toBe(false);
    const ranked = state({ leaderboard: [{ rank: 1, label: "Guest 1", score: 10 }] });
    expect(showsStandings(ranked, "answering")).toBe(false);
    expect(showsStandings(ranked, "reveal")).toBe(true);
    expect(showsStandings({ ...ranked, game: { title: "Poll", kind: "live-poll" } }, "reveal")).toBe(false);
  });
});
