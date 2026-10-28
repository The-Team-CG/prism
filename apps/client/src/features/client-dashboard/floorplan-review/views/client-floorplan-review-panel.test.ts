/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientFloorplanReviewPanel } from "./client-floorplan-review-panel";

const { getReview, decide } = vi.hoisted(() => ({ getReview: vi.fn(), decide: vi.fn() }));
vi.mock("../data/client-floorplan-review-repository", () => ({
  clientFloorplanReviewRepository: {
    get: getReview,
    decide,
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

  it("sends a revision request as one decision and hands the new state to the workspace instead of reloading the review", async () => {
    getReview.mockResolvedValue({ draftId: "draft-1", snapshotHash: "abcdef1234567890abcdef1234567890", snapshot: { objects: [] }, decisions: [], annotations: [] });
    decide.mockResolvedValue({ id: "decision-1" });
    const onDecided = vi.fn(async () => undefined);

    render(createElement(ClientFloorplanReviewPanel, { eventId: "event-1", draftId: "draft-1", onDecided }));
    fireEvent.change(await screen.findByLabelText("Revision comment"), { target: { value: "Add a registration desk" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Request revision" })); });

    expect(decide).toHaveBeenCalledTimes(1);
    expect(decide).toHaveBeenCalledWith("event-1", "draft-1", expect.objectContaining({ action: "request_revision", comment: "Add a registration desk", snapshotHash: "abcdef1234567890abcdef1234567890" }));
    expect(onDecided).toHaveBeenCalledTimes(1);
    expect(getReview).toHaveBeenCalledTimes(1);
  });
});
