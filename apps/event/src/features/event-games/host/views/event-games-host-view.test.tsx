/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const viewModel = vi.hoisted(() => ({
  useEventGamesHostViewModel: vi.fn(),
}));
const state = vi.hoisted(() => ({
  canManage: true,
  games: [],
  analytics: null,
  hostState: null,
  responses: [],
  responseCursor: null,
  lobbySlug: null,
  lobbyBranding: null,
  revealedPin: null as string | null,
  pinDismissed: false,
  busy: null,
  error: null as string | null,
  loading: false,
  canReviewResponses: false,
  load: vi.fn(),
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
  archiveGame: vi.fn(),
  publishDraft: vi.fn(),
  scheduleSession: vi.fn(),
  selectSession: vi.fn(),
  runHostCommand: vi.fn(),
  dismissPin: vi.fn(),
  provisionLobby: vi.fn(),
  updateLobbyBranding: vi.fn(),
  uploadLobbyLogo: vi.fn(),
  uploadGameMedia: vi.fn(),
  loadResponses: vi.fn(),
  loadMoreResponses: vi.fn(),
  moderateSubmission: vi.fn(),
  resolveFamilyFeudAnswer: vi.fn(),
  assignAward: vi.fn(),
}));

vi.mock("../view-models/use-event-games-host-view-model", () => ({
  useEventGamesHostViewModel: viewModel.useEventGamesHostViewModel,
}));

import { EventGamesHostView } from "./event-games-host-view";

