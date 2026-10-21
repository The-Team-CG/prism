/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  loadWorkspace: vi.fn(),
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
  archiveGame: vi.fn(),
  publishDraft: vi.fn(),
  createHostSession: vi.fn(),
  executeHostCommand: vi.fn(),
  getHostState: vi.fn(),
  ensureLobby: vi.fn(),
  updateLobbyBranding: vi.fn(),
  uploadLobbyLogo: vi.fn(),
  uploadGameMedia: vi.fn(),
  getResponseHistory: vi.fn(),
  moderate: vi.fn(),
  resolveFamilyFeudAnswer: vi.fn(),
  assignAward: vi.fn(),
}));

vi.mock("../use-cases/event-games-host-actions", () => ({
  eventGamesHostActions: actions,
}));

import { useEventGamesHostViewModel } from "./use-event-games-host-view-model";

const GAME = {
  id: "game-1",
  eventId: "event-1",
  slug: "trivia",
  title: "Trivia",
  kind: "live-trivia",
  entryMode: "active",
  status: "published",
  version: 1,
  config: {},
  availableFrom: null,
  availableUntil: null,
} as const;

const ANALYTICS = {
  eventId: "event-1",
  totals: {
    gamesCreated: 1,
    sessionsStarted: 1,
    sessionsCompleted: 0,
    distinctEventParticipants: 2,
    participantJoins: 2,
    roundsAnswered: 4,
    completionRate: 0,
  },
  sessions: [{
    sessionId: "session-1",
    gameTitle: "Trivia",
    kind: "live-trivia",
    status: "lobby",
    participantJoins: 2,
    roundsAnswered: 4,
  }],
  participationOverTime: [],
} as const;

const HOST_STATE = {
  eventId: "event-1",
  sessionId: "session-1",
  game: { id: "game-1", title: "Trivia", kind: "live-trivia" },
  status: "live",
  scheduledStartAt: null,
  startedAt: "2026-10-16T09:00:00.000Z",
  endedAt: null,
  participantCount: 2,
  currentRound: { key: "round-1", number: 1, total: 5, prompt: "Q1?" },
  leaderboard: [{ rank: 1, label: "Guest 12", score: 10 }],
};

const SESSION = {
  id: "session-1",
  eventId: "event-1",
  gameId: "game-1",
  configVersionId: "version-1",
  configSnapshot: {},
  title: "Trivia",
  kind: "live-trivia",
  entryMode: "active",
  status: "lobby",
  scheduledStartAt: null,
  startedAt: null,
  endedAt: null,
};

const ADMIN = {
  eventId: "event-1",
  role: "pmcm-admin" as const,
  eventStatus: "confirmed",
  archived: false,
};

