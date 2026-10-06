/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismClientSharedFloorplanEntry } from "@prism/types";

const { router } = vi.hoisted(() => ({ router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../data/client-shared-floorplans-repository", () => ({
  clientSharedFloorplansRepository: { readSession: vi.fn() },
}));
vi.mock("../use-cases/load-client-shared-floorplans", () => ({
  listClientSharedFloorplans: vi.fn(),
  loadClientSharedFloorplanSnapshot: vi.fn(),
}));

import { clientSharedFloorplansRepository } from "../data/client-shared-floorplans-repository";
import {
  listClientSharedFloorplans,
  loadClientSharedFloorplanSnapshot,
} from "../use-cases/load-client-shared-floorplans";
import {
  useClientSharedFloorplanSnapshotViewModel,
  useClientSharedFloorplansViewModel,
} from "./use-client-shared-floorplans-view-model";

const SESSION = {
  id: "client_1",
  name: "Ana Reyes",
  email: "ana@example.test",
  role: "client",
  signedInAt: "2026-10-05T00:00:00.000Z",
} as never;

const ENTRY: PrismClientSharedFloorplanEntry = {
  eventId: "evt_1",
  eventName: "Summit",
  eventDate: "2026-11-15T00:00:00.000Z",
  draftId: "draft_1",
  draftName: "Main Hall",
  draftStatus: "approved",
  availableSnapshots: ["submitted", "approved"],
};

describe("client shared floorplans view models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientSharedFloorplansRepository.readSession).mockReturnValue(SESSION);
    vi.mocked(listClientSharedFloorplans).mockResolvedValue([ENTRY]);
    vi.mocked(loadClientSharedFloorplanSnapshot).mockResolvedValue({
      entry: ENTRY,
      project: { id: "snapshot_1" } as never,
    });
  });

  it("loads only the shared-floorplan read model and supports an empty response", async () => {
    const { result, rerender } = renderHook(() => useClientSharedFloorplansViewModel());
    await waitFor(() => expect(result.current.entries).toEqual([ENTRY]));
    expect(listClientSharedFloorplans).toHaveBeenCalledTimes(1);

    vi.mocked(listClientSharedFloorplans).mockResolvedValue([]);
    await act(async () => result.current.reload());
    expect(result.current.entries).toEqual([]);
    rerender();
  });

  it("surfaces a list API error without fabricating shared entries", async () => {
    vi.mocked(listClientSharedFloorplans).mockRejectedValue(new Error("Unable to load"));
    const { result } = renderHook(() => useClientSharedFloorplansViewModel());
    await waitFor(() => expect(result.current.error).toBe("Unable to load"));
    expect(result.current.entries).toEqual([]);
  });

  it("loads the selected snapshot from an available entry", async () => {
    const { result } = renderHook(() =>
      useClientSharedFloorplanSnapshotViewModel("evt_1", "draft_1", "submitted"),
    );
    await waitFor(() => expect(result.current.project).toEqual({ id: "snapshot_1" }));
    expect(loadClientSharedFloorplanSnapshot).toHaveBeenCalledWith("evt_1", "draft_1", "submitted");
  });

  it("clears the snapshot and surfaces a revoked-grant denial", async () => {
    vi.mocked(loadClientSharedFloorplanSnapshot).mockRejectedValue({
      status: 403,
      message: "Forbidden",
    });
    const { result } = renderHook(() =>
      useClientSharedFloorplanSnapshotViewModel("evt_1", "draft_1", "approved"),
    );
    await waitFor(() => expect(result.current.error).toMatch(/no longer shared/i));
    expect(result.current.project).toBeNull();
  });

  it("does not request unsupported snapshot types", async () => {
    const { result } = renderHook(() =>
      useClientSharedFloorplanSnapshotViewModel("evt_1", "draft_1", "raw"),
    );
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(loadClientSharedFloorplanSnapshot).not.toHaveBeenCalled();
    expect(result.current.project).toBeNull();
  });
});
