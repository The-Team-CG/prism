/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLiveOperationsWorkspaceViewModel } from "./use-live-operations-workspace-view-model";

function render(onCreateIssue: () => Promise<boolean | void>) {
  return renderHook(() => useLiveOperationsWorkspaceViewModel({
    liveOps: null, busy: false, onCreateIssue,
    onCreateTask: vi.fn(async () => true), onBlockTask: vi.fn(async () => true), onUnblockTask: vi.fn(async () => undefined),
  }));
}

describe("live operations workspace forms", () => {
  afterEach(() => cleanup());

  it("keeps what was typed in an urgent issue when the save fails, and clears it once the save goes through", async () => {
    const onCreateIssue = vi.fn<() => Promise<boolean | void>>().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = render(onCreateIssue);
    act(() => {
      result.current.toggleIssueForm();
      result.current.setIssueTitle("Generator down at the stage");
      result.current.setIssueDescription("No power to the LED wall");
    });

    await act(async () => { await result.current.createIssue(); });
    expect(result.current).toMatchObject({ issueTitle: "Generator down at the stage", issueFormOpen: true });

    await act(async () => { await result.current.createIssue(); });
    expect(result.current).toMatchObject({ issueTitle: "", issueFormOpen: false });
  });
});
