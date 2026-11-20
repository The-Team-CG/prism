/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import type { PrismGameHostState } from "@prism/types";
import { afterEach, describe, expect, it } from "vitest";
import type { PresenterRenderer } from "../presenter-types";
import LivePollRenderer from "./live-poll";
import OpenQaRenderer from "./open-qa";
import SplitTheRoomRenderer from "./split-the-room";
import ThisOrThatRenderer from "./this-or-that";
import WordCloudRenderer from "./word-cloud";

afterEach(cleanup);

type Kind = PrismGameHostState["game"]["kind"];

interface GameCase {
  name: string;
  Renderer: PresenterRenderer;
  kind: Kind;
  prompt: string;
  aggregateResults: Array<{ label: string; count: number }>;
  approvedResponses: string[];
  /** Room-safe text that must appear only once the slide is paused. */
  pausedText: string[];
}

const cases: GameCase[] = [
  {
    name: "this-or-that",
    Renderer: ThisOrThatRenderer,
    kind: "this-or-that",
    prompt: "Mountains or beach?",
    aggregateResults: [{ label: "Mountains", count: 7 }, { label: "Beach", count: 3 }],
    approvedResponses: [],
    pausedText: ["Mountains", "7 · 70%"],
  },
  {
    name: "split-the-room",
    Renderer: SplitTheRoomRenderer,
    kind: "split-the-room",
    prompt: "Is a hot dog a sandwich?",
    aggregateResults: [{ label: "Yes", count: 4 }, { label: "No", count: 6 }],
    approvedResponses: ["Only if the bread is open", "Depends on the bread"],
    pausedText: ["Yes", "6 · 60%", "Depends on the bread"],
  },
  {
    name: "live-poll",
    Renderer: LivePollRenderer,
    kind: "live-poll",
    prompt: "Best conference snack?",
    aggregateResults: [{ label: "Popcorn", count: 2 }, { label: "Pretzels", count: 5 }],
    approvedResponses: [],
    pausedText: ["Pretzels", "5 · 71%"],
  },
  {
    name: "word-cloud",
    Renderer: WordCloudRenderer,
    kind: "word-cloud",
    prompt: "One word for the future",
    aggregateResults: [],
    approvedResponses: ["Hopeful", "hopeful", "Ambitious"],
    pausedText: ["Hopeful", "Ambitious"],
  },
  {
    name: "open-qa",
    Renderer: OpenQaRenderer,
    kind: "open-qa",
    prompt: "What should we build next?",
    aggregateResults: [],
    approvedResponses: ["Better wifi in the hall", "A coffee cart"],
    pausedText: ["Better wifi in the hall", "A coffee cart"],
  },
];

function hostState(
  game: GameCase,
  status: PrismGameHostState["status"],
): PrismGameHostState {
  return {
    eventId: "event-1",
    sessionId: "session-1",
    game: { id: "game-1", title: "Audience game", kind: game.kind },
    status,
    scheduledStartAt: null,
    startedAt: "2026-11-20T10:00:00.000Z",
    endedAt: null,
    participantCount: 14,
    currentRound: {
      key: "round-1",
      number: 1,
      total: 2,
      prompt: game.prompt,
      deadlineAt: null,
      pendingSubmissions: [{ id: "pending-1", roundNumber: 1, response: "Unreviewed secret" }],
      // Paused-only data is supplied in both states so the tests prove the renderer gates it itself.
      approvedResponses: game.approvedResponses,
    },
    aggregateResults: game.aggregateResults,
    leaderboard: [],
  };
}

describe.each(cases)("$name presenter renderer", (game) => {
  const { Renderer } = game;

  it("shows the prompt, room size and phone instruction while live", () => {
    render(<Renderer state={hostState(game, "live")} />);

    expect(screen.getByText(game.prompt)).toBeTruthy();
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.getByText(/answering on their phones|asking on their phones/)).toBeTruthy();
  });

  it("hides totals, approved answers and pending text while live", () => {
    render(<Renderer state={hostState(game, "live")} />);

    for (const text of game.pausedText) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(screen.queryByText(/Unreviewed secret/)).toBeNull();
  });

  it("shows paused totals and approved answers, never pending text", () => {
    render(<Renderer state={hostState(game, "paused")} />);

    expect(screen.getByText(game.prompt)).toBeTruthy();
    for (const text of game.pausedText) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.queryByText(/Unreviewed secret/)).toBeNull();
  });
});
