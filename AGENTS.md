# P.R.I.S.M Agent Instructions

Follow this file first. Deepen only via the canonical bundle in `docs/index.md`
when incomplete or wrong. `CLAUDE.md` is a pointer to this file; this is the
single agent entrypoint.

## Find the task directly

- Accounts/sign-in: `docs/runbooks/portal-accounts.md`.
- Environment identity, seeds, UAT prerequisites: `docs/runbooks/environments-and-fixtures.md`.
- Connections: `db:doctor`; checksums: `db:doctor -- --mode=runtime --migration-history` (API workspace).
- Schema deployment/recovery: `docs/runbooks/database-migrations.md`.
- Branch/worktree workflow: `docs/runbooks/parallel-worktrees.md`.

Start with the task's runbook and referenced implementation. Deepen architecture
only when relevant. Keep account lookup, data preparation, feature delivery, and
branch cleanup within the requested scope; ask before cleanup becomes feature delivery.

## Hard rules

| Do | Don't |
| --- | --- |
| Feature branch + PR; conventional commits (`feat:`, `fix:`, `refactor:`, …) | Push / force-push `main`; amend published commits without ask |
| **Shared contracts: Zod schema + `z.infer` in `@prism/types` only** | Parallel hand types; `as any`; app-local shared schemas; type-only DTOs without schema |
| Own API work in `apps/api/src/modules/<bounded-context>/`; keep cross-cutting concerns in `src/kernel/` | God `event-ops` hub; private cross-context service imports |
| Role app for the actor; thin `app/` routes; logic in `features/` | Rebuild `apps/client` as all-role PMCM shell; cross-import apps |
| Scoped APIs + package contracts for new surfaces | Whole-system demo state or browser-local fixture fallback |
| Session/storage keys only in `@prism/types` | New app-local `prism:*` storage keys |
| Import packages by role (table below); thin `lib/prism-api` | Re-export domain types from app facades; fat god facades for new code |
| State the system goal and affected role/context on redesign or capability work | Assign work to former developer teams |
| Typecheck + focused behavior tests in touched workspaces; `check:boundaries` when imports move | Commit secrets / `.env*` with credentials; casual `db:reset` |
| Update root `CHANGELOG.md` for each delivery with a concise, notable user/developer effect; update `docs/log.md` only for documentation-bundle structure or contract changes | Turn either log into a PR, commit, or test diary |
| Preserve unrelated uncommitted work | Drive-by reverts outside task scope |

Development has one primary maintainer. Describe work by system goal: UX, PMCM operations, external portals, or platform trust. Add collaborator assignments only when someone actually joins the work. Product roles and context ownership remain unchanged.

**No Changesets** in this monorepo.

---

## Product

Internal PMCM event OS (not public multi-tenant SaaS).

```text
inquiry → conforme → briefing/proposal → planning → event day → closure/archive
```

- Portal access / event creation: **accepted inquiry + signed conforme**.
- Public: landing + inquiry only. Dashboards: signed-in.
- **Floorplan:** PMCM owns official plans in `apps/event`; clients submit layout preferences; clients see submitted/approved official layouts read-only. Keep canvas internals when moving ownership.
- Auth now: built-in API auth/RBAC (no external IdP unless a plan says so).

| App | Port | Actors | Owns | Must not |
| --- | ---: | --- | --- | --- |
| `client` | 3001 | public, clients | landing, inquiry, client dashboard, prefs, client-visible status | PMCM command, official floorplan edit, supplier/audit internals |
| `supplier` | 3002 | suppliers | quotes, readiness, contracts meta, event-day status | other bids, PMCM/client private data |
| `guest` | 3003 | guests | access code, pass, check-in, feedback | planning / other portals / PMCM |
| `event` | 3004 | PMCM, coordinators | command inbox, workspace, floorplans, suppliers, billing, compliance, live ops, closure, trust | public marketing as home; supplier/guest self-service ownership |
| `api` | 4000 | all via HTTP | workflows, RBAC, Prisma, audit, notify, AI gov | UI, app session storage ownership, local fixture seeding |

**Visual:** no nav underlines; no eyebrow/outline/uppercase badge pills; no sidebar avatar if top-bar account menu exists.

---

## Layout

