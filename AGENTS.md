# P.R.I.S.M Agent Instructions

Follow this file first. Deepen only via the docs index below when incomplete or wrong.  
`CLAUDE.md` → this file (single agent entrypoint).

## Hard rules

| Do | Don't |
| --- | --- |
| Feature branch + PR; conventional commits (`feat:`, `fix:`, `refactor:`, …) | Push / force-push `main`; amend published commits without ask |
| **Shared contracts: Zod schema + `z.infer` in `@prism/types` only** | Parallel hand types; `as any`; app-local shared schemas; type-only DTOs without schema |
| Own API work in `apps/api/libs/modules/<capability>/` | God `event-ops` hub; private cross-module service imports |
| Role app for the actor; thin `app/` routes; logic in `features/` | Rebuild `apps/client` as all-role PMCM shell; cross-import apps |
| Scoped APIs + package contracts for new surfaces | Primary path via `/api/sample/state` or local sample state |
| Session/sample keys only in `@prism/types` | New app-local `prism:*` storage keys |
| Import packages by role (table below); thin `lib/prism-api` | Re-export domain types from app facades; fat god facades for new code |
| Name owner goal A–D on redesign/capability work | Treat owners as loose assignees |
| Typecheck + tests for touched packages; `check:boundaries` on import moves | Commit secrets / `.env*` with credentials; casual `db:reset` |
| Preserve unrelated uncommitted work | Drive-by reverts outside task scope |

**Owners:** A Maxine (UX) · B Francis (PMCM ops) · C Ethan (external portals) · D Anthony (platform trust).

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
- Auth now: API sample auth/RBAC (no external IdP unless a plan says so).

| App | Port | Actors | Owns | Must not |
| --- | ---: | --- | --- | --- |
| `client` | 3001 | public, clients | landing, inquiry, client dashboard, prefs, client-visible status | PMCM command, official floorplan edit, supplier/audit internals |
| `supplier` | 3002 | suppliers | quotes, readiness, contracts meta, event-day status | other bids, PMCM/client private data |
| `guest` | 3003 | guests | access code, pass, check-in, feedback | planning / other portals / PMCM |
| `event` | 3004 | PMCM, coordinators | command inbox, workspace, floorplans, suppliers, billing, compliance, live ops, closure, trust | public marketing as home; supplier/guest self-service ownership |
| `api` | 4000 | all via HTTP | workflows, RBAC, Prisma, audit, notify, AI gov, sample compat | UI, app session storage ownership |

