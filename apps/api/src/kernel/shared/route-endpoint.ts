import { applyDecorators, Body, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import type { PrismRoute, PrismRouteParamName, PrismRouteResponse } from '@prism/types';
import { zodBody, zodQuery } from './zod-validation.pipe';

const METHOD = { GET: Get, POST: Post, PUT: Put, PATCH: Patch, DELETE: Delete } as const;

type Handler<R extends PrismRoute> = (...args: never[]) => Promise<PrismRouteResponse<R>> | PrismRouteResponse<R>;

/**
 * Mounts a handler at a shared route contract (ADR-0011): the HTTP method, the full path and the success status come
 * from the contract, and the handler must return the contract's response type. Use it in a controller declared with
 * `@Controller()` and no prefix, so the contract's path is the whole path.
 */
export function Endpoint<R extends PrismRoute>(route: R) {
  const decorate = applyDecorators(METHOD[route.method](route.path), HttpCode(route.status ?? 200));
  return <T extends Handler<R>>(target: object, key: string | symbol, descriptor: TypedPropertyDescriptor<T>) => {
    decorate(target, key, descriptor);
  };
}

/** The request body, validated by the contract's body schema. */
export function RouteBody(route: PrismRoute & { body: NonNullable<PrismRoute['body']> }): ParameterDecorator {
  return Body(zodBody(route.body));
}

/** The query string, validated by the contract's query schema. */
export function RouteQuery(route: PrismRoute & { query: NonNullable<PrismRoute['query']> }): ParameterDecorator {
  return Query(zodQuery(route.query));
}

/** A path parameter; the name must appear in the contract's path. */
export function RouteParam<R extends PrismRoute>(_route: R, name: PrismRouteParamName<R>): ParameterDecorator {
  return Param(name);
}
