import { beforeEach, describe, expect, it, vi } from "vitest";

import { supplierDirectoryRepository } from "./supplier-directory-repository";

describe("supplierDirectoryRepository", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: { getItem: vi.fn(() => null) } });
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: {} }), { headers: { "content-type": "application/json" } }))));
  });

  const sentPaths = () => vi.mocked(fetch).mock.calls.map(([url]) => String(url).replace("http://localhost:4000/api", ""));

  it("uses the scoped PMCM directory endpoint and forwards cancellation", async () => {
    const controller = new AbortController();
    const query = { q: "cater", categoryId: "cat-1", rating: "all", sort: "name", direction: "asc", page: 2, pageSize: 25 } as const;

    await supplierDirectoryRepository.listDirectory(query, controller.signal);

    expect(sentPaths()).toEqual(["/suppliers/directory?q=cater&categoryId=cat-1&rating=all&sort=name&direction=asc&page=2&pageSize=25"]);
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it("encodes supplier IDs and reads each focused drawer resource", async () => {
    await supplierDirectoryRepository.getProfile("sup/1", { period: "all" });
    await supplierDirectoryRepository.listReviews("sup/1", { page: 0, pageSize: 25 });
    await supplierDirectoryRepository.listCertifications("sup/1", { page: 1, pageSize: 50 });
    await supplierDirectoryRepository.listRecords("sup/1", { page: 0, pageSize: 25, period: "30d" });
    await supplierDirectoryRepository.listEngagements("sup/1", { page: 0, pageSize: 25 });

    expect(sentPaths()).toEqual([
      "/suppliers/sup%2F1/profile?period=all",
      "/suppliers/sup%2F1/reviews?page=0&pageSize=25",
      "/suppliers/sup%2F1/certifications?page=1&pageSize=50",
      "/suppliers/sup%2F1/records?page=0&pageSize=25&period=30d",
      "/pmcm/suppliers/sup%2F1/engagements?page=0&pageSize=25",
    ]);
  });
});
