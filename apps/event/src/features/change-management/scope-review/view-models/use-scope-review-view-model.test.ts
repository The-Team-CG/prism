/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScopeReviewViewModel } from "./use-scope-review-view-model";

const { load, review } = vi.hoisted(() => ({ load: vi.fn(), review: vi.fn() }));
vi.mock("../data/scope-review-repository", () => ({
  scopeReviewRepository: { load, review },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const impacts = { billing: false, supplier: false, coordinator: false, floorplan: false };
const approval = { impacts, impactReviewConfirmed: true };

async function readyViewModel(frozen: boolean) {
  load.mockResolvedValue({
    requests: [],
    addenda: [],
    exceptions: [
      { id: "freeze_ex_1", requestedChange: "Add lighting", status: "approved", consumedAt: null },
      { id: "freeze_ex_2", requestedChange: "Old change", status: "approved", consumedAt: "2026-10-01T00:00:00.000Z" },
    ],
  });
  const hook = renderHook(() => useScopeReviewViewModel("evt_1", { frozen }));
  await waitFor(() => expect(hook.result.current.status).toBe("ready"));
  return hook;
}

describe("useScopeReviewViewModel", () => {
  it("does not send an approval until the impact review is confirmed", async () => {
    const { result } = await readyViewModel(false);

    let saved = true;
    await act(async () => { saved = await result.current.approve("scope_change_1", { ...approval, impactReviewConfirmed: false }); });

    expect(saved).toBe(false);
    expect(result.current.error).toContain("impact review");
    expect(review).not.toHaveBeenCalled();
  });

  it("requires an unused approved freeze exception to approve on a frozen event, and offers only unused ones", async () => {
    const { result } = await readyViewModel(true);
    expect(result.current.approvedExceptions.map((exception) => exception.id)).toEqual(["freeze_ex_1"]);

    let saved = true;
    await act(async () => { saved = await result.current.approve("scope_change_1", approval); });

    expect(saved).toBe(false);
    expect(review).not.toHaveBeenCalled();
  });

  it("sends a confirmed approval with the chosen exception, then reloads the register", async () => {
    review.mockResolvedValue({});
    const { result } = await readyViewModel(true);

    await act(async () => { await result.current.approve("scope_change_1", { ...approval, freezeExceptionId: "freeze_ex_1", impacts: { ...impacts, billing: true } }); });

    expect(review).toHaveBeenCalledWith("evt_1", "scope_change_1", expect.objectContaining({
      decision: "approve",
      impactReviewAcknowledged: true,
      freezeExceptionId: "freeze_ex_1",
      impacts: { ...impacts, billing: true },
    }));
    expect(load).toHaveBeenCalledTimes(2);
  });
});
