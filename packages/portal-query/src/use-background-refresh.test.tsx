/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BACKGROUND_REFRESH_INTERVAL_MS,
  useBackgroundRefresh,
} from "./use-background-refresh";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("useBackgroundRefresh", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("polls every 30 seconds while visible, permits one request, refreshes on tab return, and stops on unmount", async () => {
    vi.useFakeTimers();
    const first = deferred<boolean>();
    const refresh = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(true);
    const { unmount } = renderHook(() => useBackgroundRefresh({ enabled: true, refresh }));

    expect(refresh).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(BACKGROUND_REFRESH_INTERVAL_MS); });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(BACKGROUND_REFRESH_INTERVAL_MS * 3); });
    expect(refresh).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      first.resolve(true);
      await first.promise;
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(BACKGROUND_REFRESH_INTERVAL_MS * 3); });
    expect(refresh).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(refresh).toHaveBeenCalledTimes(2);

    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(BACKGROUND_REFRESH_INTERVAL_MS * 4); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("backs off after transient errors and resets to the base cadence after success", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { unmount } = renderHook(() => useBackgroundRefresh({ enabled: true, refresh }));

    await act(async () => { await vi.advanceTimersByTimeAsync(BACKGROUND_REFRESH_INTERVAL_MS); });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(BACKGROUND_REFRESH_INTERVAL_MS); });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(BACKGROUND_REFRESH_INTERVAL_MS); });
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(BACKGROUND_REFRESH_INTERVAL_MS); });
    expect(refresh).toHaveBeenCalledTimes(3);
    unmount();
  });

  it("keeps manual refresh available while disabled and uses the latest refresh callback", async () => {
    vi.useFakeTimers();
    const first = vi.fn().mockResolvedValue(true);
    const next = vi.fn().mockResolvedValue(true);
    const { result, rerender } = renderHook(
      ({ enabled, refresh }) => useBackgroundRefresh({ enabled, refresh }),
      { initialProps: { enabled: false, refresh: first } },
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(BACKGROUND_REFRESH_INTERVAL_MS * 4); });
    expect(first).not.toHaveBeenCalled();
    await act(async () => { await result.current(); });
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ enabled: true, refresh: next });
    await act(async () => { await vi.advanceTimersByTimeAsync(BACKGROUND_REFRESH_INTERVAL_MS); });
    expect(next).toHaveBeenCalledTimes(1);
    rerender({ enabled: false, refresh: next });
    await act(async () => { await vi.advanceTimersByTimeAsync(BACKGROUND_REFRESH_INTERVAL_MS * 4); });
    expect(next).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current(); });
    expect(next).toHaveBeenCalledTimes(2);
  });
});
