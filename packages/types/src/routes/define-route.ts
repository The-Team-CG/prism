import type { z } from "zod";
import type { PrismRole } from "../index.js";

/**
 * One HTTP route, written once. The API mounts its handler from this object and the API client calls it from the same
 * object, so the method, the path, the input schemas and the response shape cannot drift apart. See ADR-0011.
 */
export type PrismRouteMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface PrismRoute {
  readonly method: PrismRouteMethod;
  /** The full path after the API prefix, without a leading slash: `payment-receipts/:receiptId/verify`. */
  readonly path: string;
  /** The role apps whose API client includes this route. The API still checks the caller's role on every request. */
  readonly roles: readonly PrismRole[];
  readonly query?: z.ZodType;
  readonly body?: z.ZodType;
  /** What the route returns. The API client parses every response with it. */
  readonly response: z.ZodType;
  /** The success status. Defaults to 200, including for POST. */
  readonly status?: 200 | 201 | 204;
}

/** Keeps the literal types of a route (its path, roles and schemas) so callers and handlers are checked against it. */
export function defineRoute<const R extends PrismRoute>(route: R): R {
  return route;
}

type PathSegments<P extends string> = P extends `${infer Head}/${infer Rest}` ? Head | PathSegments<Rest> : P;
type ParamName<S> = S extends `:${infer Name}` ? Name : never;

/** `{ receiptId: string }` for `payment-receipts/:receiptId/verify`; `{}` for a path without parameters. */
export type PrismRouteParams<R extends PrismRoute> = { [K in ParamName<PathSegments<R["path"]>>]: string };

export type PrismRouteParamName<R extends PrismRoute> = ParamName<PathSegments<R["path"]>>;

/** The body a caller sends, before the API's schema trims or defaults it. */
export type PrismRouteBody<R extends PrismRoute> = R["body"] extends z.ZodType ? z.input<R["body"]> : never;

/** The query a screen builds, in its parsed shape; the client serializes it. */
export type PrismRouteQuery<R extends PrismRoute> = R["query"] extends z.ZodType ? z.output<R["query"]> : never;

/** What the route returns, as the client receives it after parsing. */
export type PrismRouteResponse<R extends PrismRoute> = z.output<R["response"]>;

type ParamsInput<R extends PrismRoute> = [PrismRouteParamName<R>] extends [never] ? object : { params: PrismRouteParams<R> };
type QueryInput<R extends PrismRoute> = R["query"] extends z.ZodType ? { query: PrismRouteQuery<R> } : object;
type BodyInput<R extends PrismRoute> = R["body"] extends z.ZodType ? { body: PrismRouteBody<R> } : object;

/** Everything a call needs: `{ params, query, body }`, each present only when the route has it. */
export type PrismRouteInput<R extends PrismRoute> = ParamsInput<R> & QueryInput<R> & BodyInput<R>;

/** Fills a route's path parameters: `payment-receipts/prc%201/verify`. Values are URL-encoded. */
export function prismRoutePath(route: PrismRoute, params: Record<string, string> = {}): string {
  return route.path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined || value === "") throw new Error(`Route ${route.method} ${route.path} needs the "${name}" parameter`);
    return encodeURIComponent(value);
  });
}
