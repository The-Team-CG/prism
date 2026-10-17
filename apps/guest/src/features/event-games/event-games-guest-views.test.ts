/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const viewModels = vi.hoisted(() => ({
  join: vi.fn(),
  lobby: vi.fn(),
  play: vi.fn(),
}));

vi.mock("./join/view-models/use-event-game-pin-join-view-model", () => ({
  useEventGamePinJoinViewModel: viewModels.join,
}));
vi.mock("./lobby/view-models/use-event-game-lobby-view-model", () => ({
  useEventGameLobbyViewModel: viewModels.lobby,
}));
vi.mock("./play/view-models/use-event-game-play-view-model", () => ({
  useEventGamePlayViewModel: viewModels.play,
}));

import { EventGamePinJoinView } from "./join/views/event-game-pin-join-view";
import { EventGameLobbyView } from "./lobby/views/event-game-lobby-view";
import { EventGamePlayView } from "./play/views/event-game-play-view";

describe("guest event-game views", () => {
  afterEach(() => cleanup());

  it("offers anonymous PIN entry without a profile form", () => {
    viewModels.join.mockReturnValue({
      pin: "",
      status: "idle",
      error: null,
      currentSession: null,
      canSubmit: false,
      busy: false,
      updatePin: vi.fn(),
      submit: vi.fn(),
      clearSavedSession: vi.fn(),
    });

    const markup = renderToStaticMarkup(createElement(EventGamePinJoinView));

    expect(markup).toContain("Game PIN");
    expect(markup).toContain("inputMode=\"numeric\"");
    expect(markup).not.toContain("Your name");
    expect(markup).not.toContain("Upload a photo");
    expect(markup).not.toContain("type=\"file\"");
  });

  it("shows only public Independent game summaries and does not ask for a PIN or profile", () => {
    viewModels.lobby.mockReturnValue({
      lobby: {
        eventId: "event-a",
        eventSlug: "summer-party",
        eventName: "Summer Party",
        branding: { theme: "prism", primaryColor: "#312E81", secondaryColor: "#0F766E", logoUrl: "https://storage.example.test/lobby-logo?sig=public" },
        games: [{ id: "solo-a", title: "Word Scramble", kind: "word-scramble", availableFrom: null, availableUntil: null }],
      },
      status: "ready",
      error: null,
      startingGameId: null,
      participantAlias: "Guest 1234",
      startGame: vi.fn(),
      exitGames: vi.fn(),
      reload: vi.fn(),
    });

    const markup = renderToStaticMarkup(createElement(EventGameLobbyView, { eventSlug: "summer-party" }));

    expect(markup).toContain("Summer Party");
    expect(markup).toContain('alt="Summer Party logo"');
    expect(markup).toContain("https://storage.example.test/lobby-logo?sig=public");
    expect(markup).toContain("linear-gradient(90deg, #312E81, #0F766E)");
    expect(markup).toContain("Word Scramble");
    expect(markup).not.toMatch(/<input[^>]*(?:name|id)=\"pin\"/i);
    expect(markup).not.toContain("Your name");
    expect(markup).not.toContain("Upload a photo");
    expect(markup).toContain("does not verify a person or device");
  });

  it("shows the public prompt, the guest's own status, and only permitted aggregate results", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-a1",
        game: { title: "Live Trivia", kind: "live-trivia" },
        status: "live",
        startedAt: "2026-10-17T10:00:00.000Z",
        currentRound: { key: 'round-1', number: 1, total: 3 },
        currentPrompt: "Choose the correct answer",
        participant: { hasSubmitted: true, score: 20 },
        aggregateResults: [{ label: "Option A", count: 3 }],
      },
      participantAlias: "Guest 1234",
      status: "ready",
      error: null,
      refresh: vi.fn(),
      exitGames: vi.fn(),
    });

    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-a1" }));

    expect(markup).toContain("Choose the correct answer");
    expect(markup).toContain("20");
    expect(markup).toContain("Option A");
    expect(markup).not.toContain("answer key");
    expect(markup).not.toContain("moderation notes");
    expect(markup).not.toContain("Upload a photo");
  });

  it("renders Live Trivia answer choices without exposing the answer key", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-trivia",
        game: { title: "Live Trivia", kind: "live-trivia" },
        status: "live",
        startedAt: "2026-10-17T10:00:00.000Z",
        currentRound: { key: "round-1", number: 1, total: 2 },
        currentPrompt: "Which answer is correct?",
        participant: { hasSubmitted: false, score: 0, gameData: { kind: "live-trivia", options: ["Choice A", "Choice B"] } },
        aggregateResults: [],
      },
      status: "ready", actionBusy: false, mediaUrl: null, mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });
    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-trivia" }));

    expect(markup).toContain("Choose your answer");
    expect(markup).toContain("Choice A");
    expect(markup).toContain("Choice B");
    expect(markup).not.toContain("correctAnswer");
  });

  it("uses the server deadline to stop a round and disables submissions when time is up", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-expired-round",
        game: { title: "Live Trivia", kind: "live-trivia" },
        status: "live",
        startedAt: "2026-10-17T10:00:00.000Z",
        serverTime: "2026-10-17T10:00:10.000Z",
        currentRound: {
          key: "round-1", number: 1, total: 2,
          deadlineAt: "2026-10-17T10:00:09.000Z",
        },
        currentPrompt: "Which answer is correct?",
        participant: { hasSubmitted: false, score: 0, gameData: { kind: "live-trivia", options: ["Choice A", "Choice B"] } },
        aggregateResults: [],
      },
      status: "ready", actionBusy: false, mediaUrl: null, mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });

    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-expired-round" }));

    expect(markup).toContain('aria-label="Time remaining: 00:00"');
    expect(markup).toContain("The timer has ended. Your answers are closed until the game updates.");
    expect(markup).toContain('<fieldset disabled="" class="min-w-0 border-0 p-0">');
  });

  it("renders Bingo claims with the guest card and server call context", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-bingo",
        game: { title: "Bingo", kind: "bingo" },
        status: "live",
        startedAt: "2026-10-17T10:00:00.000Z",
        currentRound: { key: "bingo-claim", number: 2, total: 24 },
        currentPrompt: "Number called: 9",
        participant: { hasSubmitted: false, score: 0, gameData: {
          kind: "bingo", card: ["FREE", ...Array.from({ length: 24 }, (_, index) => index + 1)], calledNumbers: [1, 9],
        } },
        aggregateResults: [],
      },
      status: "ready", actionBusy: false, mediaUrl: null, mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });
    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-bingo" }));

    expect(markup).toContain("Your card");
    expect(markup).toContain("Claim Bingo");
    expect(markup).toContain("Number called: 9");
  });

  it("preserves marked Bingo numbers when the host calls another number", () => {
    const gameState = {
      sessionId: "session-bingo",
      game: { title: "Bingo", kind: "bingo" as const },
      status: "live" as const,
      startedAt: "2026-10-17T10:00:00.000Z",
      currentRound: { key: "bingo-claim", number: 2, total: 24 },
      currentPrompt: "Number called: 9",
      participant: { hasSubmitted: false, score: 0, gameData: {
        kind: "bingo" as const, card: ["FREE" as const, ...Array.from({ length: 24 }, (_, index) => index + 1)], calledNumbers: [1, 9],
      } },
      aggregateResults: [],
    };
    viewModels.play.mockReturnValue({
      state: gameState, status: "ready", actionBusy: false, mediaUrl: null, mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });

    const view = render(createElement(EventGamePlayView, { sessionId: "session-bingo" }));
    const calledNumber = screen.getByRole("button", { name: "1" });
    fireEvent.click(calledNumber);
    expect(calledNumber.getAttribute("aria-pressed")).toBe("true");

    gameState.currentRound = { key: "bingo-claim", number: 3, total: 24 };
    gameState.currentPrompt = "Number called: 2";
    gameState.participant.gameData = {
      kind: "bingo", card: ["FREE", ...Array.from({ length: 24 }, (_, index) => index + 1)], calledNumbers: [1, 9, 2],
    };
    view.rerender(createElement(EventGamePlayView, { sessionId: "session-bingo" }));

    expect(screen.getByRole("button", { name: "1" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("lets keyboard players select a Spot the Difference location by coordinates", async () => {
    const submitAction = vi.fn().mockResolvedValue(null);
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-spot-difference",
        game: { title: "Spot the Difference", kind: "spot-the-difference" },
        status: "live",
        startedAt: "2026-10-17T10:00:00.000Z",
        currentRound: { key: "spot-1", number: 1, total: 1 },
        currentPrompt: "Find the differences",
        participant: { hasSubmitted: false, score: 0, gameData: {
          kind: "spot-the-difference", originalMediaObjectId: "original", comparisonMediaObjectId: "comparison", totalDifferences: 1,
        } },
        aggregateResults: [],
      },
      status: "ready", actionBusy: false, mediaUrl: "https://storage.example.test/original",
      comparisonMediaUrl: "https://storage.example.test/comparison", mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction,
    });
    render(createElement(EventGamePlayView, { sessionId: "session-spot-difference" }));

    fireEvent.change(screen.getByLabelText("Horizontal position (%)"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("Vertical position (%)"), { target: { value: "70" } });
    fireEvent.click(screen.getByRole("button", { name: "Add selected location" }));
    fireEvent.click(screen.getByRole("button", { name: "Check my answer" }));

    await waitFor(() => expect(submitAction).toHaveBeenCalledWith(expect.objectContaining({
      templateId: "spot-the-difference",
      payload: { selections: [{ x: 0.25, y: 0.7 }] },
    })));
  });

  it("renders a staged picture prompt without exposing accepted answers", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-picture",
        game: { title: "Guess the Picture", kind: "guess-picture" },
        status: "live",
        startedAt: "2026-10-17T10:00:00.000Z",
        currentRound: { key: "picture-1", number: 1, total: 3 },
        currentPrompt: "A clue appears",
        participant: { hasSubmitted: false, score: 0, gameData: {
          kind: "guess-picture", mediaObjectId: "obj_a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5", stage: 1,
        } },
        aggregateResults: [],
      },
      status: "ready", actionBusy: false, mediaUrl: "https://storage.example.test/picture", mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });
    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-picture" }));

    expect(markup).toContain("Revealed picture · Stage 1");
    expect(markup).toContain("data-reveal-stage=\"1\"");
    expect(markup).toContain("clip-path:inset(0 67% 0 0)");
    expect(markup).not.toContain("acceptedAnswers");
  });

  it("renders Word Scramble with only the scrambled prompt and a private answer control", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-word", game: { title: "Word Scramble", kind: "word-scramble" }, status: "live",
        startedAt: "2026-10-17T10:00:00.000Z", currentRound: { key: "word-1", number: 1, total: 1 },
        currentPrompt: "tac", participant: { hasSubmitted: false, score: 0, gameData: { kind: "word-scramble" } }, aggregateResults: [],
      },
      status: "ready", actionBusy: false, mediaUrl: null, comparisonMediaUrl: null, mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });
    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-word" }));

    expect(markup).toContain("tac");
    expect(markup).toContain("Unscrambled word");
    expect(markup).toContain("Submit answer");
    expect(markup).not.toContain("Shared results");
    expect(markup).not.toContain("cat");
  });

  it("renders a Singleplayer picture reveal and answer form without exposing accepted answers", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-picture-solo", game: { title: "Guess the Picture (Solo)", kind: "guess-picture-solo" }, status: "live",
        startedAt: "2026-10-17T10:00:00.000Z", currentRound: { key: "picture-1", number: 1, total: 1 },
        currentPrompt: "A northern animal", participant: { hasSubmitted: false, score: 0, gameData: {
          kind: "guess-picture-solo", mediaObjectId: "obj_a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5", stage: 2, totalStages: 3,
        } }, aggregateResults: [],
      },
      status: "ready", actionBusy: false, mediaUrl: "https://storage.example.test/solo-picture", comparisonMediaUrl: null, mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });
    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-picture-solo" }));

    expect(markup).toContain("A northern animal");
    expect(markup).toContain("Private picture reveal · Hint 2 of 3");
    expect(markup).toContain("clip-path:inset(0 33% 0 0)");
    expect(markup).toContain("Your guess");
    expect(markup).toContain("solo-picture");
    expect(markup).not.toContain("acceptedAnswers");
    expect(markup).not.toContain("Shared results");
  });

  it("renders an interactive Spot the Difference image pair without exposing target regions", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-difference", game: { title: "Spot the Difference", kind: "spot-the-difference" }, status: "live",
        startedAt: "2026-10-17T10:00:00.000Z", currentRound: { key: "difference-1", number: 1, total: 1 },
        currentPrompt: "Select each visible difference in the comparison image.", participant: { hasSubmitted: false, score: 0, gameData: {
          kind: "spot-the-difference", originalMediaObjectId: "obj_a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5",
          comparisonMediaObjectId: "obj_a78bde2c-61a4-4e5f-b9ba-dbe21ca203b6", totalDifferences: 2,
        } }, aggregateResults: [],
      },
      status: "ready", actionBusy: false, mediaUrl: "https://storage.example.test/original", comparisonMediaUrl: "https://storage.example.test/comparison", mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });
    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-difference" }));

    expect(markup).toContain("Tap each difference in the comparison image");
    expect(markup).toContain("Mark a difference on the comparison image");
    expect(markup).toContain("Original event game image");
    expect(markup).toContain("Comparison event game image");
    expect(markup).toContain("0 of 2 marks selected.");
    expect(markup).not.toContain("target regions");
    expect(markup).not.toContain("Shared results");
  });

  it("shows Would You Rather completion without scoring or private-mode aggregate results", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-rather", game: { title: "Would You Rather", kind: "would-you-rather" }, status: "live",
        startedAt: "2026-10-17T10:00:00.000Z", currentRound: { key: "rather-1", number: 1, total: 1 },
        currentPrompt: "Would you rather?", participant: { hasSubmitted: false, score: 0, gameData: {
          kind: "would-you-rather", options: ["Fly", "Be invisible"], aggregateResults: false,
        } }, aggregateResults: [],
      },
      status: "ready", actionBusy: false, mediaUrl: null, comparisonMediaUrl: null, mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });
    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-rather" }));

    expect(markup).toContain("Choose what you would rather do");
    expect(markup).toContain("Fly");
    expect(markup).toContain("Be invisible");
    expect(markup).not.toContain("Shared results");
    expect(markup).not.toContain("leaderboard");
  });

  it("requires a separate poll-sharing choice for This or That (Solo)", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-solo-choice", game: { title: "This or That (Solo)", kind: "this-or-that-solo" }, status: "live",
        startedAt: "2026-10-17T10:00:00.000Z", currentRound: { key: "choice-1", number: 1, total: 1 },
        currentPrompt: "Tea or coffee?", participant: { hasSubmitted: false, score: 0, gameData: {
          kind: "this-or-that-solo", options: ["Tea", "Coffee"],
        } }, aggregateResults: [],
      },
      status: "ready", actionBusy: false, mediaUrl: null, comparisonMediaUrl: null, mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });
    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-solo-choice" }));

    expect(markup).toContain("Your private choice");
    expect(markup).toContain("Share my answer in the anonymous event poll");
    expect(markup).toContain("Tea");
    expect(markup).toContain("Coffee");
    expect(markup).not.toContain("leaderboard");
  });

  it("shows a persisted Spin the Wheel result instead of offering a second spin", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-wheel",
        game: { title: "Spin the Wheel", kind: "spin-wheel" },
        status: "live",
        startedAt: "2026-10-17T10:00:00.000Z",
        currentRound: { key: "spin-1", number: 1, total: 1 },
        currentPrompt: "Spin the wheel",
        participant: { hasSubmitted: false, score: null },
        sessionResult: { kind: "spin-wheel", outcomeId: "bonus", label: "Bonus points", points: 25 },
        leaderboard: [],
        aggregateResults: [],
      },
      status: "ready", actionBusy: false, mediaUrl: null, mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });
    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-wheel" }));

    expect(markup).toContain("Host result: Bonus points");
    expect(markup).not.toContain("Spin the wheel</button>");
  });

  it("shows safe live standings for competitive guests", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-trivia", game: { title: "Trivia", kind: "live-trivia" }, status: "live",
        startedAt: "2026-10-17T10:00:00.000Z", currentRound: { key: "round-1", number: 1, total: 1 },
        currentPrompt: "Question?", participant: { hasSubmitted: false, score: 0 }, aggregateResults: [],
        leaderboard: [{ rank: 1, label: "Blue Team", score: 20, teamLabel: "Blue Team" }],
      },
      status: "ready", actionBusy: false, mediaUrl: null, comparisonMediaUrl: null, mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });

    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-trivia" }));

    expect(markup).toContain("Live standings");
    expect(markup).toContain("Blue Team");
    expect(markup).toContain("20 points");
    expect(markup).not.toContain("awardRecipient");
  });

  it("renders an anonymous This or That vote and aggregate-only results", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-this-or-that",
        game: { title: "This or That", kind: "this-or-that" },
        status: "live",
        startedAt: "2026-10-17T10:00:00.000Z",
        currentRound: { key: "round-1", number: 1, total: 1 },
        currentPrompt: "Tea or coffee?",
        participant: { hasSubmitted: false, score: 0, gameData: { kind: "this-or-that", options: ["Tea", "Coffee"] } },
        aggregateResults: [{ label: "Tea", count: 3 }, { label: "Coffee", count: 2 }],
      },
      status: "ready", actionBusy: false, mediaUrl: null, mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });

    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-this-or-that" }));

    expect(markup).toContain("Submit vote");
    expect(markup).toContain("Tea");
    expect(markup).toContain("Coffee");
    expect(markup).toContain("Only the room’s combined totals are shown.");
    expect(markup).not.toContain("teamId");
    expect(markup).not.toContain("correctAnswer");
  });

  it("renders Family Feud with the server-assigned public team label and no answer board", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-family-feud",
        game: { title: "Family Feud", kind: "family-feud" },
        status: "live",
        startedAt: "2026-10-17T10:00:00.000Z",
        currentRound: { key: "round-1", number: 1, total: 1 },
        currentPrompt: "Name a popular fruit.",
        participant: { hasSubmitted: false, score: 0, gameData: { kind: "family-feud", teamLabel: "Blue" } },
        aggregateResults: [],
      },
      status: "ready", actionBusy: false, mediaUrl: null, mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });

    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-family-feud" }));

    expect(markup).toContain("Your team");
    expect(markup).toContain("Blue");
    expect(markup).toContain("Submit answer");
    expect(markup).not.toContain("Mango");
    expect(markup).not.toContain("teamId");
  });

  it("keeps Split the Room text private and offers a separate aggregate vote", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-split",
        game: { title: "Split the Room", kind: "split-the-room" },
        status: "live",
        startedAt: "2026-10-17T10:00:00.000Z",
        currentRound: { key: "round-1", number: 1, total: 1 },
        currentPrompt: "Would you rather?",
        participant: {
          hasSubmitted: true, hasVoted: false, score: 0,
          gameData: { kind: "split-the-room", options: ["Left", "Right"], maxResponseLength: 160 },
        },
        aggregateResults: [],
      },
      status: "ready", actionBusy: false, mediaUrl: null, mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });

    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-split" }));

    expect(markup).toContain("Choose the side you agree with");
    expect(markup).toContain("Left");
    expect(markup).toContain("Right");
    expect(markup).not.toContain("raw response");
    expect(markup).not.toContain("participantCredential");
  });

  it("shows completion and only host-approved Split the Room responses after pause", () => {
    viewModels.play.mockReturnValue({
      state: {
        sessionId: "session-split",
        game: { title: "Split the Room", kind: "split-the-room" },
        status: "paused",
        startedAt: "2026-10-17T10:00:00.000Z",
        currentRound: { key: "round-1", number: 1, total: 1 },
        currentPrompt: "Would you rather?",
        participant: {
          hasSubmitted: true, hasVoted: true, score: 0,
          gameData: { kind: "split-the-room", options: ["Left", "Right"], maxResponseLength: 160 },
        },
        aggregateResults: [{ label: "Left", count: 2 }, { label: "Right", count: 1 }],
        approvedResponses: ["Approved response"],
      },
      status: "ready", actionBusy: false, mediaUrl: null, mediaError: null,
      participantAlias: "Guest 1234", error: null, refresh: vi.fn(), exitGames: vi.fn(), submitAction: vi.fn(),
    });

    const markup = renderToStaticMarkup(createElement(EventGamePlayView, { sessionId: "session-split" }));

    expect(markup).toContain("Your response and vote are recorded.");
    expect(markup).toContain("Approved response");
    expect(markup).not.toContain("pending response");
  });
});