**PARE agents (`apps/agent-*`)** — five [eve](https://vercel.com/eve) apps, one per PARE step, each deployed on its own. They reason only: context in, verdict out.

| App | Step | Tool | Returns |
| --- | --- | --- | --- |
| `agent-event-context` | 1 | `build_pare_event_context` | normalized `PAREContext` |
| `agent-supplier-finder` | 2 | `rank_supplier_candidates` | ranked `PARECandidate[]` (max 5) |
| `agent-budget` | 3 | `compute_budget_baseline` | `PAREBudgetAnalysis` |
| `agent-risk` | 4 | `compute_risk_baseline` | `PARERisk` |
| `agent-message-drafter` | 5 | `compute_draft_baseline` | `PAREDrafts` (never sent) |

- Decision logic is `@prism/pare-core`; contracts are `@prism/types`. Agents never touch Prisma, a portal, or `@prism/modules/*` — `check:boundaries` enforces this.
- The API still owns orchestration, the ZDR audit log and the approval record (`PAREService`). No PARE output acts without PMCM Admin approval.
- `PARE_MODE=mock` (default) answers entirely from `@prism/pare-core`. `PARE_MODE=live` delegates to the deployed agents and falls back to the deterministic verdict when one is unset, unreachable or returns nothing.
- Live-mode env: `PRISM_PARE_BUDGET_AGENT_URL`, `PRISM_PARE_RISK_AGENT_URL`, `PRISM_PARE_DRAFTER_AGENT_URL`, optional `PRISM_PARE_AGENT_TOKEN`.
- Per app: `npm run dev:agent-<name>` (eve TUI), `npm run eval:agents`, `npx eve info` to inspect discovery.

**Visual:** no nav underlines; no eyebrow/outline/uppercase badge pills; no sidebar avatar if top-bar account menu exists.

---

## Layout

```text
apps/api/          Nest modular monolith + Prisma (port 4000)
  apps/api/src/    bootstrap (prefix `api`, ValidationPipe legacy, Prisma filter)
  libs/modules/    capability modules (controllers, mappers, ports, services, *.test.ts)
  libs/shared/     ZodValidationPipe (`zodBody`), shared domain helpers
  prisma/          schema + migrations
apps/{client,supplier,guest,event}/   Next portals 3001–3004
apps/agent-*/        eve agents (PARE steps) — one deployable per agent, no DB access
packages/types       @prism/types     Zod write schemas + domain types + session keys
packages/pare-core   @prism/pare-core PARE decision logic (no framework, no DB)
packages/api-client  @prism/api-client  prismRequest/prismJson, createEventOpsClient, PrismApiError
packages/ui          shells/brand/public blocks only — no workflows / role data rules
packages/tokens      theme + typography CSS (+ token object)
docs/                product + architecture (see docs/README.md)
```

**Module map (writes):** `inquiry-onboarding`, `commercial-ops`, `supplier-ops`, `staffing-ops`, `finance-ops`, `compliance-ops`, `floorplan`, `file-ops`, `guest-ops`, `closure-ops`, `live-ops`, `event-core` (narrow lifecycle/commands), `access-control`, `identity-ops`, `trust-ops`, `notification-ops`, `ai-governance`, `sample-compatibility` (`/sample/*` only).  
**Read-only composition:** `event-read-models` only. Full ownership: `docs/prism-v4/15-system-architecture.md`.

**FE (new screens):** `page → View → ViewModel → use-case → data → @prism/api-client` (or thin portal adapter). No HTTP/rules in `page.tsx`. Prefer single-screen forms/lists over wizards unless requested.

---

## Monorepo packages (efficient use)

| Package | Owns | Import when | Never |
| --- | --- | --- | --- |
| **`@prism/types`** | Zod **write** schemas + `z.infer` types; domain **read** interfaces; session/storage keys; `parseContract` | Any shared contract, FE model, API body, repository typing | App-local copy of the same shape |
| **`@prism/pare-core`** | PARE decision logic: context building, candidate ranking, deterministic budget/risk/draft analyses, ZDR sanitizer | API PARE orchestration; `apps/agent-*` tools | Prisma/Nest/eve imports; a second copy of a scoring rule |
| **`@prism/api-client`** | HTTP transport + `createEventOpsClient` | **`features/**/data/*` only** (and thin `lib/prism-api` adapters) | Views, pages, view-models calling HTTP |
| **`@prism/ui`** | Shells, brand, public marketing blocks, shared empty/status chrome | Cross-portal chrome | Role workflows, business rules |
| **`@prism/tokens`** | `theme.css`, `typography.css`, `prismTokens` | Portal global CSS / design tokens | Per-app one-off color systems for shared brand |

**Default import map**

```text
Domain type / Zod schema / session key  →  @prism/types
Parse untrusted form/API body           →  parseContract / schema.safeParse (@prism/types)
HTTP                                    →  @prism/api-client in data/
Shell / brand / public blocks           →  @prism/ui  (prefer subpaths: @prism/ui/dashboard-shell)
Global CSS                              →  @prism/tokens/typography.css (+ theme.css)
Sample/mock-only / legacy compat        →  thin @/lib/prism-api (no type re-exports for new code)
```

**Portal `lib/prism-api` policy**

- Keep **thin**: wire `createEventOpsClient` + role-specific helpers only.
- **Do not** re-export `Prism*` domain types for new code — import from `@prism/types`.
- Guest/supplier should stay near zero custom types; client/event may still hold sample/local helpers until fully retired.
- New repositories prefer `@prism/api-client` + `@prism/types` directly (see guest).

**After changing `@prism/types`:** `npm --workspace @prism/types run build` (or `dev:api:watch`). Stale `dist/` breaks API/portal typecheck.

---

## Commands

**Package manager:** npm. Prefer workspace-scoped scripts while iterating.

```bash
npm install
npm run build && npm run typecheck
npm run test:api
npm run check:boundaries          # also: npm run test:boundaries
npm run smoke:ui                  # stack must be up
npm run dev:api | dev:api:watch | dev:client | dev:event | dev:supplier | dev:guest
```

```bat
start-prism.cmd                 rem local Node npm run dev (default, faster)
stop-prism.cmd                  rem stop local Node only
start-prism-docker.cmd          rem Docker compose (slow first build)
start-prism-docker.cmd -Dev     rem Docker hot reload
stop-prism-docker.cmd           rem docker compose down
```

```bash
# apps/api
npm run typecheck && npm run build && npm run prisma:validate
npm run validate                  # prisma:validate + typecheck + build
npm run test && npm run test:sample-compatibility
npm run db:verify:offline && npm run db:audit:queries   # safe offline-ish
npm run db:doctor | db:status | db:setup | db:migrate | db:generate
npm run db:audit:schemas|naming|indexes | db:perf:report | db:backup:json  # live DB
# db:reset — destructive, explicit user ACK only
```

```bash
npm --workspace @prism/types run build|test|typecheck
npm --workspace @prism/api-client run test
```

**Env:** `apps/api/.env` ← `.env.example` (`SUPABASE_DB_URL`/`DATABASE_URL`, `DIRECT_URL` for migrations, `CORS_ORIGIN`, `PARE_MODE=mock`). Docker: `.env.docker` ← `.env.docker.example`. Portals: each `.env.example` → `.env.local`. **Never commit secrets.** Accounts: `docs/portal-accounts.md`.

**Env limits:** live DB audits / `db:perf:report` need DB creds; `smoke:ui` needs running stack; Docker scripts need Desktop (or `-Local` / `dev:*`). Failures in typecheck, unit tests, boundaries, `prisma:validate` are real bugs.

**After change (narrow → wide):** typecheck touched workspaces → tests → `check:boundaries` if imports moved → `prisma:validate` + `db:verify:offline` if schema/queries → manual role path / `smoke:ui` if UX/API wiring.

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
| **Nest boundary** | `@Body(zodBody(schema))` from `@prism/shared` (`ZodValidationPipe`). Prefer over new `class-validator` DTOs. |
| **Errors** | `safeParse` → 400 problem details / user-safe message; no raw `ZodError` to clients. |

**Migrated Nest write surfaces (Zod):** inquiry create/status/conforme, guest check-in/feedback, supplier quote submit/revise, live-ops task/issue/attendance, supplier event-status.  
**Still class-validator:** remaining DTOs — **when you touch a module**, migrate that body/query to Zod in `@prism/types` + `zodBody`; do not add new class-validator DTOs for shared writes.

**Do not** invent a second DTO type in the app or api-client. api-client may re-export inferred types for convenience; **schemas live only in `@prism/types`**.

No OpenAPI/Kubb codegen today.

### API surface

1. Own module under `libs/modules/<capability>/`.
2. **Zod contract in `@prism/types`** (write) before controller work.
3. ports → services → thin controller (`zodBody` / legacy DTO) → mappers (no Prisma models as public API).
4. Cross-domain **reads** via `event-read-models` readers only.
5. Portal HTTP via `@prism/api-client` (data layer).
6. Co-located tests; **forbidden-role** cases on sensitive mutations.
7. Docs/ledger updates only when governance requires (`10-…`, `11-feature-ledger.md`).

### FE surface

Correct role app → `src/features/<domain>/` → thin route → **same Zod schema** for shared input → ViewModel/use-case → `data/` → `@prism/api-client`. Visual rules above.

Naming (feature architecture): `features/<domain>/<action>/{model,view-models,views,use-cases,data}` · `DomainActionView` · `useDomainActionViewModel` · kebab files.

---

## Docs index (on demand)

Full map: `docs/README.md`. **Build from living docs only.** Completed execution plans were removed; recover from git history if needed.

| Need | Read |
| --- | --- |
| Docs map | `docs/README.md` |
| Architecture | `docs/architecture.md` → `docs/prism-v4/15-system-architecture.md` |
| Decisions / inventory | `11-feature-ledger.md`, `12-redesign-inventory.md`, `07-implemented-feature-revisions.md` |
| Governance / readiness | `10-product-evolution-and-redesign-governance.md`, `14-redesign-readiness-foundation.md` |
| Run / Docker / accounts | root `README.md`, `docs/docker-dev-testing-guide.md`, `docs/portal-accounts.md` |
| Narrative / target | `16-actual-system.md`, `18-future-state.md` |
| Baseline catalog | `01-complete-feature-catalog.md` (traceability; not a hard ceiling) |
| Doc hygiene | `13-docs-cleanup-checklist.md` |

Paths under `docs/prism-v4/` unless noted. Drift → prefer `15` + `11`; smallest safe fix.

---

## Troubleshoot (fast)

| Symptom | Check |
| --- | --- |
| API down | `apps/api/.env` DB URLs, port 4000, `db:generate` |
| Portal ↔ API | API up, CORS, portal `NEXT_PUBLIC_*` |
| Stale types / Zod | rebuild `@prism/types` / `dev:api:watch` |
| Zod 400s | shared schema in `@prism/types`; Nest uses `zodBody`; FE uses `parseContract` |
| Migrate vs pooler | migrations use `DIRECT_URL` |
| Boundary fail | no cross-app imports; share via `packages/*` or API |
| Auth oddities | sample actor/role headers + `access-control` event scope |
| New screen wants sample state | stop → scoped read model / capability route |
