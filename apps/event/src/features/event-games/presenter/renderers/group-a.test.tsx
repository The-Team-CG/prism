/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import type { PrismEventGameKind, PrismGameHostState } from "@prism/types";
import { afterEach, describe, expect, it } from "vitest";
import BingoPresenter from "./bingo";
import FamilyFeudPresenter from "./family-feud";
import GuessPicturePresenter from "./guess-picture";
import LiveTriviaPresenter from "./live-trivia";
import SpinWheelPresenter from "./spin-wheel";

afterEach(cleanup);

type Round = NonNullable<PrismGameHostState["currentRound"]>;

function hostState(
  kind: PrismEventGameKind,
  overrides: Partial<PrismGameHostState> = {},
  round: Partial<Round> = {},
): PrismGameHostState {
  return {
    eventId: "event-1",
    sessionId: "session-1",
    game: { id: "game-1", title: "Sample game", kind },
    status: "live",
    scheduledStartAt: null,
    startedAt: "2026-11-20T10:00:00.000Z",
    endedAt: null,
    participantCount: 12,
    currentRound: {
      key: "round-1",
      number: 1,
      total: 3,
      prompt: "Sample prompt",
      deadlineAt: null,
      pendingSubmissions: [{ id: "pending-1", roundNumber: 1, response: "Unreviewed secret" }],
      pendingAnswers: [{ id: "pending-2", roundNumber: 1, answer: "Unscored secret" }],
      ...round,
    },
    leaderboard: [],
    ...overrides,
  };
}

describe("Live Trivia presenter", () => {
  it("shows the live question and room size, never the answer or pending text", () => {
    render(<LiveTriviaPresenter state={hostState("live-trivia", {}, {
      prompt: "Capital of France?",
      revealedAnswer: "Paris",
    })} />);

    expect(screen.getByText("Capital of France?")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Answer on your phone")).toBeTruthy();
    expect(screen.queryByText(/Paris/)).toBeNull();
    expect(screen.queryByText(/Unreviewed secret/)).toBeNull();
  });

  it("shows answers coming in, then cues the host once everyone has answered", () => {
    const { rerender } = render(<LiveTriviaPresenter state={hostState("live-trivia", {}, { prompt: "Capital of France?", answeredCount: 3 })} />);
    expect(screen.getByRole("status").textContent).toContain("3 of 12 answered");

    rerender(<LiveTriviaPresenter state={hostState("live-trivia", {}, { prompt: "Capital of France?", answeredCount: 12 })} />);
    expect(screen.getByText("Everyone’s in!")).toBeTruthy();
  });

  it("reveals the answer only once paused", () => {
    const { rerender } = render(<LiveTriviaPresenter state={hostState("live-trivia", {}, {
      prompt: "Capital of France?",
      revealedAnswer: "Paris",
    })} />);
    expect(screen.queryByText("Paris")).toBeNull();

    rerender(<LiveTriviaPresenter state={hostState("live-trivia", { status: "paused" }, {
      prompt: "Capital of France?",
      revealedAnswer: "Paris",
    })} />);
    expect(screen.getByText("Paris")).toBeTruthy();
    expect(screen.getByText("Capital of France?")).toBeTruthy();
  });
});

describe("Bingo presenter", () => {
  it("shows the latest call large and lights it on the call board, without pending text", () => {
    render(<BingoPresenter state={hostState("bingo", {}, { prompt: "Number called: 19", calledNumbers: [4, 19] })} />);

    expect(screen.getAllByText("19").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText("Latest number").textContent).toContain("12 people playing");
    expect(screen.getByText("75")).toBeTruthy();
    expect(screen.queryByText(/Unreviewed secret/)).toBeNull();
  });

  it("shows the leaderboard once paused, not while live", () => {
    const leaderboard = [{ rank: 1, label: "Ada", score: 10 }];
    const { rerender } = render(<BingoPresenter state={hostState("bingo", { leaderboard })} />);
    expect(screen.queryByText("Ada")).toBeNull();

    rerender(<BingoPresenter state={hostState("bingo", { status: "paused", leaderboard })} />);
    expect(screen.getByText("Ada")).toBeTruthy();
  });
});

describe("Guess the Picture presenter", () => {
  it("shows the prompt and a neutral guessing line while live", () => {
    render(<GuessPicturePresenter state={hostState("guess-picture", {}, { prompt: "Name this landmark" })} />);

    expect(screen.getByText("Name this landmark")).toBeTruthy();
    expect(screen.getByText("Guess on your phone")).toBeTruthy();
    expect(screen.queryByText(/Unscored secret/)).toBeNull();
  });

  it("shows the revealed answer once paused", () => {
    render(<GuessPicturePresenter state={hostState("guess-picture", { status: "paused" }, {
      prompt: "Name this landmark",
      revealedAnswer: "Eiffel Tower",
    })} />);

    expect(screen.getByText("Eiffel Tower")).toBeTruthy();
  });
});

describe("Spin the Wheel presenter", () => {
  it("shows the live prompt", () => {
    render(<SpinWheelPresenter state={hostState("spin-wheel", {}, { prompt: "Spin for a prize" })} />);

    expect(screen.getByText("Spin for a prize")).toBeTruthy();
  });

  it("shows the selected outcome label and points when a result is set", () => {
    render(<SpinWheelPresenter state={hostState("spin-wheel", {
      sessionResult: { kind: "spin-wheel", outcomeId: "outcome-1", label: "Free coffee", points: 25 },
    }, { prompt: "Spin for a prize" })} />);

    expect(screen.getByText("Free coffee")).toBeTruthy();
    expect(screen.getByText("25 points")).toBeTruthy();
  });
});

describe("Family Feud presenter", () => {
  const answerBoard = [{ answer: "Pizza", alternatives: ["Pie", "Flatbread"], points: 40 }];

  it("shows the prompt and room size while live, with the board hidden", () => {
    render(<FamilyFeudPresenter state={hostState("family-feud", {}, {
      prompt: "Name a food you eat on Friday",
      answerBoard,
    })} />);

    expect(screen.getByText("Name a food you eat on Friday")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.queryByText("Pizza")).toBeNull();
    expect(screen.queryByText("Pie, Flatbread")).toBeNull();
    expect(screen.queryByText(/Unscored secret/)).toBeNull();
  });

  it("shows the answer board once paused", () => {
    render(<FamilyFeudPresenter state={hostState("family-feud", { status: "paused" }, {
      prompt: "Name a food you eat on Friday",
      answerBoard,
    })} />);

    expect(screen.getByText("Pizza")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
    // Alternatives help the host score answers; the room only sees the board.
    expect(screen.queryByText(/Flatbread/)).toBeNull();
  });
});
