/** @vitest-environment jsdom */
import { StrictMode, useEffect, type ReactNode } from "react";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortalQueryProvider, defineResource, useFetchResource, useInvalidate, usePrefetch, useRefreshWhenChanged, useResource } from "./portal-query";

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

  it("lets a loader that keeps its own state reuse a prefetched answer, and ask again when told to", async () => {
    const { fetch, resource, wrapper } = setup();
    const { result } = renderHook(() => ({ prefetch: usePrefetch(), load: useFetchResource() }), { wrapper });
    act(() => result.current.prefetch(resource, "evt_3"));
    // The loader joins the request the prefetch started instead of making a second one.
    await expect(result.current.load(resource, "evt_3")).resolves.toMatchObject({ eventId: "evt_3" });
    expect(fetch).toHaveBeenCalledTimes(1);
    // After a command the loader asks the API again.
    await expect(result.current.load(resource, "evt_3", { fresh: true })).resolves.toMatchObject({ loadedAt: 2 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("reads again when the page's records change, including across a remount, but not on a first mount after a prefetch", async () => {
    const { fetch, resource, wrapper } = setup();
    function Statement({ signature }: { signature: string }) {
      useRefreshWhenChanged(resource, "evt_4", signature);
      const state = useResource(resource, "evt_4");
      return <p>{state.status === "ready" ? `read ${state.data.loadedAt}` : state.status}</p>;
    }
    function Page({ open, signature }: { open: boolean; signature: string }) {
      const prefetch = usePrefetch();
      // The route starts the read once, as the shell does.
      useEffect(() => prefetch(resource, "evt_4"), [prefetch]);
      return open ? <Statement signature={signature} /> : <p>closed</p>;
    }
    const view = render(<Page open signature="stmt_1" />, { wrapper });
    await waitFor(() => expect(screen.getByText("read 1")).toBeTruthy());
    // The first mount uses the prefetched read; it does not ask again.
    expect(fetch).toHaveBeenCalledTimes(1);

    // The screen closes, a statement is sent elsewhere, and the screen opens again: it reads again.
    view.rerender(<Page open={false} signature="stmt_1" />);
    view.rerender(<Page open signature="stmt_1|sent" />);
    await waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.getByText(/^read [2-9]/)).toBeTruthy());
    const afterChange = fetch.mock.calls.length;
    // Reopening with nothing changed does not.
    view.rerender(<Page open={false} signature="stmt_1|sent" />);
    view.rerender(<Page open signature="stmt_1|sent" />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetch).toHaveBeenCalledTimes(afterChange);
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