```text
apps/api/          Nest modular monolith + Prisma (port 4000)
  apps/api/src/    bootstrap (prefix `api`, ValidationPipe legacy, Prisma filter)
    modules/       bounded contexts (api, application, contracts, domain, infrastructure as needed)
    kernel/        database, shared helpers, session/auth primitives, access control, health
    fixtures/      local seed module + standalone CLI catalogs; never imported by AppModule
  prisma/          schema + migrations
apps/{client,supplier,guest,event}/   Next portals 3001–3004
packages/types       @prism/types     Zod write schemas + domain types + session keys
packages/api-client  @prism/api-client  prismRequest/prismJson, createEventOpsClient, PrismApiError
packages/floorplan-canvas  @prism/floorplan-canvas  shared role-neutral floorplan editor mechanics
packages/ui          shells/brand/public blocks only — no workflows / role data rules
packages/tokens      theme + typography CSS (+ token object)
docs/                OKF product, architecture, runbook, and reference bundle (see docs/index.md)
```

**Bounded-context map (writes):** `event-lifecycle` (`onboarding`, `compliance`, `closure`, `files`), `commercial` (`quotes`, `suppliers`, `billing`), `operations` (`staffing`, `guest`), `floorplan` (`live`, `authoring`), `live-ops`, `identity-access`, and `platform-ops` (`trust`, `notifications`, `ai-governance`).
**Read-only composition:** `read-models`. **Kernel:** `event-core`, `access-control`, `event-session`, `database`, `shared`, `shared-kernel`, and `health`. **Fixture tooling:** `apps/api/src/fixtures`, invoked only by explicit local/UAT CLI commands and never registered as an HTTP module. Full ownership: `docs/architecture/current-architecture.md`.

**FE (new screens):** `page → View → ViewModel → use-case → data → @prism/api-client` (or thin portal adapter). No HTTP/rules in `page.tsx`. Prefer single-screen forms/lists over wizards unless requested.

---

## Monorepo packages (efficient use)

| Package | Owns | Import when | Never |
| --- | --- | --- | --- |
| **`@prism/types`** | Zod **write** schemas + `z.infer` types; domain **read** interfaces; session/storage keys; `parseContract` | Any shared contract, FE model, API body, repository typing | App-local copy of the same shape |
| **`@prism/api-client`** | HTTP transport + `createEventOpsClient` | **`features/**/data/*` only** (and thin `lib/prism-api` adapters) | Views, pages, view-models calling HTTP |
| **`@prism/floorplan-canvas`** | Shared canvas editor mechanics, panels, and editor-only types | Floorplan editor role wrappers | Portal APIs, session/auth, workflow ownership, persistence, role decisions |
| **`@prism/ui`** | Shells, brand, public marketing blocks, shared empty/status chrome | Cross-portal chrome | Role workflows, business rules |
| **`@prism/tokens`** | `theme.css`, `typography.css`, `prismTokens` | Portal global CSS / design tokens | Per-app one-off color systems for shared brand |

**Default import map**

```text
Domain type / Zod schema / session key  →  @prism/types
Parse untrusted form/API body           →  parseContract / schema.safeParse (@prism/types)
HTTP                                    →  @prism/api-client in data/
Shell / brand / public blocks           →  @prism/ui  (prefer subpaths: @prism/ui/dashboard-shell)
Floorplan editor mechanics              →  @prism/floorplan-canvas from role wrappers; role apps own storage and read-only policy
Global CSS                              →  @prism/tokens/typography.css (+ theme.css)
Local development fixtures             →  `apps/api/src/fixtures`, invoked only by the guarded seed CLI; never runtime API or browser state
```

**Portal `lib/prism-api` policy**

- Keep **transport-only**: construct `createEventOpsClient`, read the role session token, and expose only URL/request helpers. Do not add domain operations to a portal-wide `prismApi` object.
- Put HTTP calls in `features/**/data`; group dashboard commands by their owning context and compose them at the screen boundary. Derive actor identity from the verified bearer token, not caller-supplied names or role query parameters.
- **Do not** re-export `Prism*` domain types for new code — import from `@prism/types`.
- Guest/supplier should stay near zero custom types; client/event adapters stay thin and API-backed, with no local demo mode or browser fixture fallback.
- New repositories prefer `@prism/api-client` + `@prism/types` directly (see guest).

**After changing `@prism/types`:** `npm --workspace @prism/types run build` (or `dev:api:watch`). Stale `dist/` breaks API/portal typecheck.

