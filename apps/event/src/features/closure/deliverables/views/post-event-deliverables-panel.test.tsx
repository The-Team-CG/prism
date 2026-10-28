/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PostEventDeliverablesPanel } from "./post-event-deliverables-panel";
const { complete } = vi.hoisted(() => ({ complete: vi.fn() }));
vi.mock("../data/post-event-deliverables-repository", () => ({ postEventDeliverablesRepository: { complete } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const documents = [{ id: "doc_1", eventId: "evt_1", title: "Final event report", status: "pending" }, { id: "doc_other", eventId: "evt_other", title: "Private unrelated report", status: "pending" }];
describe("PostEventDeliverablesPanel", () => {
  it("shows only this event and confirms completion only after the API accepts it", async () => {
    complete.mockResolvedValue({ ...documents[0], status: "submitted" });
    render(<PostEventDeliverablesPanel eventId="evt_1" documents={documents} />);
    expect(screen.queryByText("Private unrelated report")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));
    expect(await screen.findByText("Complete")).toBeTruthy();
    expect(complete).toHaveBeenCalledWith("evt_1", "doc_1");
  });
  it("releases the next event's controls and ignores a late result from the previous event", async () => {
    let failFirst: (error: Error) => void = () => {};
    complete.mockImplementationOnce(() => new Promise((_resolve, reject) => { failFirst = reject; }));
    const view = render(<PostEventDeliverablesPanel eventId="evt_1" documents={documents} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));
    view.rerender(<PostEventDeliverablesPanel eventId="evt_other" documents={documents} />);
    expect(screen.getByRole("button", { name: "Mark complete" })).toHaveProperty("disabled", false);
    await act(async () => { failFirst(new Error("Old event failure")); });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Private unrelated report")).toBeTruthy();
    expect(screen.queryByText("Complete")).toBeNull();
  });

  it("keeps a failed completion actionable and makes archive read-only", async () => {
    complete.mockRejectedValueOnce(new Error("File unavailable"));
    const view = render(<PostEventDeliverablesPanel eventId="evt_1" documents={documents} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "File unavailable");
    expect(screen.queryByText("Complete")).toBeNull();
    view.rerender(<PostEventDeliverablesPanel eventId="evt_1" documents={documents} archived />);
    expect(screen.getByRole("button", { name: "Mark complete" })).toHaveProperty("disabled", true);
  });
});
