/** @vitest-environment jsdom */
import { StrictMode, type ReactNode } from "react";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortalQueryProvider, defineResource, useInvalidate, usePrefetch, useResource } from "./portal-query";

afterEach(cleanup);

function setup(actorKey: string | null = "user_1") {
  const fetch = vi.fn(async (eventId: string) => ({ eventId, loadedAt: fetch.mock.calls.length }));
  const resource = defineResource({ name: "test.event", fetch });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode><PortalQueryProvider actorKey={actorKey}>{children}</PortalQueryProvider></StrictMode>
  );
  return { fetch, resource, wrapper };
}

describe("portal query", () => {
  it("serves several readers, under development double effects, from one request", async () => {
    const { fetch, resource, wrapper } = setup();
    function Panel({ label }: { label: string }) {
      const state = useResource(resource, "evt_1");
      return <p>{label}:{state.status === "ready" ? state.data.eventId : state.status}</p>;
    }
    render(<><Panel label="a" /><Panel label="b" /></>, { wrapper });
    await waitFor(() => expect(screen.getByText("b:evt_1")).toBeTruthy());
    expect(screen.getByText("a:evt_1")).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("starts a prefetched read before its reader mounts, and waits while params are null", async () => {
    const { fetch, resource, wrapper } = setup();
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => ({ prefetch: usePrefetch(), state: useResource(resource, id) }), {
      wrapper,
      initialProps: { id: null as string | null },
    });
    expect(result.current.state.status).toBe("pending");
    expect(fetch).not.toHaveBeenCalled();
    act(() => result.current.prefetch(resource, "evt_2"));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    rerender({ id: "evt_2" });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refetches mounted readers after invalidation", async () => {
    const { fetch, resource, wrapper } = setup();
    const { result } = renderHook(() => ({ invalidate: useInvalidate(), state: useResource(resource, "evt_1") }), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await act(() => result.current.invalidate(resource, "evt_1"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("drops cached data when the signed-in actor changes", async () => {
    const fetch = vi.fn(async () => "data");
    const resource = defineResource({ name: "test.actor", fetch });
    function Reader() {
      const state = useResource(resource, "x");
      return <p>{state.status}</p>;
    }
    const { rerender } = render(<PortalQueryProvider actorKey="user_1"><Reader /></PortalQueryProvider>);
    await waitFor(() => expect(screen.getByText("ready")).toBeTruthy());
    rerender(<PortalQueryProvider actorKey="user_2"><Reader /></PortalQueryProvider>);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it("retains a loaded read through initial actor resolution, then clears it on sign-out", async () => {
    const fetch = vi.fn(async () => "cached data");
    const resource = defineResource({ name: "test.hydration", fetch });
    function Reader() {
      const state = useResource(resource, "x");
      return <p>{state.status === "ready" ? state.data : state.status}</p>;
    }
    const { rerender } = render(<PortalQueryProvider actorKey={null}><Reader /></PortalQueryProvider>);
    await waitFor(() => expect(screen.getByText("cached data")).toBeTruthy());

    rerender(<PortalQueryProvider actorKey="user_1"><Reader /></PortalQueryProvider>);
    rerender(<PortalQueryProvider actorKey="user_1">Navigating</PortalQueryProvider>);
    rerender(<PortalQueryProvider actorKey="user_1"><Reader /></PortalQueryProvider>);
    await waitFor(() => expect(screen.getByText("cached data")).toBeTruthy());
    expect(fetch).toHaveBeenCalledTimes(1);

    rerender(<PortalQueryProvider actorKey={null}><Reader /></PortalQueryProvider>);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});
