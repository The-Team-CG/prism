# Backend DDD bounded-context consolidation

Status: design in progress (2026-09-01). This document is the authoritative plan for
consolidating `apps/api/libs/modules/*` (22 Nest CLI "library" projects) into a small
number of DDD-shaped bounded contexts, following the reference structure used in the
AlphaCI Enterprise backend (`alphaci-enterprise-be`, branch
`codex/architecture-remediation-trunk`).

## Structural difference from the reference repo (read this first)

AlphaCI's backend is a **single Nest application** with one `src/` tree; its 6 bounded
contexts are plain folders under `src/modules/<context>/`, each with one
`<context>.module.ts` and one `index.ts`. There is exactly one `tsconfig.json` and no
per-context build wiring.

Prism's backend uses the **Nest CLI monorepo "library" mechanism**: each of the 22
modules is registered in `nest-cli.json`'s `projects` map with its own
`tsconfig.lib.json`, and each gets a dedicated path alias in root `tsconfig.json`
(`@prism/modules/<name>` -> `libs/modules/<name>/src/index`). `apps/api/apps/api/src/app.module.ts`
imports all 22 as separate Nest modules.

This means "consolidate into bounded contexts" here concretely means:

1. **Merge N sibling libraries into 1 per context** (e.g. `live-ops` + `staffing-ops` +
   `guest-ops` -> one `operations` library), each still a standalone Nest CLI library
   project with its own `tsconfig.lib.json` and `nest-cli.json` entry.
