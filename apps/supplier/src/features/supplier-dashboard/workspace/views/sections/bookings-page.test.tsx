/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismSupplierWorkflowWorkspace } from "@prism/types";
import { BookingsPage } from "./bookings-page";

const request = (id: string, over: Record<string, unknown> = {}) => ({
  id, eventId: `evt_${id}`, supplierId: "sup_x", category: "Digital Registration", message: "", status: "selected",
  assignmentStatus: "pending", readinessStatus: "pending", contractReviewStatus: "missing", eventDayStatus: "not_started", ...over,
});
const readiness = (id: string, eventDate: string, over: Record<string, unknown> = {}) => ({
  requestId: id, eventId: `evt_${id}`, eventName: `Event ${id}`, eventDate, quoteStatus: "selected",
  assignmentStatus: "pending", contractStatus: "missing", readinessStatus: "pending", schedule: null, ingressLate: false, ...over,
});
const handlers = {
  onReadinessNoteChange: vi.fn(), onStatusNoteChange: vi.fn(), onConfirmAssignment: vi.fn(), onConfirmReadiness: vi.fn(), onSaveContract: vi.fn(),
  onUpdateStatus: vi.fn(), onAcknowledgeSchedule: vi.fn(), onRequestScheduleChange: vi.fn(), onUpdateProgress: vi.fn(), onSubmitCreativeTask: vi.fn(), onDownloadObject: vi.fn(),
};
const workflow = { schedules: [], creativeTasks: [], contracts: [], payables: [
  { id: "p1", eventId: "evt_soon", requestId: "soon", quoteId: "q", label: "Deposit", amount: 100_000, dueDate: null, status: "released", amountReleased: 50_000, remainingBalance: 50_000, history: [], createdAt: "" },
  { id: "p2", eventId: "evt_soon", requestId: "soon", quoteId: "q", label: "Balance", amount: 142_500, dueDate: null, status: "scheduled", amountReleased: 0, remainingBalance: 142_500, history: [], createdAt: "" },
] } as unknown as PrismSupplierWorkflowWorkspace;

function renderPage() {
  const requests = [
    request("later", { assignmentStatus: "confirmed", readinessStatus: "confirmed", contractReviewStatus: "submitted" }),
    request("soon"),
  ];
  const board = { items: [
    readiness("later", "2026-12-12", { assignmentStatus: "confirmed", readinessStatus: "confirmed", contractStatus: "submitted" }),
    readiness("soon", "2026-11-23"),
  ] };
  return render(<BookingsPage selectedRequests={requests as never} readinessBoard={board as never} session={{} as never} readinessNotes={{}} statusNotes={{}} workflowWorkspace={workflow} busy={null} {...handlers} />);
}

const section = (name: RegExp) => screen.getByRole("heading", { name }).closest("section") as HTMLElement;

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-16T04:00:00.000Z")); });
afterEach(() => { cleanup(); vi.useRealTimers(); window.history.replaceState(null, "", "/"); });

describe("supplier bookings as cards", () => {
  it("leads with the bookings waiting on the supplier, each with its next step, progress and money released", () => {
    renderPage();
    const yours = section(/Needs you/);
    expect(within(yours).getByText("Event soon")).toBeTruthy();
    expect(within(yours).getByText("Confirm your booking")).toBeTruthy();
    expect(within(yours).getByText("in 7 days")).toBeTruthy();
    expect(within(yours).getByText("0 of 4 steps")).toBeTruthy();
    expect(within(yours).getByText("₱50,000 of ₱242,500 released")).toBeTruthy();
    const others = section(/Other bookings/);
    expect(within(others).getByText("Contract awaiting review")).toBeTruthy();
    expect(within(others).getByText("Waiting for PMCM")).toBeTruthy();
  });

  it("opens the full checklist in a panel from the card, and closes it again", () => {
    renderPage();
    fireEvent.click(within(section(/Needs you/)).getByRole("button", { name: "Do it" }));
    const panel = screen.getByRole("dialog", { name: "Event soon" });
    fireEvent.click(within(panel).getByRole("button", { name: "Confirm assignment" }));
    expect(handlers.onConfirmAssignment).toHaveBeenCalledWith(expect.objectContaining({ id: "soon" }));
    expect(window.location.hash).toBe("#supplier-work-soon");
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.hash).toBe("");
  });

  it("opens the booking a work link names, as a notice or the Today page sends", () => {
    window.history.replaceState(null, "", "/dashboard/bookings#supplier-work-later");
    renderPage();
    expect(screen.getByRole("dialog", { name: "Event later" })).toBeTruthy();
  });
});
