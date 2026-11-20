/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import type { PrismGameHostState } from "@prism/types";
import { afterEach, describe, expect, it } from "vitest";
import PresenterDeckRenderer from "./presenter-deck";

afterEach(cleanup);

function hostState(overrides: Partial<PrismGameHostState> = {}, round: Partial<NonNullable<PrismGameHostState["currentRound"]>> = {}): PrismGameHostState {
  return {
    eventId: "event-1",
    sessionId: "session-1",
    game: { id: "game-1", title: "Opening deck", kind: "presenter-deck" },
    status: "live",
    scheduledStartAt: null,
    startedAt: "2026-11-20T10:00:00.000Z",
    endedAt: null,
    participantCount: 12,
    currentRound: {
      key: "words-1",
      number: 1,
      total: 3,
      prompt: "One word for today",
      deadlineAt: null,
      pendingSubmissions: [{ id: "pending-1", roundNumber: 1, response: "Unreviewed secret" }],
      pendingAnswers: [{ id: "pending-2", roundNumber: 1, answer: "Unscored secret" }],
      ...round,
    },
    leaderboard: [],
    ...overrides,
  };
}

describe("PresenterDeckRenderer", () => {
  it("shows the room size without the moderation queue", () => {
    render(<PresenterDeckRenderer state={hostState()} />);

    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.queryByText(/Unreviewed secret/)).toBeNull();
    expect(screen.queryByText(/Unscored secret/)).toBeNull();
  });

  it("shows approved words as a frequency-weighted cloud while the game is live, never pending text", () => {
    render(<PresenterDeckRenderer state={hostState({}, {
      approvedResponses: ["Bright", "bright", "Calm"],
    })} />);

    const bright = screen.getByText("Bright");
    const calm = screen.getByText("Calm");
    expect(parseFloat(bright.style.fontSize)).toBeGreaterThan(parseFloat(calm.style.fontSize));
    expect(screen.getByText("What the room said")).toBeTruthy();
    expect(screen.queryByText(/Unreviewed secret/)).toBeNull();
  });

  it("shows paused vote totals as bars for choice and scale slides", () => {
    render(<PresenterDeckRenderer state={hostState({
      status: "paused",
      aggregateResults: [{ label: "Yes", count: 3 }, { label: "No", count: 1 }],
    }, { key: "choice-1", prompt: "Coffee?" })} />);

    expect(screen.getByText("Yes")).toBeTruthy();
    expect(screen.getByText("3 · 75%")).toBeTruthy();
    expect(screen.queryByText(/Unreviewed secret/)).toBeNull();
  });

  it("shows the server's results while live, in the slide's results window, without a host pause", () => {
    render(<PresenterDeckRenderer state={hostState({
      aggregateResults: [{ label: "Yes", count: 3 }, { label: "No", count: 1 }],
    }, { key: "choice-1", prompt: "Coffee?", resultsOpen: true })} />);

    expect(screen.getByText("How the room voted")).toBeTruthy();
    expect(screen.getByText("3 · 75%")).toBeTruthy();
    expect(screen.queryByText("Coffee?")).toBeNull();
  });

  it("shows a word cloud only when the server sends approved words", () => {
    render(<PresenterDeckRenderer state={hostState({}, { resultsOpen: true, approvedResponses: ["Bright", "Calm"] })} />);
    expect(screen.getByText("What the room said")).toBeTruthy();
    expect(screen.queryByText(/Unreviewed secret/)).toBeNull();
    cleanup();

    render(<PresenterDeckRenderer state={hostState({}, { resultsOpen: true })} />);
    expect(screen.queryByText("What the room said")).toBeNull();
    expect(screen.getByText("No responses to show for this slide yet.")).toBeTruthy();
  });

  it("shows no word cloud while live without approved words", () => {
    render(<PresenterDeckRenderer state={hostState()} />);
    expect(screen.queryByText("What the room said")).toBeNull();
    expect(screen.getByText("12")).toBeTruthy();
  });
});
