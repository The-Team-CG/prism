# P.R.I.S.M Agent Instructions

Follow this file first. Deepen only via the docs index below when incomplete or wrong.  
`CLAUDE.md` → this file (single agent entrypoint).

## Hard rules

| Do | Don't |
| --- | --- |
| Feature branch + PR; conventional commits (`feat:`, `fix:`, `refactor:`, …) | Push / force-push `main`; amend published commits without ask |
| New shared contracts: **Zod + `z.infer` in `@prism/types`** | Parallel hand types; `as any`; app-local shared schemas |
| Own API work in `apps/api/libs/modules/<capability>/` | God `event-ops` hub; private cross-module service imports |
| Role app for the actor; thin `app/` routes; logic in `features/` | Rebuild `apps/client` as all-role PMCM shell; cross-import apps |
| Scoped APIs + typed contracts for new surfaces | Primary path via `/api/sample/state` or local sample state |
| Session/sample keys only in `@prism/types` | New app-local `prism:*` storage keys |
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

**Visual:** no nav underlines; no eyebrow/outline/uppercase badge pills; no sidebar avatar if top-bar account menu exists.

---

## Layout

```text
apps/api/          Nest modular monolith + Prisma (port 4000)
  apps/api/src/    bootstrap (prefix `api`, ValidationPipe, Prisma filter)
  libs/modules/    capability modules (controllers, dto, mappers, ports, services, *.test.ts)
  prisma/          schema + migrations
apps/{client,supplier,guest,event}/   Next portals 3001–3004
packages/types       @prism/types     Zod contracts, session keys, shared types
packages/api-client  @prism/api-client  prismRequest/prismJson, createEventOpsClient, PrismApiError
packages/ui          shells/primitives only — no workflows / role data rules
packages/tokens      theme tokens
docs/                product + architecture (see docs/README.md)
```

**Module map (writes):** `inquiry-onboarding`, `commercial-ops`, `supplier-ops`, `staffing-ops`, `finance-ops`, `compliance-ops`, `floorplan`, `file-ops`, `guest-ops`, `closure-ops`, `live-ops`, `event-core` (narrow lifecycle/commands), `access-control`, `identity-ops`, `trust-ops`, `notification-ops`, `ai-governance`, `sample-compatibility` (`/sample/*` only).  
**Read-only composition:** `event-read-models` only. Full ownership: `docs/prism-v4/15-system-architecture.md`.

**FE (new screens):** `page → View → ViewModel → use-case → data → api-client`. No HTTP/rules in `page.tsx`. Prefer single-screen form/list over wizards unless requested.

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
start-prism.cmd                 rem Docker default (needs Desktop)
start-prism.cmd -Dev|-Foreground|-Local
stop-prism.cmd [-Volumes|-LocalOnly]
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

### Zod (`@prism/types`) — new contracts only

Add `zod` to `packages/types` on first use. Export schema + type from package index. Rebuild types (`build` or `dev:api:watch`) after changes.

```typescript
import { z } from "zod";

export const createInquirySchema = z.object({
  clientName: z.string().min(1),
  email: z.string().email(),
  eventName: z.string().min(1),
  eventDate: z.string().min(1),
  companyName: z.string().optional(),
});
export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
```

- Parse untrusted input at boundaries (`safeParse` → 400 problem details; no raw `ZodError` to clients).
- Existing Nest DTOs: `class-validator` + global `ValidationPipe` — leave alone unless touching; then migrate toward Zod in `@prism/types`, no mass rewrites.
- UI + API + api-client share the same schema. No OpenAPI/Kubb codegen today.

### API surface

1. Own module under `libs/modules/<capability>/`.
2. Zod contract in `@prism/types`.
3. ports → services → thin controller → mappers (no Prisma models as public API).
4. Cross-domain **reads** via `event-read-models` readers only.
5. Client helper in `@prism/api-client` when portals need it.
6. Co-located tests; **forbidden-role** cases on sensitive mutations.
7. Docs/ledger updates only when governance requires (`10-…`, `11-feature-ledger.md`).

### FE surface

Correct role app → `src/features/<domain>/` → thin route → same Zod schema for shared input → visual rules above.

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
| Stale types | rebuild `@prism/types` / `dev:api:watch` |
| Migrate vs pooler | migrations use `DIRECT_URL` |
| Boundary fail | no cross-app imports; share via `packages/*` or API |
| Auth oddities | sample actor/role headers + `access-control` event scope |
| New screen wants sample state | stop → scoped read model / capability route |
