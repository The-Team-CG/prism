/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismCoordinatorRoleView } from "@prism/types";
import { PageStatusLine } from "./coordinator-on-site";

afterEach(cleanup);

const roleView = { tasks: [], urgentIssues: [] } as unknown as PrismCoordinatorRoleView;

describe("page status line", () => {
  it("shows the page's counts with when it was updated, a refresh and the page's action", () => {
    const onRefresh = vi.fn();
    const onLog = vi.fn();
    render(<PageStatusLine roleView={roleView} loading={false} onRefresh={onRefresh} summary="3 open · 1 blocked" action={<button type="button" onClick={onLog}>Log a task</button>} />);

    expect(screen.getByText("3 open · 1 blocked")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Updated just now");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Log a task" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onLog).toHaveBeenCalledTimes(1);
  });

  it("says only when it was updated on a page without counts, and nothing before the data loads", () => {
    const { rerender } = render(<PageStatusLine roleView={roleView} loading={false} onRefresh={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("Updated just now");

    rerender(<PageStatusLine roleView={null} loading onRefresh={vi.fn()} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