describe("useEventGamesHostViewModel", () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.clearAllMocks();
    actions.loadWorkspace.mockResolvedValue({
      games: [GAME],
      analytics: ANALYTICS,
      branding: { theme: "prism", primaryColor: "#312E81", secondaryColor: "#0F766E", logoUrl: null, logoObjectId: null },
    });
    actions.createDraft.mockResolvedValue({ ...GAME, id: "game-2", status: "draft" });
    actions.updateDraft.mockResolvedValue({ ...GAME, title: "Updated Trivia" });
    actions.archiveGame.mockResolvedValue({ ...GAME, status: "removed" });
    actions.publishDraft.mockResolvedValue(GAME);
    actions.createHostSession.mockResolvedValue(SESSION);
    actions.executeHostCommand.mockResolvedValue({
      action: "enable_joins",
      outcome: "joins_enabled",
      pin: "482163",
      expiresAt: "2026-10-16T10:00:00.000Z",
    });
    actions.getHostState.mockResolvedValue(HOST_STATE);
    actions.ensureLobby.mockResolvedValue({ eventSlug: "opaque-lobby" });
    actions.updateLobbyBranding.mockResolvedValue({
      theme: "forest", primaryColor: "#14532D", secondaryColor: "#166534", logoUrl: null, logoObjectId: null,
    });
    actions.uploadLobbyLogo.mockResolvedValue({
      theme: "forest", primaryColor: "#14532D", secondaryColor: "#166534",
      logoUrl: "https://storage.example.test/logo", logoObjectId: "obj_00000000-0000-4000-8000-000000000107",
    });
    actions.uploadGameMedia.mockResolvedValue({ objectId: "obj_00000000-0000-4000-8000-000000000107" });
    actions.getResponseHistory.mockResolvedValue({
      sessionId: "session-1",
      items: [],
      limit: 25,
      nextCursor: null,
      hasMore: false,
    });
    actions.moderate.mockResolvedValue({ id: "moderation-1" });
    actions.resolveFamilyFeudAnswer.mockResolvedValue({ id: "moderation-2" });
    actions.assignAward.mockResolvedValue({ id: "award-1" });
  });

  it("loads only event-scoped games and aggregate analytics for an admin", async () => {
    const { result } = renderHook(() => useEventGamesHostViewModel(ADMIN));

    await waitFor(() => expect(result.current.games).toHaveLength(1));
    expect(actions.loadWorkspace).toHaveBeenCalledWith("event-1");
    expect(result.current.analytics?.totals.distinctEventParticipants).toBe(2);
    expect(result.current.analytics?.sessions[0]?.sessionId).toBe("session-1");
    expect(result.current.lobbyBranding?.theme).toBe("prism");
  });

  it("denies coordinators access to games after event closure", async () => {
    const { result } = renderHook(() => useEventGamesHostViewModel({
      ...ADMIN,
      role: "coordinator",
      eventStatus: "closed",
      archived: true,
    }));

    expect(result.current.canManage).toBe(false);
    expect(result.current.canReviewResponses).toBe(false);
    expect(actions.loadWorkspace).not.toHaveBeenCalled();
  });

  it("refreshes a selected active multiplayer session and its aggregates every 30 seconds", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEventGamesHostViewModel(ADMIN));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => { await result.current.selectSession("session-1"); });
    expect(actions.getHostState).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.resolve();
    });

    expect(actions.getHostState).toHaveBeenCalledTimes(2);
    expect(actions.loadWorkspace).toHaveBeenCalledTimes(2);
  });

  it("saves lobby colors and updates the displayed host state", async () => {
    const { result } = renderHook(() => useEventGamesHostViewModel(ADMIN));
    await waitFor(() => expect(result.current.lobbyBranding?.theme).toBe("prism"));

    const settings = { theme: "forest" as const, primaryColor: "#14532D", secondaryColor: "#166534", logoObjectId: null };
    await act(async () => {
      await result.current.updateLobbyBranding(settings);
    });

    expect(actions.updateLobbyBranding).toHaveBeenCalledWith("event-1", settings);
    expect(result.current.lobbyBranding?.theme).toBe("forest");
  });

  it("uploads a logo using current event branding and updates the host preview", async () => {
    const { result } = renderHook(() => useEventGamesHostViewModel(ADMIN));
    await waitFor(() => expect(result.current.lobbyBranding?.theme).toBe("prism"));
    const file = new File(["logo"], "logo.png", { type: "image/png" });

    await act(async () => { await result.current.uploadLobbyLogo(file); });

    expect(actions.uploadLobbyLogo).toHaveBeenCalledWith("event-1", file, {
      theme: "prism", primaryColor: "#312E81", secondaryColor: "#0F766E", logoUrl: null, logoObjectId: null,
    });
    expect(result.current.lobbyBranding?.logoObjectId).toBe("obj_00000000-0000-4000-8000-000000000107");
  });

  it("uploads a game image for the selected event and game", async () => {
    const { result } = renderHook(() => useEventGamesHostViewModel(ADMIN));
    await waitFor(() => expect(result.current.games).toHaveLength(1));
    const file = new File(["image"], "clue.png", { type: "image/png" });

    await act(async () => { await result.current.uploadGameMedia("game-1", file); });

    expect(actions.uploadGameMedia).toHaveBeenCalledWith("event-1", "game-1", file);
    expect(result.current.error).toBeNull();
  });

  it("does not load host data for unsupported portal roles", () => {
    const { result } = renderHook(() => useEventGamesHostViewModel({
      ...ADMIN,
      role: "supplier",
    }));

    expect(actions.loadWorkspace).not.toHaveBeenCalled();
    expect(result.current.canManage).toBe(false);
  });

  it("turns an unauthorized API response into an event-safe message", async () => {
    actions.loadWorkspace.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    const { result } = renderHook(() => useEventGamesHostViewModel(ADMIN));

    await waitFor(() => expect(result.current.error).toMatch(/not authorized/i));
    expect(result.current.games).toEqual([]);
  });

  it("creates, edits, archives, publishes, and schedules through the host actions", async () => {
    const { result } = renderHook(() => useEventGamesHostViewModel(ADMIN));
    await waitFor(() => expect(result.current.games).toHaveLength(1));

    await act(async () => {
      await result.current.createDraft({ kind: "live-trivia", title: "New trivia" });
      await result.current.updateDraft("game-1", { title: "Updated Trivia" });
      await result.current.archiveGame("game-1");
      await result.current.publishDraft("game-1");
      await result.current.scheduleSession("game-1", "2026-10-17T09:00:00.000Z");
    });

    expect(actions.createDraft).toHaveBeenCalledWith("event-1", {
      kind: "live-trivia",
      title: "New trivia",
    });
    expect(actions.updateDraft).toHaveBeenCalledWith("event-1", "game-1", {
      title: "Updated Trivia",
    });
    expect(actions.archiveGame).toHaveBeenCalledWith("event-1", "game-1");
    expect(actions.publishDraft).toHaveBeenCalledWith("event-1", "game-1");
    expect(actions.createHostSession).toHaveBeenCalledWith(
      "event-1",
      "game-1",
      "2026-10-17T09:00:00.000Z",
    );
  });

  it("reveals an issued PIN once and requires a new issue after dismissal", async () => {
    const { result } = renderHook(() => useEventGamesHostViewModel(ADMIN));
    await waitFor(() => expect(result.current.games).toHaveLength(1));

    await act(async () => {
      await result.current.runHostCommand("session-1", "enable-joins");
    });
    expect(result.current.revealedPin).toBe("482163");

    act(() => result.current.dismissPin());
    expect(result.current.revealedPin).toBeNull();
    expect(result.current.pinDismissed).toBe(true);

    await act(async () => {
      await result.current.runHostCommand("session-1", "enable-joins");
    });
    expect(actions.executeHostCommand).toHaveBeenCalledTimes(2);
    expect(result.current.revealedPin).toBe("482163");
  });

  it("assigns an award to the selected event-session participant or team", async () => {
    const { result } = renderHook(() => useEventGamesHostViewModel(ADMIN));
    await waitFor(() => expect(result.current.games).toHaveLength(1));
    const award = {
      recipient: { type: "participant" as const, participationGrantId: "00000000-0000-4000-8000-000000000110" },
      awardKind: "badge" as const,
      label: "Best answer",
    };

    await act(async () => {
      await result.current.assignAward("session-1", award);
    });

    expect(actions.assignAward).toHaveBeenCalledWith("event-1", "session-1", award);
    expect(actions.getHostState).toHaveBeenCalledWith("event-1", "session-1");
  });

  it("clears a revealed PIN when changing the event", async () => {
    const { result, rerender } = renderHook(
      ({ eventId }) => useEventGamesHostViewModel({ ...ADMIN, eventId }),
      { initialProps: { eventId: "event-1" } },
    );
    await waitFor(() => expect(result.current.games).toHaveLength(1));

    await act(async () => {
      await result.current.runHostCommand("session-1", "enable-joins");
    });
    expect(result.current.revealedPin).toBe("482163");

    rerender({ eventId: "event-2" });
    await waitFor(() => expect(actions.loadWorkspace).toHaveBeenCalledWith("event-2"));
    expect(result.current.revealedPin).toBeNull();
  });

  it("loads aggregate host state and closed-event response history only on request", async () => {
    const active = renderHook(() => useEventGamesHostViewModel(ADMIN));
    await waitFor(() => expect(active.result.current.games).toHaveLength(1));

    await act(async () => {
      await active.result.current.selectSession("session-1");
      await active.result.current.loadResponses("session-1");
    });
    expect(active.result.current.hostState?.leaderboard[0]?.label).toBe("Guest 12");
    expect(actions.getResponseHistory).not.toHaveBeenCalled();

    active.unmount();
    const archived = renderHook(() => useEventGamesHostViewModel({
      ...ADMIN,
      eventStatus: "closed",
      archived: true,
    }));
    await waitFor(() => expect(archived.result.current.analytics?.eventId).toBe("event-1"));

    await act(async () => {
      await archived.result.current.loadResponses("session-1");
    });
    expect(actions.getResponseHistory).toHaveBeenCalledWith("event-1", "session-1", undefined);
    expect(archived.result.current.responses).toEqual([]);
  });

  it("allows PMCM Admin historical reads after actual end but blocks host mutations", async () => {
    const { result } = renderHook(() => useEventGamesHostViewModel({
      ...ADMIN,
      eventStatus: "confirmed",
      archived: false,
      actualEndedAt: "2026-10-17T10:00:00.000Z",
    }));

    expect(result.current.canManage).toBe(false);
    expect(result.current.canReviewResponses).toBe(true);
    await waitFor(() => expect(result.current.analytics?.eventId).toBe("event-1"));

    await act(async () => {
      await result.current.loadResponses("session-1");
      await result.current.moderateSubmission("session-1", "submission-1", "hide_submission", "reason");
    });

    expect(actions.getResponseHistory).toHaveBeenCalledWith("event-1", "session-1", undefined);
    expect(actions.moderate).not.toHaveBeenCalled();
    expect(actions.getHostState).not.toHaveBeenCalled();
  });

  it("does not provision a lobby or moderate after event closure", async () => {
    const { result } = renderHook(() => useEventGamesHostViewModel({
      ...ADMIN,
      eventStatus: "closed",
      archived: true,
    }));
    await waitFor(() => expect(result.current.analytics?.eventId).toBe("event-1"));

    await act(async () => {
      await result.current.provisionLobby();
      await result.current.moderateSubmission("session-1", "submission-1", "hide_submission", "spam");
    });

    expect(result.current.lobbySlug).toBeNull();
    expect(actions.ensureLobby).not.toHaveBeenCalled();
    expect(actions.moderate).not.toHaveBeenCalled();
  });

  it("allows an assigned coordinator to moderate live submissions and refresh the host view", async () => {
    const { result } = renderHook(() => useEventGamesHostViewModel({
      eventId: "event-1",
      role: "coordinator",
      eventStatus: "confirmed",
      archived: false,
    }));
    await waitFor(() => expect(result.current.games).toHaveLength(1));

    await act(async () => {
      await result.current.selectSession("session-1");
      await result.current.moderateSubmission("session-1", "submission-1", "approve_submission");
    });

    expect(actions.moderate).toHaveBeenCalledWith("event-1", "session-1", "submission-1", "approve_submission", undefined);
    expect(actions.getHostState).toHaveBeenCalledWith("event-1", "session-1");
  });

  it("resolves Family Feud answers with a board choice and refreshes the host state", async () => {
    const { result } = renderHook(() => useEventGamesHostViewModel(ADMIN));
    await waitFor(() => expect(result.current.games).toHaveLength(1));

    await act(async () => {
      await result.current.selectSession("session-1");
      await result.current.resolveFamilyFeudAnswer("session-1", "submission-1", "Mango");
    });

    expect(actions.resolveFamilyFeudAnswer).toHaveBeenCalledWith("event-1", "session-1", "submission-1", "Mango");
    expect(actions.getHostState).toHaveBeenCalledWith("event-1", "session-1");
  });
});
