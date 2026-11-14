/** @vitest-environment jsdom */
import { StrictMode, createElement, type ReactNode } from "react";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PRISM_SESSION_STORAGE_KEYS } from "@prism/types";
import { useClientFilesLastSeen } from "./use-client-files-last-seen";

const KEY = PRISM_SESSION_STORAGE_KEYS.clientFilesLastSeen;

const strict = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children);

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("client files last visit", () => {
  it("reports the previous visit (not the one just recorded) even when effects run twice, and nothing on a first visit", async () => {
    const first = renderHook(() => useClientFilesLastSeen("client-1", "event-a"), { wrapper: strict });
    await waitFor(() => expect(localStorage.length).toBe(1));
    expect(first.result.current).toBeNull();
    first.unmount();

    const recorded = JSON.parse(localStorage.getItem(KEY)!)["client-1:event-a"];
    const second = renderHook(() => useClientFilesLastSeen("client-1", "event-a"), { wrapper: strict });
    await waitFor(() => expect(second.result.current).toBe(recorded));
  });

  it("keeps each signed-in client's visits apart", async () => {
    localStorage.setItem(KEY, JSON.stringify({ "client-1:event-a": "2026-11-01T00:00:00.000Z" }));
    const other = renderHook(() => useClientFilesLastSeen("client-2", "event-a"));
    await waitFor(() => expect(Object.keys(JSON.parse(localStorage.getItem(KEY)!))).toHaveLength(2));
    expect(other.result.current).toBeNull();
  });
});
