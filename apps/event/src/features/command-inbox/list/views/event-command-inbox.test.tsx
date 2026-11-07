/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { PrismPmcmCommandInbox } from "@prism/types";
import { EventCommandInbox } from "./event-command-inbox";

const EMPTY_INBOX: PrismPmcmCommandInbox = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: { activeEvents: 0, pendingInquiries: 0, pendingApprovals: 0 },
  page: { index: 0, size: 10, hasMore: false },
  counts: { critical: 0, warning: 0, attention: 0, info: 0 },
  items: [],
};

describe("EventCommandInbox — render states", () => {
  it("shows the loading panel while inbox is null and load has not failed", () => {
    render(<EventCommandInbox inbox={null} onRefresh={() => {}} onPageChange={() => {}} loadFailed={false} />);
    expect(screen.getByText("Loading command inbox...")).toBeTruthy();
    expect(screen.queryByText("No pending actions")).toBeNull();
    expect(screen.queryByText("Could not load inbox")).toBeNull();
  });

  it("shows the error panel when load has failed", () => {
    render(<EventCommandInbox inbox={null} onRefresh={() => {}} onPageChange={() => {}} loadFailed={true} />);
    expect(screen.getByText("Could not load inbox")).toBeTruthy();
    expect(screen.queryByText("Loading command inbox...")).toBeNull();
  });

  it("shows the true empty-state panel once inbox has loaded with no items", () => {
    render(<EventCommandInbox inbox={EMPTY_INBOX} onRefresh={() => {}} onPageChange={() => {}} loadFailed={false} />);
    expect(screen.getByText("No pending actions")).toBeTruthy();
    expect(screen.queryByText("Loading command inbox...")).toBeNull();
  });

  it("renders addendum inbox actions with their owning area and review label", () => {
    const item = {
      id: "addendum-1", kind: "addendum" as const, severity: "attention" as const,
      label: "Client addendum awaiting countersignature", eventName: "Gala",
      description: "", status: "pending", createdAt: "2026-01-01T00:00:00.000Z", href: "/events/event-1/addenda/addendum-1",
    };

    render(
      <EventCommandInbox
        inbox={{ ...EMPTY_INBOX, items: [item] }}
        onRefresh={() => {}}
        onPageChange={() => {}}
        loadFailed={false}
      />,
    );

    expect(screen.getByRole("link", { name: item.label }).getAttribute("href")).toBe(item.href);
    expect(screen.getByText("Addenda · Gala")).toBeTruthy();
    expect(screen.getByText("Review addendum")).toBeTruthy();
  });

  it("moves only to available inbox pages", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <EventCommandInbox inbox={{ ...EMPTY_INBOX, page: { index: 0, size: 10, hasMore: true } }} onRefresh={() => {}} onPageChange={onPageChange} loadFailed={false} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    rerender(
      <EventCommandInbox inbox={{ ...EMPTY_INBOX, page: { index: 100, size: 10, hasMore: false } }} onRefresh={() => {}} onPageChange={onPageChange} loadFailed={false} />,
    );
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenCalledWith(99);
  });

  it("triages loaded rows: urgent blockers lead, reference updates stay collapsed, and counts say they cover this page", () => {
    const base = { description: "", status: "pending", createdAt: "2026-01-01T00:00:00.000Z" };
    render(
      <EventCommandInbox
        inbox={{
          ...EMPTY_INBOX,
          page: { index: 0, size: 4, hasMore: true },
          counts: { critical: 1, warning: 1, attention: 1, info: 1 },
          items: [
            { ...base, id: "u1", kind: "billing", severity: "critical", label: "Payment overdue", eventName: "Gala", dueAt: "2026-01-02T01:00:00.000Z", href: "/billing" },
            { ...base, id: "w1", kind: "coordinator", severity: "warning", label: "Assignment needs confirmation", eventName: "Gala", href: "/staff" },
            { ...base, id: "a1", kind: "inquiry", severity: "attention", label: "Review new inquiry" },
            { ...base, id: "i1", kind: "floorplan", severity: "info", label: "Prepare official floorplan", href: "/floor" },
          ],
        }}
        onRefresh={() => {}}
        onPageChange={() => {}}
        loadFailed={false}
      />,
    );

    // More pages exist, so the counts must not read as inbox totals.
    const counts = screen.getByTestId("command-inbox-counts").textContent ?? "";
    expect(counts).toContain("Urgent on this page1");
    expect(counts).toContain("Need action on this page2");
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Urgent blockers1", "Needs action2"]);
    expect(screen.getAllByText("Blocker")).toHaveLength(1);
    // Each row's title is its link, so the whole row opens the item.
    expect(screen.getByRole("link", { name: "Payment overdue" }).getAttribute("href")).toBe("/billing");
    const reference = screen.getByText("Prepare official floorplan").closest("details");
    expect(reference).toBeTruthy();
    expect(reference?.open).toBe(false);
  });

  it("collapses repeated items of the same kind into one expandable row", () => {
    const overdue = (id: string, eventName: string) => ({
      id, kind: "billing" as const, severity: "critical" as const, label: "Payment milestone overdue", eventName,
      description: "", status: "pending", createdAt: "2026-01-01T00:00:00.000Z", href: `/billing/${id}`,
    });
    render(
      <EventCommandInbox
        inbox={{ ...EMPTY_INBOX, counts: { critical: 3, warning: 0, attention: 0, info: 0 }, items: [overdue("b1", "Gala"), overdue("b2", "Gala"), overdue("b3", "Summit")] }}
        onRefresh={() => {}}
        onPageChange={() => {}}
        loadFailed={false}
      />,
    );
    expect(screen.getByTestId("command-inbox-cluster").textContent).toContain("3 × Payment milestone overdue");
    expect(screen.getByTestId("command-inbox-cluster").textContent).toContain("across 2 events");
    // Each item stays reachable inside the group.
    expect(screen.getAllByRole("link", { name: "Payment milestone overdue" })).toHaveLength(3);
  });
});
