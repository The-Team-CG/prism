import { describe, expect, it, vi } from "vitest";
import { PRIVACY_RETENTION_REVIEW_PAGE_SIZE, type PrismRetentionReviewItem } from "@prism/types";
import type { RetentionCommands } from "../data/retention-repository";
import { createRetentionUseCases } from "./retention-use-cases";

const page = (count: number, offset = 0) => Array.from({ length: count }, (_, index) => ({ id: `item_${offset + index}` }) as PrismRetentionReviewItem);

describe("retention review queue paging (New-SEC2)", () => {
  it("offers more items while pages come back full and asks for the page after the last item", async () => {
    const listReviewItems = vi.fn<RetentionCommands["listReviewItems"]>()
      .mockResolvedValueOnce(page(PRIVACY_RETENTION_REVIEW_PAGE_SIZE))
      .mockResolvedValueOnce(page(3, PRIVACY_RETENTION_REVIEW_PAGE_SIZE));
    const useCases = createRetentionUseCases({ listPolicies: vi.fn(async () => []), listReviewItems } as unknown as RetentionCommands);

    const first = await useCases.load("pending");
    expect(first.hasMore).toBe(true);
    const next = await useCases.loadMore("pending", first.items[first.items.length - 1]!.id);

    expect(listReviewItems).toHaveBeenLastCalledWith(expect.objectContaining({ status: "pending", after: `item_${PRIVACY_RETENTION_REVIEW_PAGE_SIZE - 1}`, limit: PRIVACY_RETENTION_REVIEW_PAGE_SIZE }));
    expect(next).toMatchObject({ hasMore: false });
    expect(next.items).toHaveLength(3);
  });
});