---

## Commands

**Package manager:** npm. Prefer workspace-scoped scripts while iterating.

```bash
npm install
npm run build && npm run typecheck # full monorepo; milestone/final verification
npm run test:api                  # full API suite; use focused workspace tests while iterating
npm run lint && npm run test:ci    # what CI runs: lint all portals; every workspace suite through turbo (cached)
npm run check:boundaries          # static boundary scan
npm run test:boundaries           # guard/tooling tests; not a substitute for check:boundaries
npm run smoke:ui                  # stack must be up
npm run dev:api | dev:api:watch | dev:client | dev:event | dev:supplier | dev:guest
```

```bat
start-prism.cmd                 rem local Node npm run dev (default, faster)
stop-prism.cmd                  rem stop local Node + local Supabase (data retained)
start-prism-docker.cmd          rem Docker compose (slow first build)
start-prism-docker.cmd -Dev     rem Docker hot reload
stop-prism-docker.cmd           rem stop Compose + local Supabase (data retained)
```

```bash
# apps/api
npm run typecheck && npm run build && npm run prisma:validate
npm run validate                  # prisma:validate + typecheck + build
npm run test && npm run test:fixtures:seed
npm run db:verify:offline && npm run db:audit:queries   # safe offline-ish
npm run db:doctor | db:status | db:setup | db:migrate | db:generate
npm run db:seed -- --profile accounts --env-file <absolute-private-file> --dry-run
npm run db:seed:verify -- --profile portal-uat --scenario-date YYYY-MM-DD --env-file <absolute-private-file>
npm run db:audit:schemas|naming|indexes | db:perf:report | db:backup:json  # live DB
# db:reset — destructive, explicit user ACK only
```

```bash
npm --workspace @prism/types run build|test|typecheck
npm --workspace @prism/api-client run test
```

**Env:** Development wrappers generate `.local-dev/api.env` and `.local-dev/docker.env` from local Supabase. Node mode also requires Docker. Deployments use `apps/api/.env` ← `.env.example`: one `DATABASE_URL` for runtime and Prisma; `DIRECT_URL` is an optional migration-only override. `PRISM_ENV_FILE` selects an explicit env file for API and database tools. Portals: each `.env.example` → `.env.local`. **Never commit secrets.** Accounts: `docs/runbooks/portal-accounts.md`.

**Env limits:** live DB audits / `db:perf:report` need DB creds; `smoke:ui` needs running stack; startup wrappers need Docker Desktop for local Supabase. Direct `dev:*` commands require an already prepared database environment. Failures in typecheck, unit tests, boundaries, `prisma:validate` are real bugs.

**After change (narrow → wide):** typecheck and behavior tests for touched workspaces (plus required dependencies) → `check:boundaries` if imports moved → `prisma:validate` + `db:verify:offline` if schema/queries changed → manual role path / `smoke:ui` if UX/API wiring changed → monorepo build and broad suites at milestones/final verification.

## Testing discipline

- Assert observable behavior and important safety boundaries. Tautological and change-detector tests that only mirror implementation or prove code changed are harmful; avoid them while retaining coverage for distinct failure modes.
- For a bug fix, find and repair or extend the behavior test that should have caught it. Add a separate regression test only when a genuine behavior-coverage gap remains.
- Prefer extending the nearest behavior-oriented test over creating a new test file. Combine trivial cases into one table-driven or grouped test when that stays readable.
- When tests change, use `.github/pull_request_template.md` to summarize the observable behavior and focused checks. Reviewers assess test value from the behavior covered; a template response and green CI do not prove that a test is useful.
- While editing, run focused checks for the touched module/workspace. Defer unrelated full suites and portal smoke tests to release milestones or final verification.
- Keep broad CI gates until timing data supports a safe change. Any selective CI must include affected workspaces and dependents, preserve migration/security/invariant gates, and fall back to full checks when impact mapping is uncertain.

---

## Patterns

### Zod (`@prism/types`) — default for all contracts

**Canonical location:** `packages/types/src/schemas/` (export via package index).

```typescript
import { z } from "zod";

export const createPrismInquirySchema = z.object({
  clientName: z.string().trim().min(1),
  email: z.string().email(),
  eventName: z.string().trim().min(1),
  eventDate: z.string().min(1),
  // …
});
export type CreatePrismInquiryInput = z.infer<typeof createPrismInquirySchema>;
```

