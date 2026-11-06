/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientFloorplanReviewPanel } from "./client-floorplan-review-panel";

const { getReview, decide, annotate } = vi.hoisted(() => ({ getReview: vi.fn(), decide: vi.fn(), annotate: vi.fn() }));
vi.mock("../data/client-floorplan-review-repository", () => ({
  clientFloorplanReviewRepository: {
    get: getReview,
    decide,
    annotate,
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

  it("pins a note to the element clicked on the plan and sends its anchor with the comment", async () => {
    getReview.mockResolvedValue({ draftId: "draft-1", snapshotHash: "abcdef1234567890abcdef1234567890", snapshot: { width: 20, height: 10, objects: [{ id: "table-1", name: "Head table", kind: "rect", x: 2, y: 2, w: 4, h: 2 }] }, decisions: [], annotations: [] });
    annotate.mockResolvedValue({});
    render(createElement(ClientFloorplanReviewPanel, { eventId: "event-1", draftId: "draft-1" }));
    const canvas = await screen.findByTestId("floorplan-review-canvas");
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });

    expect(screen.getByText("Click the plan to pin your note (optional).")).toBeTruthy();
    fireEvent.click(canvas, { clientX: 30, clientY: 30 });
    expect(screen.getByText("Pinned to Head table.")).toBeTruthy();
    expect(screen.getByTestId("pending-pin")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Floorplan annotation"), { target: { value: "Move this closer to the stage" } });
    fireEvent.click(screen.getByRole("button", { name: "Add annotation" }));
    await screen.findByText("Click the plan to pin your note (optional).");

    expect(annotate).toHaveBeenCalledWith("event-1", "draft-1", expect.objectContaining({ comment: "Move this closer to the stage", objectId: "table-1", anchorX: 0.15, anchorY: 0.3 }));
  });

  it("does not offer pinning once a decision exists", async () => {
    getReview.mockResolvedValue({ draftId: "draft-1", snapshotHash: "abcdef1234567890abcdef1234567890", snapshot: { width: 20, height: 10, objects: [{ id: "table-1", name: "Head table", kind: "rect", x: 2, y: 2, w: 4, h: 2 }] }, decisions: [{ id: "d1", action: "approve" }], annotations: [] });
    render(createElement(ClientFloorplanReviewPanel, { eventId: "event-1", draftId: "draft-1" }));
    const canvas = await screen.findByTestId("floorplan-review-canvas");
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });

    fireEvent.click(canvas, { clientX: 30, clientY: 30 });

    expect(screen.queryByTestId("pending-pin")).toBeNull();
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
