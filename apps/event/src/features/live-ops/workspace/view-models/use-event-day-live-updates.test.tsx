/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EVENT_DAY_LIVE_UPDATE_INTERVAL_MS,
  useEventDayLiveUpdates,
} from "./use-event-day-live-updates";

describe("useEventDayLiveUpdates", () => {
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("refreshes an active screen on entry, every 30 seconds, and on return to the tab", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useEventDayLiveUpdates({ enabled, refresh }),
      { initialProps: { enabled: true } },
    );

    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVENT_DAY_LIVE_UPDATE_INTERVAL_MS);
    });
    expect(refresh).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVENT_DAY_LIVE_UPDATE_INTERVAL_MS);
    });
    expect(refresh).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(refresh).toHaveBeenCalledTimes(3);

    rerender({ enabled: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVENT_DAY_LIVE_UPDATE_INTERVAL_MS);
    });
    expect(refresh).toHaveBeenCalledTimes(3);
    unmount();
  });

  it("does not make an initial duplicate request when the screen already loads its role view", () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);

    const { unmount } = renderHook(() =>
      useEventDayLiveUpdates({ enabled: true, refresh, refreshOnEnable: false }),
    );

    expect(refresh).not.toHaveBeenCalled();
    unmount();
  });
});
