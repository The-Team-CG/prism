import {
  paymentReceiptRoutes,
  prismRoutePath,
  type PrismRole,
  type PrismRoute,
  type PrismRouteInput,
  type PrismRouteResponse,
} from "@prism/types";
import { prismRequest, toQueryString } from "./http";
import { withBase } from "./event-ops-client/shared";
import type { EventOpsClientOptions } from "./event-ops-client/contracts";

/**
 * Role clients built from the shared route contracts (ADR-0011). A role app gets only the routes whose contract lists
 * its role, so calling another role's route is a compile error rather than a 403 at runtime. Every response is parsed
 * with the contract's response schema.
 */

/** The API answered with a body the route's contract does not describe. */
export class PrismContractError extends Error {
  readonly route: string;
  readonly issues: readonly { path: PropertyKey[]; message: string }[];

  constructor(route: PrismRoute, issues: readonly { path: PropertyKey[]; message: string }[]) {
    super(`The API's answer to ${route.method} /${route.path} does not match its contract`);
    this.name = "PrismContractError";
    this.route = `${route.method} /${route.path}`;
    this.issues = issues;
  }
}

export interface PrismRouteCallInit {
  signal?: AbortSignal;
}

type RouteArgs<R extends PrismRoute> = keyof PrismRouteInput<R> extends never
  ? [input?: PrismRouteInput<R>, init?: PrismRouteCallInit]
  : [input: PrismRouteInput<R>, init?: PrismRouteCallInit];

/** Calls one route: fills the path, serializes the query, sends the body and parses the answer. */
export async function callRoute<R extends PrismRoute>(
  route: R,
  options: EventOpsClientOptions,
  ...[input, init = {}]: RouteArgs<R>
): Promise<PrismRouteResponse<R>> {
  const values = (input ?? {}) as { params?: Record<string, string>; query?: object; body?: unknown };
  const path = `/${prismRoutePath(route, values.params)}`;
  const query = route.query && values.query ? toQueryString(values.query as Record<string, string>) : "";
  const raw = await prismRequest<unknown>(query ? `${path}?${query}` : path, withBase(options, {
    ...(route.method === "GET" ? {} : { method: route.method }),
    ...(route.body ? { body: values.body } : {}),
    ...(init.signal ? { signal: init.signal } : {}),
  }));
  const parsed = route.response.safeParse(raw);
  if (!parsed.success) throw new PrismContractError(route, parsed.error.issues);
  return parsed.data as PrismRouteResponse<R>;
}

type RouteGroup = Record<string, PrismRoute>;

type RoleRoutes<G extends RouteGroup, Role extends PrismRole> = {
  [K in keyof G as Role extends G[K]["roles"][number] ? K : never]: (...args: RouteArgs<G[K]>) => Promise<PrismRouteResponse<G[K]>>;
};

/** One route group as a role sees it: a function per route the role may call, and nothing else. */
export function bindRoutes<G extends RouteGroup, Role extends PrismRole>(role: Role, group: G, options: EventOpsClientOptions): RoleRoutes<G, Role> {
  const bound: Record<string, unknown> = {};
  for (const [name, route] of Object.entries(group)) {
    if (!route.roles.includes(role)) continue;
    bound[name] = (...args: RouteArgs<typeof route>) => callRoute(route, options, ...args);
  }
  return bound as RoleRoutes<G, Role>;
}

/**
 * PMCM's client. More route groups join it as their contexts move to shared contracts; until then PMCM screens use
 * `createEventOpsClient` for everything else.
 */
export function createPmcmClient(options: EventOpsClientOptions = {}) {
  return {
    paymentReceipts: bindRoutes("pmcm", paymentReceiptRoutes, options),
  };
}

export type PrismPmcmClient = ReturnType<typeof createPmcmClient>;
