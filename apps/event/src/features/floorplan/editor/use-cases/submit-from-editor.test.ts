import { describe, expect, it, vi } from "vitest";
import { submitFromEditor } from "./submit-from-editor";

describe("submitFromEditor", () => {
  it("saves the layout, submits the draft, refreshes the event's drafts as well as the dashboard, then closes", async () => {
    const calls: string[] = [];
    const step = (name: string) => vi.fn(async () => void calls.push(name));

    await submitFromEditor({
      save: step("save"),
      submit: step("submit"),
      refreshDashboard: step("refresh dashboard"),
      refreshEventDrafts: step("refresh event drafts"),
      close: () => calls.push("close"),
    });

    expect(calls.slice(0, 2)).toEqual(["save", "submit"]);
    expect(calls).toContain("refresh event drafts");
    expect(calls).toContain("refresh dashboard");
    expect(calls.at(-1)).toBe("close");
  });

  it("does not submit a layout whose save failed, and leaves the editor open", async () => {
    const submit = vi.fn();
    const close = vi.fn();

    await expect(
      submitFromEditor({ save: vi.fn().mockRejectedValue(new Error("409")), submit, refreshDashboard: vi.fn(), refreshEventDrafts: vi.fn(), close }),
    ).rejects.toThrow("409");
    expect(submit).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
