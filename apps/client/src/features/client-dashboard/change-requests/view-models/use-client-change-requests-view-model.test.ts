/** @vitest-environment jsdom */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismClientChangeRequest } from "@prism/types";
import { useClientChangeRequestsViewModel } from "./use-client-change-requests-view-model";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../data/client-change-request-repository", () => ({
  clientChangeRequestRepository: { list },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useClientChangeRequestsViewModel", () => {
  it("loads the client-safe change requests for the event", async () => {
    const requests: PrismClientChangeRequest[] = [
      { id: "freeze_ex_1", requestedChange: "Add stage lighting", status: "approved", updatedAt: "2026-10-12T00:00:00.000Z" },
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
});
