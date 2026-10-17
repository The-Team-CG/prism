/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismGamePublicState } from "@prism/types";

const participant = vi.hoisted(() => ({
  getState: vi.fn(),
  getMedia: vi.fn(),
  leave: vi.fn(),
  submit: vi.fn(),
}));
const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../use-cases/event-game-participant", () => ({
  getEventGameParticipantState: participant.getState,
  getEventGameParticipantMediaAuthorization: participant.getMedia,
  leaveEventGamesFromSession: participant.leave,
  submitEventGameParticipantAction: participant.submit,
}));

import { useEventGamePlayViewModel } from "./use-event-game-play-view-model";

function state(kind: PrismGamePublicState["game"]["kind"]): PrismGamePublicState {
  return {
    sessionId: "session-1",
    game: { title: "Event game", kind },
    status: "live",
    startedAt: "2026-10-17T10:00:00.000Z",
    currentRound: { key: "round-1", number: 1, total: 1 },
    currentPrompt: "Choose an answer",
    participant: { participantAlias: "Guest A1B2C3D4E5", hasSubmitted: false, score: 0 },
    aggregateResults: [],
  };
}

describe("useEventGamePlayViewModel session refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    participant.getState.mockResolvedValue(state("live-trivia"));
    participant.submit.mockResolvedValue(state("live-trivia"));
  });

  afterEach(() => vi.useRealTimers());

  it("retains the last good game state after a transient refresh error", async () => {
    const goodState = state("live-trivia");
    participant.getState.mockResolvedValueOnce(goodState);
    const { result } = renderHook(() => useEventGamePlayViewModel("session-1"));
    await waitFor(() => expect(result.current.state).toBe(goodState));
    participant.getState.mockRejectedValueOnce(new Error("Temporary network error"));

    await act(async () => { await result.current.refresh(); });

    expect(result.current.state).toBe(goodState);
    expect(result.current.status).toBe("ready");
    expect(result.current.error).toBe("Temporary network error");
  });

  it("uses the server-issued anonymous alias shown in the host leaderboard", async () => {
    const serverState = state("live-trivia");
    serverState.participant.participantAlias = "Guest 00D1C1C9F0";
    participant.getState.mockResolvedValueOnce(serverState);
    const { result } = renderHook(() => useEventGamePlayViewModel("session-1"));

    await waitFor(() => expect(result.current.state).toBe(serverState));

    expect(result.current.participantAlias).toBe("Guest 00D1C1C9F0");
  });

  it("refreshes immediately after a submitted answer and polls only Active (Multiplayer) sessions", async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(() => useEventGamePlayViewModel("session-1"));
    await act(async () => { await Promise.resolve(); });
    expect(participant.getState).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.submitAction({
        templateId: "live-trivia", roundKey: "round-1", actionKind: "answer", payload: { answer: "A" },
      });
    });
    expect(participant.getState).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.resolve();
    });
    expect(participant.getState).toHaveBeenCalledTimes(3);
  });

  it("does not run a background poll for Independent (Singleplayer) sessions", async () => {
    vi.useFakeTimers();
    participant.getState.mockResolvedValue(state("word-scramble"));
    const { result } = renderHook(() => useEventGamePlayViewModel("session-1"));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.state?.game.kind).toBe("word-scramble");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
      await Promise.resolve();
    });
    expect(participant.getState).toHaveBeenCalledTimes(1);
  });
});
