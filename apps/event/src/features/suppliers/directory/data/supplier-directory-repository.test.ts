import { beforeEach, describe, expect, it, vi } from "vitest";

const eventApiRequestMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prism-api", () => ({ eventApiRequest: eventApiRequestMock }));

import { supplierDirectoryRepository } from "./supplier-directory-repository";

describe("supplierDirectoryRepository", () => {
  beforeEach(() => eventApiRequestMock.mockReset().mockResolvedValue({}));

  it("uses the scoped PMCM directory endpoint and forwards cancellation", async () => {
    const controller = new AbortController();
    const query = { q: "cater", categoryId: "cat-1", rating: "all", sort: "name", direction: "asc", page: 2, pageSize: 25 } as const;

    await supplierDirectoryRepository.listDirectory(query, controller.signal);

    expect(eventApiRequestMock).toHaveBeenCalledWith(
      "/api/suppliers/directory?q=cater&categoryId=cat-1&rating=all&sort=name&direction=asc&page=2&pageSize=25",
      { signal: controller.signal },
    );
  });

  it("encodes supplier IDs and reads each focused drawer resource", async () => {
    await supplierDirectoryRepository.getProfile("sup/1", { period: "all" });
    await supplierDirectoryRepository.listReviews("sup/1", { page: 0, pageSize: 25 });
    await supplierDirectoryRepository.listCertifications("sup/1", { page: 1, pageSize: 50 });
    await supplierDirectoryRepository.listRecords("sup/1", { page: 0, pageSize: 25, period: "30d" });
    await supplierDirectoryRepository.listEngagements("sup/1", { page: 0, pageSize: 25 });

    expect(eventApiRequestMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/suppliers/sup%2F1/profile?period=all",
      "/api/suppliers/sup%2F1/reviews?page=0&pageSize=25",
      "/api/suppliers/sup%2F1/certifications?page=1&pageSize=50",
      "/api/suppliers/sup%2F1/records?page=0&pageSize=25&period=30d",
      "/api/pmcm/suppliers/sup%2F1/engagements?page=0&pageSize=25",
    ]);
  });
});
