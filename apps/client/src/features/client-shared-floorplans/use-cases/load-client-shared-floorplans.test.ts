import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismClientSharedFloorplanEntry } from "@prism/types";

vi.mock("../data/client-shared-floorplans-repository", () => ({
  clientSharedFloorplansRepository: {
    listSharedFloorplans: vi.fn(),
    loadSnapshot: vi.fn(),
  },
}));

import { clientSharedFloorplansRepository } from "../data/client-shared-floorplans-repository";
import { loadClientSharedFloorplanSnapshot } from "./load-client-shared-floorplans";

const ENTRY: PrismClientSharedFloorplanEntry = {
  eventId: "evt_1",
  eventName: "Summit",
  eventDate: "2026-11-15T00:00:00.000Z",
  draftId: "draft_1",
  draftName: "Main Hall",
  draftStatus: "in_review",
  availableSnapshots: ["submitted"],
};

describe("loadClientSharedFloorplanSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientSharedFloorplansRepository.listSharedFloorplans).mockResolvedValue([ENTRY]);
    vi.mocked(clientSharedFloorplansRepository.loadSnapshot).mockResolvedValue({ id: "snapshot_1" } as never);
  });

  it("loads a snapshot only when the read model advertises that snapshot type", async () => {
    await expect(loadClientSharedFloorplanSnapshot("evt_1", "draft_1", "submitted"))
      .resolves.toEqual({ entry: ENTRY, project: { id: "snapshot_1" } });
    expect(clientSharedFloorplansRepository.loadSnapshot)
      .toHaveBeenCalledWith("evt_1", "draft_1", "submitted");

    await expect(loadClientSharedFloorplanSnapshot("evt_1", "draft_1", "approved"))
      .rejects.toThrow("no longer available");
    expect(clientSharedFloorplansRepository.loadSnapshot).toHaveBeenCalledTimes(1);
  });

  it("does not load a draft from another event", async () => {
    await expect(loadClientSharedFloorplanSnapshot("evt_other", "draft_1", "submitted"))
      .rejects.toThrow("no longer available");
    expect(clientSharedFloorplansRepository.loadSnapshot).not.toHaveBeenCalled();
  });
});