2. Reorganize each merged context's internals using the reference's per-context folder
   names (`contracts/`, `core/`, `domain/`, `application/` + `application/ports/`,
   `infrastructure/`, `api/`) instead of prism's current flat
   `controllers/ mappers/ ports/ services/` layout — only adding a folder a context
   actually needs (per the skill's own progressive-depth rule).
3. Update `nest-cli.json`, root `tsconfig.json` paths, and `app.module.ts` to import
   the new, smaller set of context modules instead of 22 individual ones.
4. Prism already has 2 real `domain/` folders (`live-ops`, `commercial-ops`, added in the
   prior architecture-alignment plan) — those move into their new context's
   `domain/` folder unchanged; this consolidation does not redo that work.

## Evidence gathered before grouping

**Owned-tables doc comments** (added in the prior architecture-alignment plan, one per
module) were read for all 22 modules and are the primary ownership evidence used below.

**Fan-in per module** (count of `@prism/modules/<name>` imports from *other* modules,
via `Select-String`, 2026-09-01):

| Module | Fan-in | Notes |
| --- | ---: | --- |
| event-core | 77 | Shared kernel-like: `PrismTransactionRunner`, `WorkflowCommandService`, `ops.constants` enums used everywhere |
| access-control | 59 | `EventAccessPolicyService` guard/policy used by nearly every controller |
| trust-ops | 21 | Audit + notification publisher ports used broadly |
| identity-ops | 18 | Auth/session/user lookups |
| event-session | 13 | `EventSessionGuard`, `AuthSessionService` — primitive used everywhere |
| notification-ops | 11 | Outbox writer port |
| guest-ops | 11 | |
| floorplan | 10 | Read by closure-ops, event-read-models, sample-compatibility, staffing-ops |
| staffing-ops | 8 | |
| finance-ops | 6 | |
| commercial-ops | 5 | |
| supplier-ops | 5 | |
| file-ops | 5 | |
| ai-governance | 3 | |
| closure-ops | 3 | |
| event-read-models | 3 | |
| inquiry-onboarding | 3 | |
| live-ops | 3 | |
| compliance-ops | 2 | |
| floorplan-authoring | 0 | Merged from events+plans+templates+publishing in the prior plan; no cross-module callers yet |
| health | 0 | |
| sample-compatibility | 0 | Legacy `/sample/*` shim; imports ~18 of 22 modules, is imported by none — correctly a leaf |

**Reading**: `event-core`, `access-control`, `event-session`, and (to a lesser extent)
`trust-ops`/`identity-ops`/`notification-ops` are not really "business contexts" in the
AlphaCI sense — they are the technical/cross-cutting layer every context depends on,
matching AlphaCI's `kernel/` pattern. This changes the grouping from the goal's initial
guess (which put trust-ops/notification-ops/ai-governance together as one
"platform-ops" business context): trust-ops and notification-ops are kernel-shaped by
their fan-in and role (every context needs to audit and notify), while ai-governance is
a genuine narrow business capability (AI approval/audit records tied to supplier
review) with only 3 importers.

## Target shape

### Kernel (not a bounded context; mirrors AlphaCI's `kernel/`)

Already exists as `libs/core/shared-kernel`, `libs/database`, `libs/shared`. Add to this
layer (do **not** merge into a business context):

- `event-core` (WorkflowCommandService, PrismTransactionRunner re-export, ops.constants
  enums) — 77 importers, zero owned tables, this *is* prism's kernel today in
  everything but folder name.
- `event-session` (session guard, auth-session primitives) — 13 importers, zero owned
  tables, pure cross-cutting auth primitive.
- `access-control` (event access policy service) — 59 importers, zero owned tables,
  used as a guard/policy by nearly every controller across every context.
- `health` — 0 importers, liveness probe, already correctly tiny/infra.

These four become `libs/kernel/*` (or stay under `libs/modules/` but are documented and
named as kernel, matching the review's existing recommendation to "relabel as
platform/infra, not business domains"). Decision: **rename directory from
`libs/modules/` to a sibling `libs/kernel/` for these four**, since AlphaCI's kernel is a
visibly separate top-level folder, not a "module" by name. This is the most visible,
lowest-regression-risk part of the consolidation (no business logic moves, only
directory/path-alias renames).

### Bounded contexts (7, merging the 18 remaining libraries)

| # | Context name | Merges these modules | Rationale |
| - | --- | --- | --- |
| 1 | `floorplan` | `floorplan`, `floorplan-authoring` | Already recognized as one concern by the prior plan (Task 10 merged 4 libs into `floorplan-authoring`); this step merges that with the sibling `floorplan` (live per-event floorplan) library. Same domain (physical event layout), different lifecycle stage (authoring/template vs. live per-event) — becomes `core/authoring` and `core/live` (or similar) sub-areas under one context, not two libraries. 10+0 fan-in, lowest risk to start with. |
| 2 | `operations` | `live-ops`, `staffing-ops`, `guest-ops` | Event-day execution: urgent issues/tasks, coordinator staffing, guest check-in/feedback. All three read `OpsEvent`/`OpsCoordinator` and write day-of-event tables. `live-ops` already has a real `domain/` folder (urgent-issue + escalation policy) that moves in as-is. |
| 3 | `commercial` | `commercial-ops`, `supplier-ops`, `finance-ops` | Supplier sourcing -> quote -> billing pipeline. `commercial-ops` already has a real `domain/` folder (quote-request lifecycle policy, added this session) that moves in as-is. |
| 4 | `event-lifecycle` | `inquiry-onboarding`, `compliance-ops`, `closure-ops`, `file-ops` | Inquiry through closure: the event record's own lifecycle (create, compliance gate, document/file requirements, closure/insights). `inquiry-onboarding` owns `OpsEvent` itself; the other three write status/derived fields onto it or its related records. |
| 5 | `platform-ops` | `trust-ops`, `notification-ops`, `ai-governance` | **Kept as the goal originally specified**, despite trust-ops/notification-ops' kernel-like fan-in, because unlike event-core/access-control/event-session they *do* own real business tables (`OpsAuditLog`, `OpsPrivacyRequest`, `OpsSecurityAlert`, `OpsNotificationLog`, `OpsAiApprovalRecord`, `OpsAiAuditLog`) and real business rules (GDPR erasure, lockout policy, AI approval gating) — they are business capabilities that happen to be consumed everywhere, not technical infrastructure. This is a judgment call flagged for review before execution (see Open Questions). |
| 6 | `identity-access` | `identity-ops` | Kept singular for now (18 fan-in, owns `OpsUser`/`OpsApprovalRequest`). `access-control` and `event-session` are *not* merged in here despite the name similarity to AlphaCI's `identity-access` — in prism they are kernel-shaped (zero owned tables, used by literally every context as a cross-cutting guard), not identity business logic. This is the clearest naming false-friend with the reference repo and is called out explicitly so it is not "fixed" by mistake during execution. |
| 7 | `read-models` | `event-read-models` | Already a correctly-designed, read-only, cross-context composition layer (documented in AGENTS.md: "Cross-domain reads via event-read-models readers only"). Kept as its own context, matching AlphaCI having no direct analogue but the pattern of "one context, one clear read-only role." Not merged into anything. |

`sample-compatibility` is **not** merged into any bounded context. It is a
legacy `/sample/*` demo/local-bootstrap compatibility shim that imports ~18 of the 22
modules by design (documented in its own owned-tables comment: "Owned tables: none").
It stays exactly as-is as a standalone leaf library; AlphaCI has no analogous
compatibility layer to imitate here.

### Per-context internal folder shape

Following the reference repo, but only adding folders a context actually needs (skill's
progressive-depth rule — do not invent empty `domain/` or `core/` folders):

```text
libs/contexts/<context>/src/
  <context>.module.ts       # composition root (imports the sub-feature Nest modules below)
  index.ts                  # public API: only what other contexts/app.module.ts need
  contracts/                # serialisable types/tokens other contexts depend on (only if any exist)
  domain/                   # pure policy/entities (only where prism already added one: floorplan[TBD], operations, commercial)
  application/
    ports/                  # focused DI-inversion interfaces (only where a real seam exists)
    <feature>.service.ts
  infrastructure/
    <feature>.repository.ts # only if a context introduces a real repository abstraction; most prism services call PrismaService directly today and that does not change in this pass
  api/
    <feature>.controller.ts
    <feature>.dto.ts
```

Contexts that merge multiple prior libraries (operations, commercial, event-lifecycle,
platform-ops) keep one subfolder per merged concern inside `application/` and `api/`
(e.g. `operations/application/live-ops/`, `operations/application/staffing/`,
`operations/application/guest/`) rather than flattening all services into one folder —
this preserves today's clear per-feature file grouping and keeps diffs reviewable,
while still presenting one `OperationsModule`/one `index.ts` to the rest of the app.

## Migration order (lowest risk first)

1. **kernel rename** (event-core, access-control, event-session, health -> `libs/kernel/*`)
   — path/alias rename only, zero logic change, but touches the most files (77+59+13+0
   importers = potentially every module's import lines). Do this **last**, not first,
   despite being "simple," because it is the single highest-blast-radius mechanical
   change and every other context migration should be validated against the *current*
   import paths first so failures are attributable to the real context merges, not a
   simultaneous rename.
2. **floorplan** (merge floorplan + floorplan-authoring) — 10 + 0 fan-in, smallest
   business-logic merge, proves the merge pattern end-to-end.
3. **operations** (live-ops + staffing-ops + guest-ops) — 3+8+11 fan-in, has an existing
   `domain/` folder to relocate, proves the domain-folder-carries-over step.
4. **commercial** (commercial-ops + supplier-ops + finance-ops) — 5+5+6 fan-in, has an
   existing `domain/` folder to relocate.
5. **event-lifecycle** (inquiry-onboarding + compliance-ops + closure-ops + file-ops) —
   3+2+3+5 fan-in, but `inquiry-onboarding` owns `OpsEvent` itself, the most
   cross-referenced table in the schema — do after the lower-risk merges above have
   proven the process.
6. **platform-ops** (trust-ops + notification-ops + ai-governance) — 21+11+3 fan-in;
   highest business-logic fan-in of the merges (not counting kernel). Do after
   event-lifecycle.
7. **identity-access** (identity-ops rename only, no merge) — 18 fan-in, single-module
   rename, low complexity but done here to keep it adjacent to platform-ops/kernel
   discussion in review.
8. **read-models** (event-read-models rename only, no merge) — 3 fan-in, single-module
   rename.
9. **kernel rename** (event-core, access-control, event-session, health) — done last per
   point 1.
10. Update `nest-cli.json`, root `tsconfig.json` paths, `app.module.ts`, AGENTS.md,
    `docs/prism-v4/15-system-architecture.md`, and the existing
    `docs/reviews/2026-09-01-fe-be-architecture-alignment.md` +
    `docs/reviews/2026-09-01-fe-be-priority-risk-matrix.md` to reflect the final
    7-context + kernel shape.

Each step: migrate -> `tsc --noEmit` -> full `vitest run` (expect 350/350 unchanged) ->
backend-architecture boundary check -> `prisma validate` -> `nest build api` -> commit.
No FE app should need any change (contexts are an API-internal reorganization; no
route paths change).

## Open questions for the user before executing steps 6–9

1. **platform-ops grouping**: confirmed above to keep trust-ops + notification-ops +
   ai-governance together as originally specified, reasoned from owned-table evidence
   rather than fan-in alone. Flagging because fan-in alone would argue for splitting
   trust-ops/notification-ops out as kernel-like. Proceeding with the goal's original
   grouping unless told otherwise.
2. **identity-access naming**: the goal's objective text grouped "identity/access/session"
   together by name, matching AlphaCI's `identity-access` context name. Evidence shows
   `access-control` and `event-session` are kernel-shaped (zero owned tables, near-universal
   fan-in), not identity business logic, so this document keeps them in kernel and keeps
   `identity-access`/`identity-ops` as a separate, smaller business context containing
   only `identity-ops`. Proceeding on this reading of the evidence; flagged for visibility
   since it changes the goal's literal context list.
3. **`libs/kernel/` vs. keeping `libs/modules/`** for event-core/access-control/event-session/health:
   proceeding with introducing `libs/kernel/` as a new top-level sibling to
   `libs/modules/` and `libs/contexts/`, matching AlphaCI's visible `kernel/` separation,
   since the existing review explicitly recommended "visibly separate... from business
   modules."

This document will be updated with a "Result" section per completed migration step, and
a final section reconciling the design against actual post-migration state before the
goal is marked complete.

