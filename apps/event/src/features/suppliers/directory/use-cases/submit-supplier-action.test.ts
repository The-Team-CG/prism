import { describe, expect, it, vi } from "vitest";

const commands = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), changeTier: vi.fn(), review: vi.fn(), reliabilityNote: vi.fn(), promote: vi.fn(), certification: vi.fn(),
}));
vi.mock("../data/supplier-directory-commands", () => ({ supplierDirectoryCommands: commands }));

import { submitSupplierAction } from "./submit-supplier-action";

describe("submitSupplierAction", () => {
  it("normalizes blank optional profile fields before shared validation", async () => {
    commands.create.mockResolvedValue({ id: "supplier-1" });
    const refresh = vi.fn().mockResolvedValue(undefined);

    const result = await submitSupplierAction({ kind: "create", input: { categoryId: "category-1", name: "Harborline", contactName: " ", email: "", phone: "", tier: "tier_2" } }, { refresh });

    expect(result).toEqual({ saved: true, refreshFailed: false });
    expect(commands.create).toHaveBeenCalledWith({ categoryId: "category-1", name: "Harborline", tier: "tier_2" });
  });

  it("requires the explicitly selected eligible event and keeps review idempotency on refusal", async () => {
    const input = { eventId: "evt-b", rating: 5, notes: "Delivered as agreed", idempotencyKey: "review-key" };
    const result = await submitSupplierAction({ kind: "review", supplierId: "supplier-1", input }, { refresh: vi.fn(), eligibleReviewEventIds: ["evt-a"] });

    expect(result).toMatchObject({ saved: false, message: expect.stringContaining("eligible completed event") });
    expect(commands.review).not.toHaveBeenCalled();
    expect(input.idempotencyKey).toBe("review-key");
  });

  it("sends the selected event and unchanged idempotency key when it is eligible", async () => {
    commands.review.mockRejectedValueOnce(new Error("server refused stale eligibility"));
    const input = { eventId: "evt-b", rating: 5, notes: "Delivered as agreed", idempotencyKey: "review-key" };
    const draft = { kind: "review" as const, supplierId: "supplier-1", input };

    await submitSupplierAction(draft, { refresh: vi.fn(), eligibleReviewEventIds: ["evt-b"] });
    await submitSupplierAction(draft, { refresh: vi.fn(), eligibleReviewEventIds: ["evt-b"] });

    expect(commands.review).toHaveBeenNthCalledWith(1, "supplier-1", input);
    expect(commands.review).toHaveBeenNthCalledWith(2, "supplier-1", input);
  });

  it("requires an assessment-eligible event for pending-first-event promotion", async () => {
    const input = { eventId: "evt-a", tier: "tier_1", reason: "Assessment completed", idempotencyKey: "promotion-key" };
    const result = await submitSupplierAction({ kind: "promote", supplierId: "supplier-1", input }, { refresh: vi.fn(), eligiblePromotionEventIds: [] });

    expect(result).toMatchObject({ saved: false, message: expect.stringContaining("assessed completed event") });
    expect(commands.promote).not.toHaveBeenCalled();
  });
});
