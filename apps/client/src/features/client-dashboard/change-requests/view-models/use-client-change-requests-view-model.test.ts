/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismClientChangeRequest } from "@prism/types";
import { useClientChangeRequestsViewModel } from "./use-client-change-requests-view-model";

const { list, submitScopeChange, withdrawScopeChange } = vi.hoisted(() => ({
  list: vi.fn(),
  submitScopeChange: vi.fn(),
  withdrawScopeChange: vi.fn(),
}));
vi.mock("../data/client-change-request-repository", () => ({
  clientChangeRequestRepository: { list, submitScopeChange, withdrawScopeChange },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useClientChangeRequestsViewModel", () => {
  it("loads the client-safe change requests for the event", async () => {
    const requests: PrismClientChangeRequest[] = [
      { id: "freeze_ex_1", source: "freeze_exception", requestedChange: "Add stage lighting", category: null, status: "approved", clientResponse: null, updatedAt: "2026-10-12T00:00:00.000Z" },
    ];
    list.mockResolvedValue(requests);

    const { result } = renderHook(() => useClientChangeRequestsViewModel("evt_1"));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(list).toHaveBeenCalledWith("evt_1");
    expect(result.current.requests).toEqual(requests);
  });

  it("reports a load failure without showing stale or empty data as success", async () => {
    list.mockRejectedValue(new Error("Access denied"));

    const { result } = renderHook(() => useClientChangeRequestsViewModel("evt_1"));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Access denied");
    expect(result.current.requests).toEqual([]);
  });

  it("refuses an incomplete scope change before calling the API, and submits a complete one then refreshes", async () => {
    list.mockResolvedValue([]);
    submitScopeChange.mockResolvedValue({ id: "scope_change_1" });
    const { result } = renderHook(() => useClientChangeRequestsViewModel("evt_1"));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    let saved = true;
    await act(async () => { saved = await result.current.submitScopeChange({ title: "  ", description: "Move the cocktail hour", category: "schedule" }); });
    expect(saved).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(submitScopeChange).not.toHaveBeenCalled();

    await act(async () => { saved = await result.current.submitScopeChange({ title: "Add a sunset slot", description: "Move the cocktail hour", category: "schedule" }); });
    expect(saved).toBe(true);
    expect(submitScopeChange).toHaveBeenCalledWith("evt_1", { title: "Add a sunset slot", description: "Move the cocktail hour", category: "schedule" });
    expect(list).toHaveBeenCalledTimes(2);
  });
});
