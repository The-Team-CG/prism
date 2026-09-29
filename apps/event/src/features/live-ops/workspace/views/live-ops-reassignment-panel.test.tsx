/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReassignmentReviewPanel } from "./live-ops-sections";

afterEach(cleanup);

const liveOps = {
  tasks: [{ id: "task_1", title: "Stage cue check" }],
  taskReassignmentRequests: [
    { id: "req_1", eventId: "evt_1", taskId: "task_1", requestedBy: "Marco Santos", requestedByRole: "coordinator", fromOwnerRole: "Floor Director", fromOwnerName: "", toOwnerRole: "Stage Director", toOwnerName: "Sam Cruz", reason: "Marco is on the floor", status: "pending", requestedAt: "2026-10-01T08:00:00.000Z", autoApproveAt: "2026-10-01T08:02:00.000Z" },
    { id: "req_done", eventId: "evt_1", taskId: "task_1", requestedBy: "Marco Santos", requestedByRole: "coordinator", fromOwnerRole: "Usher", fromOwnerName: "", toOwnerRole: "Floor Director", toOwnerName: "", reason: "Already handled", status: "approved", requestedAt: "2026-10-01T07:00:00.000Z", autoApproveAt: "2026-10-01T07:02:00.000Z" },
  ],
};

function renderPanel() {
  const onDecide = vi.fn(async () => {});
  render(<ReassignmentReviewPanel liveOps={liveOps as never} busy={false} onDecide={onDecide} />);
  return onDecide;
}

describe("ReassignmentReviewPanel", () => {
  it("shows the pending request with the task's title and hides decided ones", () => {
    renderPanel();

    expect(screen.getByText(/Task: Stage cue check\. Requested by Marco Santos\. Marco is on the floor/)).toBeTruthy();
    expect(screen.queryByText(/Already handled/)).toBeNull();
  });

  it("approves without a note", () => {
    const onDecide = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(onDecide).toHaveBeenCalledWith("req_1", expect.objectContaining({ decision: "approved" }));
  });

  it("only rejects once a note is given and sends that note", () => {
    const onDecide = renderPanel();
    const reject = screen.getByRole("button", { name: "Reject" });
    expect(reject.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText(/Decision note/), { target: { value: "Sam is already on stage" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(onDecide).toHaveBeenCalledWith("req_1", { decision: "rejected", reason: "Sam is already on stage" });
  });
});