describe("EventGamesHostView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(state, {
      canManage: true,
      games: [],
      analytics: null,
      hostState: null,
      responses: [],
      responseCursor: null,
      lobbySlug: null,
      lobbyBranding: null,
      revealedPin: null,
      pinDismissed: false,
      busy: null,
      error: null,
      loading: false,
      canReviewResponses: false,
    });
    state.assignAward.mockResolvedValue({ id: "award-1" });
    viewModel.useEventGamesHostViewModel.mockReturnValue(state);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("shows an empty-event state without exposing host controls", () => {
    render(<EventGamesHostView eventId={null} role="pmcm-admin" eventStatus="" archived={false} />);

    expect(screen.getByText(/select an event/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /create game/i })).toBeNull();
  });

  it("shows only event-host controls to pmcm admins", () => {
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    expect(screen.getByRole("heading", { name: /event games/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /create game/i })).toBeTruthy();
  });

  it("does not render host controls for unsupported roles", () => {
    state.canManage = false;
    render(<EventGamesHostView eventId="event-1" role="supplier" eventStatus="confirmed" archived={false} />);

    expect(screen.getByText(/host controls are available to pmcm admins and event-assigned coordinators/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /create game/i })).toBeNull();
  });

  it("shows historical responses read-only after event end", () => {
    Object.assign(state, {
      canManage: false,
      canReviewResponses: true,
      analytics: {
        eventId: "event-1",
        totals: {
          gamesCreated: 1,
          sessionsStarted: 1,
          sessionsCompleted: 1,
          distinctEventParticipants: 2,
          participantJoins: 2,
          roundsAnswered: 4,
          completionRate: 1,
        },
        sessions: [{ sessionId: "session-1", gameTitle: "Trivia", kind: "live-trivia", status: "completed", participantJoins: 2, roundsAnswered: 4 }],
        participationOverTime: [],
      },
      responses: [{
        id: "response-1",
        roundNumber: 1,
        participantAlias: "Player 1",
        response: "Answer",
        moderationStatus: "pending",
        scoreAwarded: null,
        submittedAt: "2026-10-17T10:01:00.000Z",
      }],
    });

    render(<EventGamesHostView
      eventId="event-1"
      role="pmcm-admin"
      eventStatus="confirmed"
      archived={false}
      actualEndedAt="2026-10-17T10:00:00.000Z"
    />);

    expect(screen.getByRole("heading", { name: /post-event response review/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /create game/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^hide$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /load responses/i })).toBeTruthy();
  });

  it("assigns an award only to a host-visible anonymous leaderboard recipient", async () => {
    Object.assign(state, {
      hostState: {
        eventId: "event-1",
        sessionId: "session-1",
        game: { id: "game-1", title: "Trivia", kind: "live-trivia" },
        status: "live",
        scheduledStartAt: null,
        startedAt: null,
        endedAt: null,
        participantCount: 1,
        currentRound: null,
        leaderboard: [{
          rank: 1,
          label: "Player 1",
          score: 40,
          awardRecipient: {
            type: "participant",
            participationGrantId: "3ea50a76-6441-4e57-9b11-2e83817e9012",
          },
        }],
      },
    });
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    fireEvent.change(screen.getByLabelText("Award recipient"), {
      target: { value: "participant:3ea50a76-6441-4e57-9b11-2e83817e9012" },
    });
    expect(screen.queryByText("3ea50a76-6441-4e57-9b11-2e83817e9012")).toBeNull();
    fireEvent.change(screen.getByLabelText("Award label"), { target: { value: "Top score" } });
    fireEvent.change(screen.getByLabelText("Points"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /assign award/i }));

    await waitFor(() => expect(state.assignAward).toHaveBeenCalledWith("session-1", {
      recipient: {
        type: "participant",
        participationGrantId: "3ea50a76-6441-4e57-9b11-2e83817e9012",
      },
      awardKind: "points",
      label: "Top score",
      points: 25,
    }));
  });

  it.each(["this-or-that", "split-the-room", "word-scramble", "this-or-that-solo"] as const)(
    "does not show a competitive leaderboard or award picker for %s",
    (kind) => {
      Object.assign(state, {
        hostState: {
          eventId: "event-1",
          sessionId: "session-noncompetitive",
          game: { id: "game-1", title: "Test game", kind },
          status: "live",
          scheduledStartAt: null,
          startedAt: null,
          endedAt: null,
          participantCount: 2,
          currentRound: null,
          leaderboard: [{
            rank: 1,
            label: "Player 1",
            score: 0,
            awardRecipient: {
              type: "participant",
              participationGrantId: "3ea50a76-6441-4e57-9b11-2e83817e9012",
            },
          }],
        },
      });

      const { unmount } = render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

      expect(screen.queryByRole("region", { name: "Live leaderboard" })).toBeNull();
      expect(screen.queryByRole("region", { name: "Assign an award" })).toBeNull();
      unmount();
    },
  );

  it("shows a guest lobby URL on the guest portal origin", () => {
    vi.stubEnv("NEXT_PUBLIC_GUEST_PORTAL_URL", "https://games.example.test");
    Object.assign(state, { lobbySlug: "opaque-lobby" });
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    expect(screen.getByText("https://games.example.test/games/events/opaque-lobby")).toBeTruthy();
    expect(screen.getByRole("button", { name: /copy lobby url/i })).toBeTruthy();
  });

  it("lets the host save a high-contrast lobby theme and custom colors", async () => {
    state.updateLobbyBranding.mockResolvedValue({
      theme: "forest", primaryColor: "#14532D", secondaryColor: "#166534", logoUrl: null, logoObjectId: null,
    });
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    fireEvent.change(screen.getByLabelText("Guest lobby theme"), { target: { value: "forest" } });
    fireEvent.change(screen.getByLabelText("Primary brand color"), { target: { value: "#14532D" } });
    fireEvent.change(screen.getByLabelText("Secondary brand color"), { target: { value: "#166534" } });
    fireEvent.click(screen.getByRole("button", { name: "Save branding" }));

    await waitFor(() => expect(state.updateLobbyBranding).toHaveBeenCalledWith({
      theme: "forest",
      primaryColor: "#14532D",
      secondaryColor: "#166534",
      logoObjectId: null,
    }));
  });

  it("sends an accepted image file to the scoped lobby logo upload action", async () => {
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    fireEvent.change(screen.getByLabelText("Guest lobby logo"), { target: { files: [file] } });

    await waitFor(() => expect(state.uploadLobbyLogo).toHaveBeenCalledWith(file));
  });

  it("keeps template drafts unavailable for play until valid configuration is saved", () => {
    Object.assign(state, {
      games: [{
        id: "game-draft",
        title: "Trivia draft",
        kind: "live-trivia",
        entryMode: "active",
        version: 1,
        status: "draft",
      }],
    });
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    expect(screen.getByText(/save a complete template configuration before publishing/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /publish/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /create host session/i })).toBeNull();
  });

  it("lets organizers configure Bingo and saves the strict template contract", async () => {
    Object.assign(state, { games: [{
      id: "bingo-draft", eventId: "event-1", slug: "bingo", title: "Bingo draft",
      kind: "bingo", entryMode: "active", version: 1, status: "draft", config: {},
      availableFrom: null, availableUntil: null,
    }] });
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    fireEvent.change(screen.getByLabelText(/call sequence/i), {
      target: { value: Array.from({ length: 24 }, (_, index) => index + 1).join(",") },
    });
    fireEvent.click(screen.getByRole("button", { name: /save template configuration/i }));

    await waitFor(() => expect(state.updateDraft).toHaveBeenCalledWith("bingo-draft", {
      configuration: {
        kind: "bingo",
        callSequence: Array.from({ length: 24 }, (_, index) => index + 1),
        callIntervalSeconds: 10,
        winPattern: "line",
        points: 100,
      },
    }));
  });

  it("publishes a saved Bingo configuration through the host command path", () => {
    Object.assign(state, { games: [{
      id: "bingo-ready", eventId: "event-1", slug: "bingo", title: "Bingo",
      kind: "bingo", entryMode: "active", version: 2, status: "draft",
      config: { configuration: {
        kind: "bingo", callSequence: Array.from({ length: 24 }, (_, index) => index + 1),
        callIntervalSeconds: 10, winPattern: "line", points: 100,
      } },
      availableFrom: null, availableUntil: null,
    }] });
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    fireEvent.click(screen.getByRole("button", { name: /publish game/i }));

    expect(state.publishDraft).toHaveBeenCalledWith("bingo-ready");
  });

  it("shows Trivia round context and routes the reveal action through the host pause command", () => {
    Object.assign(state, {
      hostState: {
        eventId: "event-1",
        sessionId: "session-1",
        game: { id: "game-1", title: "Trivia", kind: "live-trivia" },
        status: "live",
        scheduledStartAt: null,
        startedAt: "2026-10-16T09:00:00.000Z",
        endedAt: null,
        participantCount: 2,
        currentRound: { key: "round-1", number: 1, total: 5, prompt: "Which is correct?" },
        leaderboard: [],
      },
    });
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    expect(screen.getByText("Which is correct?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /reveal answer and pause/i }));
    expect(state.runHostCommand).toHaveBeenCalledWith("session-1", "pause");
  });

  it("lets the live host select the one session result for Spin the Wheel", () => {
    Object.assign(state, {
      hostState: {
        eventId: "event-1", sessionId: "session-wheel",
        game: { id: "game-wheel", title: "Spin the Wheel", kind: "spin-wheel" },
        status: "live", scheduledStartAt: null, startedAt: "2026-10-16T09:00:00.000Z", endedAt: null,
        participantCount: 2, currentRound: { key: "spin-1", number: 1, total: 1, prompt: "The wheel is ready." },
        leaderboard: [], sessionResult: null,
      },
    });
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Spin wheel" }));

    expect(state.runHostCommand).toHaveBeenCalledWith("session-wheel", "spin-wheel");
  });

  it("lets the host advance a live Split the Room round", () => {
    Object.assign(state, {
      hostState: {
        eventId: "event-1",
        sessionId: "session-1",
        game: { id: "game-1", title: "Split the Room", kind: "split-the-room" },
        status: "live",
        scheduledStartAt: null,
        startedAt: "2026-10-16T09:00:00.000Z",
        endedAt: null,
        participantCount: 2,
        currentRound: { key: "round-1", number: 1, total: 2, prompt: "Pick a side" },
        leaderboard: [],
      },
    });
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Next round" }));

    expect(state.runHostCommand).toHaveBeenCalledWith("session-1", "advance-round", "round-1");
  });

  it("lets a live host review and approve pending Split the Room text", () => {
    Object.assign(state, {
      hostState: {
        eventId: "event-1",
        sessionId: "session-1",
        game: { id: "game-1", title: "Split the Room", kind: "split-the-room" },
        status: "live",
        scheduledStartAt: null,
        startedAt: "2026-10-16T09:00:00.000Z",
        endedAt: null,
        participantCount: 2,
        currentRound: {
          key: "round-1", number: 1, total: 1, prompt: "Pick a side",
          pendingSubmissions: [{ id: "submission-1", roundNumber: 1, response: "A pending response" }],
        },
        leaderboard: [],
      },
    });
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    expect(screen.getByText("A pending response")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve for reveal" }));

    expect(state.moderateSubmission).toHaveBeenCalledWith("session-1", "submission-1", "approve_submission");
  });

  it("lets a live host award only configured Family Feud answer points or choose no award", () => {
    Object.assign(state, {
      hostState: {
        eventId: "event-1",
        sessionId: "session-1",
        game: { id: "game-1", title: "Family Feud", kind: "family-feud" },
        status: "live",
        scheduledStartAt: null,
        startedAt: "2026-10-16T09:00:00.000Z",
        endedAt: null,
        participantCount: 2,
        currentRound: {
          key: "round-1", number: 1, total: 1, prompt: "Name a popular fruit.",
          answerBoard: [{ answer: "Mango", alternatives: ["Mangga"], points: 10 }],
          pendingAnswers: [{ id: "submission-1", roundNumber: 1, answer: "Mangga" }],
        },
        leaderboard: [],
      },
    });
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    expect(screen.getByText("Mangga")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Award Mango · 10 points" }));
    expect(state.resolveFamilyFeudAnswer).toHaveBeenCalledWith("session-1", "submission-1", "Mango");
  });

  it("lets a live host award only configured Family Feud answer points or choose no award", () => {
    Object.assign(state, {
      hostState: {
        eventId: "event-1",
        sessionId: "session-1",
        game: { id: "game-1", title: "Family Feud", kind: "family-feud" },
        status: "live",
        scheduledStartAt: null,
        startedAt: "2026-10-16T09:00:00.000Z",
        endedAt: null,
        participantCount: 2,
        currentRound: {
          key: "round-1", number: 1, total: 1, prompt: "Name a popular fruit.",
          answerBoard: [{ answer: "Mango", alternatives: ["Mangga"], points: 10 }],
          pendingAnswers: [{ id: "submission-1", roundNumber: 1, answer: "Mangga" }],
        },
        leaderboard: [],
      },
    });
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    expect(screen.getByText("Mangga")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Award Mango · 10 points" }));
    expect(state.resolveFamilyFeudAnswer).toHaveBeenCalledWith("session-1", "submission-1", "Mango");
  });

  it("surfaces an unauthorized API response as a safe alert", () => {
    state.error = "You are not authorized to manage games for this event.";
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    expect(screen.getByRole("alert").textContent).toMatch(/not authorized/i);
  });

  it("reveals a newly issued session PIN only in the current view", () => {
    Object.assign(state, {
      revealedPin: "482163",
      hostState: {
        eventId: "event-1",
        sessionId: "session-1",
        game: { id: "game-1", title: "Trivia", kind: "live-trivia" },
        status: "live",
        scheduledStartAt: null,
        startedAt: null,
        endedAt: null,
        participantCount: 0,
        currentRound: null,
        leaderboard: [],
      },
    });
    render(<EventGamesHostView eventId="event-1" role="pmcm-admin" eventStatus="confirmed" archived={false} />);

    expect(screen.getByText("482163")).toBeTruthy();
    expect(screen.getByRole("button", { name: /hide pin/i })).toBeTruthy();
  });
});
