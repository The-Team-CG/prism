/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientFloorplanReviewPanel } from "./client-floorplan-review-panel";

const { getReview } = vi.hoisted(() => ({ getReview: vi.fn() }));
vi.mock("../data/client-floorplan-review-repository", () => ({
  clientFloorplanReviewRepository: {
    get: getReview,
    decide: vi.fn(),
    annotate: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ClientFloorplanReviewPanel", () => {
  it("shows loading, then an actionable error, and retries the selected floorplan", async () => {
    let rejectInitialLoad!: (reason: Error) => void;
    const initialLoad = new Promise<never>((_resolve, reject) => { rejectInitialLoad = reject; });
    getReview.mockReturnValueOnce(initialLoad).mockResolvedValueOnce({
      draftId: "draft-1",
      snapshotHash: "abcdef1234567890",
      snapshot: { objects: [{ id: "table-1", name: "Head table" }] },
      decisions: [],
      annotations: [],
    });

    render(createElement(ClientFloorplanReviewPanel, { eventId: "event-1", draftId: "draft-1" }));
    expect(screen.getByText("Loading current floorplan…")).toBeTruthy();

    await act(async () => rejectInitialLoad(new Error("Review service unavailable")));
    expect(screen.getByRole("alert").textContent).toBe("Review service unavailable");
    expect(screen.queryByText("Loading current floorplan…")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry loading floorplan" }));
    expect(await screen.findByText("Version fingerprint: abcdef123456… · 1 layout object")).toBeTruthy();
    expect(getReview).toHaveBeenCalledTimes(2);
    expect(getReview).toHaveBeenLastCalledWith("event-1", "draft-1");
    expect(screen.getByRole("button", { name: "Approve this version" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Request revision" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add annotation" })).toBeTruthy();
  });
});
