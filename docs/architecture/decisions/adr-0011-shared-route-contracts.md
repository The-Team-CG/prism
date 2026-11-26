---
type: "Decision"
title: "Shared route contracts"
description: "Write each HTTP route once, in @prism/types: the API mounts its handler from the contract, role clients call it from the same contract, and every response is parsed against it."
tags: [architecture, decision, api, contracts, api-client, zod]
status: canonical
updated: "2026-11-27"
authority: normative
audience: [agents, backend-engineers, frontend-engineers, reviewers]
scope: "HTTP route definitions, API handler mounting, the API client, response validation, and route naming"
last_verified: "payment receipt routes: @prism/types, @prism/api-client and API typechecks and tests, the Endpoint compile guard, and the event portal finance tests"
decision_date: "2026-11-27"
sources:
  - id: define-route
    resource: "packages/types/src/routes/define-route.ts"
    title: "defineRoute and the derived input and response types"
  - id: pilot-routes
    resource: "packages/types/src/routes/payment-receipts.ts"
    title: "The payment receipt route group, the first migrated context"
  - id: endpoint
    resource: "apps/api/src/kernel/shared/route-endpoint.ts"
    title: "Endpoint, RouteBody, RouteQuery and RouteParam"
  - id: route-client
    resource: "packages/api-client/src/route-client.ts"
    title: "callRoute, bindRoutes and the role clients"
  - id: shared-contracts
    resource: "docs/architecture/decisions/adr-0002-shared-contracts-and-sample-compatibility.md"
    title: "Shared Zod contracts this record extends"
---
# ADR-0011: Shared route contracts

## At a glance

- **Decision:** each HTTP route is one `defineRoute` object in `packages/types/src/routes/`. It holds the method,
  the full path, the roles whose client includes it, the query and body schemas, the response schema and the success
  status. The API mounts the handler with `@Endpoint(route)`, and the role clients call the same object.
- **Responses are checked:** the client parses every answer with the route's response schema and throws
  `PrismContractError` on a mismatch. The API handler must return the response type, or it does not compile.
- **Role clients:** `createPmcmClient` and later `createClientPortalClient`, `createSupplierClient`,
  `createCoordinatorClient` and `createGuestClient` hold only the routes their role may call. Calling another role's
  route is a compile error. The API still authorizes every request; the client split is a developer guard.
- **Migration:** one bounded context per pull request, starting with payment receipts. Each migrated route's
  hand-written `createEventOpsClient` method is deleted in the same change.
- **Use when:** adding a route, or changing one in a context that has migrated.

**Decision status:** Accepted. Payment receipts are migrated; other contexts still use `createEventOpsClient`.
**Scope:** HTTP routes served by `apps/api` and called through `@prism/api-client`.

## Context

Every route was written twice: once in a Nest decorator and again by hand in `@prism/api-client`, where 486 methods
rebuilt each path from strings. Nothing tied the two together, so a renamed path or a changed body compiled on both
sides and failed at runtime. Responses were cast with `prismRequest<T>` and almost never checked, so an answer that
lost a field rendered as blank instead of failing.

Each portal also received the whole client. The guest portal could call PMCM finance routes and found out only from a
403. ADR-0002 already puts request schemas in `@prism/types`; the repository has no OpenAPI or code generation, and
this decision keeps it that way. The contracts are ordinary TypeScript objects that both sides import.

## Decision

### The contract

```typescript
export const paymentReceiptRoutes = {
  verify: defineRoute({
    method: "POST", path: "payment-receipts/:receiptId/verify", roles: ["pmcm"],
    body: verifyPaymentReceiptSchema, response: paymentReceiptSchema,
  }),
};
```

- `path` is the whole path after the API prefix, with no leading slash. Its `:name` segments become the typed
  `params` of a call.
- `roles` lists the role apps whose client includes the route. It does not replace the API's role checks.
- `status` defaults to 200 for every method; a route that creates something says `status: 201`.
- Route groups live in `packages/types/src/routes/<group>.ts`, one group per owning context or resource.

### Responses

- A migrated route has a Zod response schema. Its read type is `z.infer` of that schema and replaces the hand-written
  interface, which keeps its name as a type alias, so there is one definition.
- Response schemas describe what the API sends: no transforms or defaults. Unknown fields are dropped by parsing, so a
  field a screen needs must be in the schema.
- The API client parses every response. A mismatch throws `PrismContractError` naming the route and the fields.

### The API

- A migrated controller is declared with `@Controller()` and no prefix. Each handler takes `@Endpoint(route)`, which
  applies the method, the path and the status, and requires the handler to return the route's response type.
- `@RouteBody(route)` and `@RouteQuery(route)` validate with the contract's schemas. `@RouteParam(route, "name")`
  accepts only a name that appears in the path.
- Authorization stays in the handler or its service, exactly as before.

### The client

- `callRoute(route, options, input)` fills the path, serializes the query, sends the body and parses the answer.
- `bindRoutes(role, group, options)` returns the group's routes the role may call, as functions taking
  `{ params, query, body }`. Role clients compose the migrated groups.
- Role apps construct their role client in `lib/prism-api` beside `createEventOpsClient`, and feature `data/`
  modules call it, as ADR-0002 and ADR-0005 already require.

### Naming rules for migrated routes

- An action on a resource is `POST <resource>/:id/<verb>` with status 200, such as `.../verify` or `.../approve`.
  `PATCH` updates fields of a resource; `PUT` replaces a whole document.
- A route lives under the path of the role that uses it. PMCM tooling for guests moves under `pmcm/`; `guest/` is for
  the guest portal.
- A route's verb or path is changed only when its context migrates, together with every caller in the same pull
  request.

## Consequences

- A path, method, body or response change is one edit, and both sides fail to compile until they agree.
- A screen sees a contract mismatch at the boundary, with the route and the fields named.
- The client calls take one object: `verify({ params: { receiptId }, body })` instead of positional arguments.
- Until a context migrates, its routes keep the old pattern. Both clients coexist in a role app during migration.
- Once every context has migrated, a CI check will require every route contract to have a caller in some role client
  or a place on an allow-list, and `createEventOpsClient` is deleted.

## Rejected alternatives

- **OpenAPI or Kubb generation:** adds a generator and a build step, and the repository rules exclude code generation.
  Shared objects give the same single definition with plain imports.
- **Keeping the hand-written client and adding response schemas to it:** fixes responses but leaves every path written
  twice.
- **One big client with role checks at runtime:** the guest portal would still compile calls to PMCM routes.

## Verification

```bash
npm --workspace @prism/types run build
npm --workspace @prism/types run typecheck
npm --workspace @prism/api-client run typecheck && npm --workspace @prism/api-client run test
npm --workspace apps/api run typecheck
cd apps/api && npx vitest run src/kernel/shared/route-endpoint.test.ts src/modules/commercial/api/billing
```

`route-endpoint.test.ts` and `route-client.test.ts` hold `@ts-expect-error` guards: a handler returning the wrong
shape, a role calling a route it is not given, and a call missing a path parameter must each fail to compile.
