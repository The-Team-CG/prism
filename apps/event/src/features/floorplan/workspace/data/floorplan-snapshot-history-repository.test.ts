import { afterEach, describe, expect, it, vi } from "vitest";
import { floorplanSnapshotHistoryRepository } from "./floorplan-snapshot-history-repository";

afterEach(() => vi.unstubAllGlobals());

describe("floorplanSnapshotHistoryRepository", () => {
  it("reads the history route under the API's /api prefix", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(floorplanSnapshotHistoryRepository.list("evt_sample_ayala", "fp draft/1")).resolves.toEqual([]);

    const [input] = fetchMock.mock.calls[0] ?? [];
    const url = String(input);
    expect(new URL(url).pathname).toBe("/api/events/evt_sample_ayala/floorplans/fp%20draft%2F1/history");
  });
});