| Layer | Rule |
| --- | --- |
| **Write / mutate** | Always Zod schema + `z.infer` in `@prism/types`. FE + Nest share it. |
| **Read models** | TypeScript interfaces in `@prism/types` (`event-ops.ts`, etc.) until a boundary must validate them; then add Zod. |
| **FE boundary** | `parseContract(schema, data, "Label")` or `schema.safeParse` in use-cases / form submit — never trust raw form objects. |
| **Nest boundary** | `@Body(zodBody(schema))` from `@prism/kernel/shared` (`ZodValidationPipe`). Prefer over new `class-validator` DTOs. |
| **Errors** | `safeParse` → 400 problem details / user-safe message; no raw `ZodError` to clients. |

**Migrated Nest write surfaces (Zod):** inquiry create/status/conforme, guest check-in/feedback, supplier quote submit/revise, live-ops task/issue/attendance, supplier event-status.  
**Still class-validator:** remaining DTOs — **when you touch a module**, migrate that body/query to Zod in `@prism/types` + `zodBody`; do not add new class-validator DTOs for shared writes.

**Do not** invent a second DTO type in the app or api-client. api-client may re-export inferred types for convenience; **schemas live only in `@prism/types`**.

No OpenAPI/Kubb codegen today.

### API surface

1. Own bounded context under `apps/api/src/modules/<bounded-context>/`; keep the module file and public `index.ts` at that boundary.
2. **Zod contract in `@prism/types`** (write) before controller work.
3. ports → services → thin controller (`zodBody` / legacy DTO) → mappers (no Prisma models as public API).
4. Cross-domain **reads** via `read-models` readers only; writers expose focused contracts/ports from their public index.
5. Portal HTTP via `@prism/api-client` (data layer).
6. Co-located tests; **forbidden-role** cases on sensitive mutations.
7. Docs/ledger updates only when governance requires (`10-…`, `11-feature-ledger.md`).

### FE surface

Correct role app → `src/features/<domain>/` → thin route → **same Zod schema** for shared input → ViewModel/use-case → `data/` → `@prism/api-client`. Visual rules above.

Naming (feature architecture): `features/<domain>/<action>/{model,view-models,views,use-cases,data}` · `DomainActionView` · `useDomainActionViewModel` · kebab files.

---

## Docs index (on demand)

Full map: `docs/index.md`. **Build from the semantic living bundle only.**
Completed execution plans are promoted and removed; recover original working
artifacts from Git history if forensic context is needed.

| Need | Read |
| --- | --- |
| Docs map and reading order | `docs/index.md` |
| Invariants and documentation rules | `docs/constitution.md` |
| Architecture and context ownership | `docs/architecture/current-architecture.md` |
| Architecture decisions and seams | `docs/architecture/decisions/` and `docs/architecture/context-contracts.md` |
| Product decisions and implementation reality | `docs/product/feature-ledger.md`, `docs/product/actual-system.md` |
| Governance and readiness | `docs/product/evolution-governance.md`, `docs/product/readiness-foundation.md` |
| Redesign inventory | `docs/product/redesign-inventory.md` |
| Runbooks and demo accounts | `docs/runbooks/` |
| Target system state | `docs/product/future-state.md` |
| V4 baseline catalog | `docs/reference/prism-v4/complete-feature-catalog.md` (traceability; not a hard ceiling) |

Typed concept documents use OKF-style frontmatter with authority, scope,
and verification metadata plus an at-a-glance summary. Directory indexes are
navigation only, and completed plans are not current sources of truth.

---

## Troubleshoot (fast)

| Symptom | Check |
| --- | --- |
| API down | local Supabase, `.local-dev/api.env` (or deployed env), port 4000, `db:generate` |
| Portal ↔ API | API up, CORS, portal `NEXT_PUBLIC_*` |
| Stale types / Zod | rebuild `@prism/types` / `dev:api:watch` |
| Zod 400s | shared schema in `@prism/types`; Nest uses `zodBody`; FE uses `parseContract` |
| Migrate vs pooler | `DATABASE_URL` is shared; optional `DIRECT_URL` overrides migrations only |
| Boundary fail | no cross-app imports; share via `packages/*` or API |
| Auth oddities | test actor/role headers + `access-control` event scope |
| New screen wants whole-system demo state | stop → scoped read model / capability route |
