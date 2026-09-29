/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
