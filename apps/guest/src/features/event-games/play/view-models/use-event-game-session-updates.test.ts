/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EVENT_GAME_SESSION_UPDATE_INTERVAL_MS,
  useEventGameSessionUpdates,
} from "./use-event-game-session-updates";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("useEventGameSessionUpdates", () => {
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("polls every 30 seconds while visible, permits one request, refreshes on tab return, and stops on unmount", async () => {
    vi.useFakeTimers();
    const first = deferred<boolean>();
    const refresh = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(true);
    const { unmount } = renderHook(() => useEventGameSessionUpdates({ enabled: true, refresh }));

    expect(refresh).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENT_GAME_SESSION_UPDATE_INTERVAL_MS); });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENT_GAME_SESSION_UPDATE_INTERVAL_MS * 3); });
    expect(refresh).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      first.resolve(true);
      await first.promise;
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENT_GAME_SESSION_UPDATE_INTERVAL_MS * 3); });
    expect(refresh).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(refresh).toHaveBeenCalledTimes(2);

    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENT_GAME_SESSION_UPDATE_INTERVAL_MS * 4); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("backs off after transient errors and resets to the base cadence after success", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { unmount } = renderHook(() => useEventGameSessionUpdates({ enabled: true, refresh }));

    await act(async () => { await vi.advanceTimersByTimeAsync(EVENT_GAME_SESSION_UPDATE_INTERVAL_MS); });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENT_GAME_SESSION_UPDATE_INTERVAL_MS); });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENT_GAME_SESSION_UPDATE_INTERVAL_MS); });
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENT_GAME_SESSION_UPDATE_INTERVAL_MS); });
    expect(refresh).toHaveBeenCalledTimes(3);
    unmount();
  });
});
