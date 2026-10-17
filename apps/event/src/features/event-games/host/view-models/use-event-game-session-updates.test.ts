/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EVENT_GAME_SESSION_UPDATE_INTERVAL_MS,
  useEventGameSessionUpdates,
} from "./use-event-game-session-updates";

describe("useEventGameSessionUpdates", () => {
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("refreshes a selected live session on tab return without overlapping and stops when disabled", async () => {
    vi.useFakeTimers();
    let resolveRequest!: (value: boolean) => void;
    const refresh = vi.fn().mockImplementationOnce(() => new Promise<boolean>((resolve) => { resolveRequest = resolve; }))
      .mockResolvedValue(true);
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useEventGameSessionUpdates({ enabled, refresh }),
      { initialProps: { enabled: true } },
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(EVENT_GAME_SESSION_UPDATE_INTERVAL_MS); });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENT_GAME_SESSION_UPDATE_INTERVAL_MS * 2); });
    expect(refresh).toHaveBeenCalledTimes(1);
    resolveRequest(true);
    await act(async () => { await Promise.resolve(); });

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    await act(async () => { await vi.advanceTimersByTimeAsync(EVENT_GAME_SESSION_UPDATE_INTERVAL_MS * 2); });
    expect(refresh).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(refresh).toHaveBeenCalledTimes(2);
    rerender({ enabled: false });
    unmount();
  });
});
