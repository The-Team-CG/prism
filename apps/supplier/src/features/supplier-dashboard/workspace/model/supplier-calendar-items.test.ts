import { describe, expect, it } from "vitest";
import type { PrismSupplierReadinessBoard, PrismSupplierWorkflowWorkspace } from "@prism/types";
import { buildSupplierCalendarItems } from "./supplier-calendar-items";
import type { SupplierWorkspace } from "./supplier-workspace-types";

const request = (id: string, status: string, dueDate: string, eventId = "e1") => ({ id, eventId, status, dueDate, category: "Lights" });
const readinessItem = (requestId: string, eventDate: string | null, eventId = "e1") => ({ requestId, eventId, eventName: "Gala", eventDate, category: "Lights" });

describe("buildSupplierCalendarItems", () => {
  it("shows live deadlines, one event day per event and booked work, each linking to where it is acted on", () => {
    const workspace = {
      quoteRequests: [request("open", "open", "2026-11-12"), request("won", "selected", "2026-11-10"), request("lost", "closed", "2026-11-09")],
      supplierQuotes: [],
    } as unknown as SupplierWorkspace;
    const board = { items: [readinessItem("open", "2026-12-01"), readinessItem("won", "2026-12-01"), readinessItem("lost", "2026-12-01")] } as unknown as PrismSupplierReadinessBoard;
    const workflow = {
      schedules: [{ id: "s1", eventId: "e1", requestId: "won", ingressAt: "2026-11-30T22:00:00.000Z", egressAt: "2026-12-01T10:00:00.000Z", location: "Hall A", status: "scheduled" }],
      creativeTasks: [
        { id: "t1", eventId: "e1", requestId: "won", title: "Slides", dueAt: "2026-11-20T02:00:00.000Z", status: "open" },
        { id: "t2", eventId: "e1", requestId: "won", title: "Done", dueAt: "2026-11-21T02:00:00.000Z", status: "accepted" },
      ],
      payables: [
        { id: "p1", eventId: "e1", label: "Deposit", dueDate: "2026-11-25", status: "scheduled", remainingBalance: 1000 },
        { id: "p2", eventId: "e1", label: "Paid", dueDate: "2026-11-26", status: "released", remainingBalance: 0 },
      ],
      contracts: [],
    } as unknown as PrismSupplierWorkflowWorkspace;

    const items = buildSupplierCalendarItems(workspace, board, workflow);

    expect(items.map((item) => [item.kind, item.date])).toEqual([
      ["deadline", "2026-11-12"],
      ["deliverable", "2026-11-20"],
      ["payment", "2026-11-25"],
      // 22:00 UTC is the next morning in Manila, so arrival falls on the event day.
      ["event", "2026-12-01"],
      ["arrival", "2026-12-01"],
      ["departure", "2026-12-01"],
    ]);
    // Timed items carry their Manila wall-clock time so the day and week views can place them.
    expect(items.filter((item) => item.startTime).map((item) => [item.kind, item.startTime])).toEqual([
      ["deliverable", "10:00"],
      ["arrival", "06:00"],
      ["departure", "18:00"],
    ]);
    // Month-cell labels name the event, so a chip reads on its own without opening it.
    expect(items.map((item) => [item.kind, item.chipLabel])).toEqual([
      ["deadline", "Gala"],
      ["deliverable", "Slides"],
      ["payment", "Deposit"],
      ["event", "Gala"],
      ["arrival", "Arrive · Gala"],
      ["departure", "Leave · Gala"],
    ]);
    expect(items.find((item) => item.kind === "event")?.href).toBe("/dashboard/bookings#supplier-work-won");
    expect(items.find((item) => item.kind === "deadline")?.href).toBe("/dashboard/requests#supplier-work-open");
    expect(items.find((item) => item.kind === "payment")?.href).toBe("/dashboard/payments");
  });

  it("shows a confidential bid's event day under its masked name", () => {
    const workspace = { quoteRequests: [request("open", "open", "2026-11-12")], supplierQuotes: [] } as unknown as SupplierWorkspace;
    const board = { items: [{ ...readinessItem("open", "2026-12-01"), eventName: "Confidential event" }] } as unknown as PrismSupplierReadinessBoard;
    expect(buildSupplierCalendarItems(workspace, board, null).find((item) => item.kind === "event")).toMatchObject({ date: "2026-12-01", title: "Confidential event" });
  });
});
