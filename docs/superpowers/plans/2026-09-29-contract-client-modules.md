# Shared Contract and API Client Modules Implementation Plan

> **For agentic workers:** Execute inline in small steps; preserve the existing public package entrypoints throughout.

**Goal:** Split the shared event-ops contracts and transport implementation into capability modules while preserving current imports and request behavior.

**Architecture:** Keep `packages/types/src/event-ops.ts` and `packages/api-client/src/event-ops-client.ts` as stable composition points. Move declarations and endpoint groups behind those entrypoints, with type-only dependencies between contract modules and a small shared HTTP helper seam for API-client factories.

**Tech Stack:** TypeScript, npm workspaces, Vitest.

**Spec:** docs/superpowers/specs/2026-09-29-contract-client-module-boundaries-design.md

## Global Constraints

- All shared write schemas remain in `@prism/types`; do not add parallel DTOs.
- Preserve public root imports, request paths, request bodies, auth behavior, and error mapping.
- Keep `@prism/api-client` as transport code; apps continue importing it from feature data adapters.
- Update CHANGELOG.md and rebuild `@prism/types` before dependent typechecks.

---

### Task 1: Split the shared contract implementation

**Files:**
- Create: `packages/types/src/event-ops/{core,lifecycle,commercial,operations,compliance-billing,trust,read-models,commands,pare}.ts`
- Modify: `packages/types/src/event-ops.ts`
- Verify: `packages/types/src/event-ops.test.ts`

**Interfaces:**
- Consumes: the current declarations in `event-ops.ts`.
- Produces: unchanged exported names through `event-ops.ts`, with foundations in `core.ts`, domain read contracts in capability files, composed workspaces in `read-models.ts`, and PARE contracts in `pare.ts`.

- [x] **Step 1: Record declaration ownership before moving code**

Use the TypeScript parser to list top-level declaration names and their source lines. Assign lines 1–172 to core; 173–372 to lifecycle; 373–552 to commercial; 554–980 to operations; 981–1235 to compliance/billing; 1237–1379 to trust; 1381–1558 to read models; 1560–1750 to commands; and 1754–1804 to PARE. Keep comments with their declarations.

- [x] **Step 2: Move declarations without rewriting their bodies**

Create the nine capability files under `packages/types/src/event-ops/`. Preserve declarations exactly and add only the explicit local type imports required between modules. Keep the existing `event-ops.ts` path as a barrel with one export-star per capability file.

- [x] **Step 3: Verify package consumers still resolve the same exports**

Run: `npm --workspace @prism/types run build`, then `npm --workspace @prism/types run test`.
Expected: PASS, including the existing root-import contract and lifecycle tests.

### Task 2: Split API-client endpoint groups behind the current factory

**Files:**
- Create: `packages/api-client/src/event-ops-client/{contracts,shared,auth,sample,inquiries,events,workspaces,guest,live-ops,supplier-applications,communication}.ts`
- Create: `packages/api-client/src/event-ops-client/contracts/{primitives,auth,sample,inquiries,events,workspaces,guest,live-ops,supplier-applications,communication}.ts`
- Modify: `packages/api-client/src/event-ops-client.ts`
- Verify: `packages/api-client/src/event-ops-client.test.ts`

**Interfaces:**
- Consumes: `EventOpsClientOptions`, `EventOpsClient`, `prismRequest`, `withBase`, and `actorPath`.
- Produces: the same `createEventOpsClient(options): EventOpsClient` function composed from factories for auth/sample, inquiry/conforme, events, workspaces, guest, live ops/coordinator, supplier applications, and communication.

- [x] **Step 1: Extract public client types and private request helpers**

Move `EventOpsActorQuery` and `EventOpsClientOptions` to `contracts/primitives.ts`. Move each `EventOpsClient` property signature into a matching capability interface; let `contracts.ts` compose those interfaces into the unchanged public `EventOpsClient` type and retain the existing write-type re-exports. Move `withBase`, `actorPath`, and the stream-event parser to `shared.ts`. Preserve signatures and behavior. Keep `createEventOpsClient` in `event-ops-client.ts` as the composition root and re-export unchanged contracts from there.

- [x] **Step 2: Extract each endpoint property group**

Move each current factory property body intact to its named module. Keep sample compatibility separate from auth; keep supplier applications separate from event communication. Each builder accepts the same `EventOpsClientOptions` and returns a `Pick<EventOpsClient, ...>` for its own properties. Import only the package types and helpers that group uses.

- [x] **Step 3: Keep the factory as a composition point**

Change `createEventOpsClient` to return a spread of the endpoint builders in the existing property order. Re-export the same function and type names through `packages/api-client/src/index.ts`.

- [x] **Step 4: Verify observable transport behavior**

Run: `npm --workspace @prism/api-client run test`, then `npm --workspace @prism/api-client run typecheck`.
Expected: PASS; existing tests continue to assert real request URL, method, body, auth headers, and error mapping.

### Task 3: Verify integration and document the delivered split

**Files:**
- Modify: `CHANGELOG.md`
- Verify: `packages/types/src/index.ts`
- Verify: `packages/api-client/src/index.ts`

**Interfaces:**
- Consumes: stable package-root exports.
- Produces: verified workspace builds and no caller migration requirement.

- [x] **Step 1: Rebuild shared types and dependent packages**

Run: `npm --workspace @prism/types run build`, `npm --workspace @prism/api-client run build`, and typecheck the client and event apps.
Expected: PASS without consumer import changes.

- [x] **Step 2: Run repository boundary and whitespace checks**

Run: `npm run check:boundaries` and `git diff --check`.
Expected: the new modules remain inside their package and all existing boundary rules pass.

- [x] **Step 3: Record the structural delivery and commit**

Add one changelog bullet that the shared contracts and API-client implementation are organized by capability behind stable package-root exports. Commit with `refactor(packages): split event ops contracts and transport`.

## Self-review

- Spec coverage: both large files are split, public exports stay stable, schemas remain canonical, and endpoint behavior is covered by existing request tests.
- No generated DTOs, app facades, new external packages, or caller migrations are included.
- Package build order explicitly rebuilds types before dependent consumers.

