/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortalQueryProvider, defineResource, useResource } from "@prism/portal-query";
import { useRereadOnChange } from "./use-reread-on-change";

describe("useRereadOnChange", () => {
  it("does not read again on mount, and reads again each time the page's records change", async () => {
    const fetch = vi.fn(async (eventId: string) => ({ eventId, read: fetch.mock.calls.length }));
    const statement = defineResource({ name: "test.statement", fetch });
    const wrapper = ({ children }: { children: ReactNode }) => <PortalQueryProvider actorKey="user_1">{children}</PortalQueryProvider>;
    const { result, rerender } = renderHook(({ changes }: { changes: string }) => {
      useRereadOnChange(statement, "evt_1", changes);
      return useResource(statement, "evt_1");
    }, { wrapper, initialProps: { changes: "stmt_1|pay_1:pending" } });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetch).toHaveBeenCalledTimes(1);

    rerender({ changes: "stmt_1|pay_1:paid" });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    rerender({ changes: "stmt_1|pay_1:paid" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
