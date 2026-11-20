/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import type { PrismEventGameKind, PrismGameHostState, PrismGameSessionStatus } from "@prism/types";
import { afterEach, describe, expect, it } from "vitest";
import { PresenterScreen, type PresenterScreenProps } from "./presenter-screen";

afterEach(cleanup);

const ACTIVE_KINDS: PrismEventGameKind[] = [
  "live-trivia", "bingo", "guess-picture", "spin-wheel", "this-or-that", "family-feud",
  "split-the-room", "live-poll", "word-cloud", "open-qa", "presenter-deck",
];

const PROMPT = "Unique room prompt";

function hostState(kind: PrismEventGameKind, status: PrismGameSessionStatus): PrismGameHostState {
  return {
    eventId: "event-1",
    sessionId: "session-1",
    game: { id: "game-1", title: "Room game", kind },
    status,
    scheduledStartAt: null,
    startedAt: "2026-11-20T10:00:00.000Z",
    endedAt: null,
    participantCount: 14,
    currentRound: {
      key: "round-1",
      number: 1,
      total: 2,
      prompt: PROMPT,
      deadlineAt: null,
      pendingSubmissions: [],
      pendingAnswers: [],
    },
    leaderboard: [],
  };
}

function screenProps(state: PrismGameHostState, overrides: Partial<PresenterScreenProps> = {}): PresenterScreenProps {
  return { state, receivedAt: null, joinUrl: null, pin: null, issuingPin: false, onIssuePin: () => {}, ...overrides };
}

describe.each(ACTIVE_KINDS)("%s presenter screen", (kind) => {
  it.each(["live", "paused"] as const)("shows the round prompt exactly once while %s", (status) => {
    render(<PresenterScreen {...screenProps(hostState(kind, status))} />);

    expect(screen.getAllByText(PROMPT)).toHaveLength(1);
  });
});

describe("presenter join details", () => {
  it("shows the guest join address next to the game PIN", () => {
    render(<PresenterScreen {...screenProps(hostState("live-trivia", "live"), {
      pin: "482193",
      joinUrl: "https://guest.example.test/games/join",
    })} />);

    expect(screen.getByText("https://guest.example.test/games/join")).toBeTruthy();
    expect(screen.getByLabelText("Game PIN 4 8 2 1 9 3")).toBeTruthy();
  });

  it("explains why the join address is unavailable", () => {
    render(<PresenterScreen {...screenProps(hostState("live-trivia", "live"), {
      joinError: "The join link is not available right now.",
    })} />);

    expect(screen.getByText("The join link is not available right now.")).toBeTruthy();
  });
});
