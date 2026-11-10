/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { PrismGuestRosterEntry } from "@prism/types";
import { useRosterImportViewModel } from "./use-roster-import-view-model";

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock("@prism/ui/components/sonner", () => ({ toast: { success: toastSuccess } }));

const validJson = JSON.stringify({ source: "Sheet", rows: [{ sourceKey: "k1", guestName: "Ana Reyes" }] });

beforeEach(() => toastSuccess.mockReset());

describe("useRosterImportViewModel outcomes", () => {
  it("confirms a finished import with a toast and leaves no inline error", async () => {
    const onImport = vi.fn(async () => [{ id: "g1" }] as PrismGuestRosterEntry[]);
    const onImported = vi.fn();
    const { result } = renderHook(() => useRosterImportViewModel(onImport, onImported));

    act(() => result.current.setJson(validJson));
    await act(() => result.current.importJson());

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImported).toHaveBeenCalledWith([{ id: "g1" }]);
    expect(toastSuccess).toHaveBeenCalledWith("Imported 1 roster rows from Sheet.");
    expect(result.current.error).toBeNull();
    expect(result.current.json).toBe("");
  });

  it("keeps a failed import inline with the pasted data, and does not announce success", async () => {
    const onImport = vi.fn(async () => { throw new Error("Roster is locked."); });
    const { result } = renderHook(() => useRosterImportViewModel(onImport, vi.fn()));

    act(() => result.current.setJson(validJson));
    await act(() => result.current.importJson());

    expect(result.current.error).toBe("Roster is locked.");
    expect(result.current.json).toBe(validJson);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("reports unreadable JSON inline without calling the API", async () => {
    const onImport = vi.fn();
    const { result } = renderHook(() => useRosterImportViewModel(onImport, vi.fn()));

    act(() => result.current.setJson("{ not json"));
    await act(() => result.current.importJson());

    expect(result.current.error).toBeTruthy();
    expect(onImport).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
