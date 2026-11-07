"use client";

/**
 * One data cache per portal, shared by every screen. A resource is declared once next to its fetcher in
 * `features/**\/data`; view-models read it with `useResource`, start it early with `usePrefetch`, and refresh
 * it after a command with `useInvalidate`.
 *
 *   // features/client-dashboard/addenda/data/client-addenda-resource.ts
 *   export const clientEventAddenda = defineResource({
 *     name: "client.event-addenda",
 *     fetch: (eventId: string, signal) => clientApi.events.addenda(eventId, { signal }),
 *   });
 *
 *   // view-model
 *   const addenda = useResource(clientEventAddenda, eventId);   // shared, deduped, aborted on unmount
 *   const prefetch = usePrefetch();  prefetch(clientEventAddenda, eventId);   // start before the panel mounts
 *   const invalidate = useInvalidate();  await invalidate(clientEventAddenda, eventId);   // after a command
 *
 * Behind this surface: in-flight dedupe (so React's development double effects and several panels make one
 * request), stale-while-revalidate, abort on unmount, polling only while the tab is visible, and a cache
 * cleared whenever the signed-in actor changes, so one account never sees another's data.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, skipToken, useQuery, useQueryClient } from "@tanstack/react-query";

export type Resource<Params, Data> = {
  readonly name: string;
  readonly staleMs: number;
  readonly pollMs?: number;
  readonly fetch: (params: Params, signal: AbortSignal) => Promise<Data>;
};

export type ResourceState<Data> =
  | { status: "pending"; data: undefined; error: null; refreshing: boolean }
  | { status: "ready"; data: Data; error: null; refreshing: boolean }
  /** `data` keeps the last good value, when there was one, next to the error that replaced it. */
  | { status: "error"; data: Data | undefined; error: Error; refreshing: boolean };

/** Default freshness: data a screen just loaded is reused for 30 s before a background refresh. */
const DEFAULT_STALE_MS = 30_000;

export function defineResource<Params, Data>(definition: {
  name: string;
  fetch: (params: Params, signal: AbortSignal) => Promise<Data>;
  staleMs?: number;
  pollMs?: number;
}): Resource<Params, Data> {
  return { staleMs: DEFAULT_STALE_MS, ...definition };
}

function resourceKey(resource: { name: string }, params?: unknown) {
  return params === undefined ? [resource.name] : [resource.name, params];
}

/** Reads a resource. Pass `null` params to wait (for example until the route's event id is known). */
export function useResource<Params, Data>(resource: Resource<Params, Data>, params: Params | null): ResourceState<Data> {
  const query = useQuery({
    queryKey: resourceKey(resource, params),
    queryFn: params === null ? skipToken : ({ signal }) => resource.fetch(params, signal),
    staleTime: resource.staleMs,
    refetchInterval: resource.pollMs,
  });
  const refreshing = query.isFetching && query.status !== "pending";
  if (query.status === "error") return { status: "error", data: query.data, error: query.error, refreshing };
  if (query.status === "success") return { status: "ready", data: query.data, error: null, refreshing };
  return { status: "pending", data: undefined, error: null, refreshing: false };
}

/** Starts loading a resource before the component that reads it mounts; a no-op when fresh data is cached. */
export function usePrefetch() {
  const client = useQueryClient();
  return useCallback(
    <Params, Data>(resource: Resource<Params, Data>, params: Params) =>
      void client.prefetchQuery({
        queryKey: resourceKey(resource, params),
        queryFn: ({ signal }) => resource.fetch(params, signal),
        staleTime: resource.staleMs,
      }),
    [client],
  );
}

/** Marks a resource stale after a command; mounted readers refetch in parallel and the promise settles after. */
export function useInvalidate() {
  const client = useQueryClient();
  return useCallback(
    <Params, Data>(resource: Resource<Params, Data>, params?: Params) =>
      client.invalidateQueries({ queryKey: resourceKey(resource, params) }),
    [client],
  );
}

/**
 * Provides the portal's cache. `actorKey` identifies the signed-in account (for example the user id, or null
 * when signed out); changing it drops every cached entry.
 */
export function PortalQueryProvider({ actorKey, children }: { actorKey: string | null; children: ReactNode }) {
  // One cache per signed-in actor: switching or signing out gets a new, empty client, and mounted readers refetch.
  // The first resolution of the actor (null -> signed in, as the session is read after hydration) keeps the client,
  // since nothing user-specific can have been cached for nobody.
  const [cache, setCache] = useState(() => ({ actorKey, client: createClient() }));
  if (cache.actorKey !== actorKey) setCache({ actorKey, client: cache.actorKey === null ? cache.client : createClient() });
  useEffect(() => () => cache.client.clear(), [cache.client]);
  return <QueryClientProvider client={cache.client}>{children}</QueryClientProvider>;
}

function createClient() {
  // No automatic retry: a failed read shows its error at once instead of after a hidden delay.
  return new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true, staleTime: DEFAULT_STALE_MS } } });
}
