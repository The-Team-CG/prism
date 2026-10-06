---
type: "Executable Contract"
title: "P.R.I.S.M documentation and architecture constitution"
description: "Current invariants for role ownership, bounded contexts, shared contracts, compatibility paths, frontend layering, and documentation maintenance."
tags: [architecture, constitution, contracts, documentation]
status: canonical
updated: "2026-10-06"
authority: normative
owner: "D (Anthony)"
audience: [agents, maintainers, engineers]
scope: "repository-wide cross-cutting rules"
last_verified: "2026-10-06; documentation hierarchy, changelog guidance, and bundle navigation reviewed"
sources:
  - id: prism-agent-rules
    resource: "AGENTS.md"
    title: "Prism agent and repository rules"
  - id: current-architecture
    resource: "docs/architecture/current-architecture.md"
    title: "Current architecture reference"
  - id: api-source
    resource: "apps/api/src"
    title: "Current API source tree"
  - id: shared-contracts
    resource: "packages/types/src"
    title: "Shared contract source"
---
# P.R.I.S.M constitution

## At a glance

- **Purpose:** State the invariants that keep product ownership, architecture, contracts, and documentation coherent.
- **Authority:** Normative cross-cutting contract below `AGENTS.md` and above detailed architecture/product documents.
- **Owner:** D (Anthony).
- **Scope:** Role apps, API contexts, shared contracts, read models, compatibility, frontend layering, and docs.
- **Use when:** Starting a feature, changing a boundary, or deciding whether a document is still authoritative.
- **Change when:** A cross-cutting invariant changes; record consequential architecture changes in an ADR.
- **Verify with:** The narrowest relevant code checks plus the documentation audits defined below.

This document is the current cross-cutting contract for the Prism repository.
When code, schemas, routes, ownership, or documentation changes, update the
affected source of truth and its verification evidence in the same change.
Every user-requested code, architecture, documentation, or operational delivery
also updates the root `CHANGELOG.md`; documentation-bundle changes additionally
update `docs/log.md`. Keep release notes under `[Unreleased]` until a release
workflow cuts a version. Release notes follow Keep a Changelog categories and
describe notable user- or developer-visible effects. Use one concise bullet
per coherent change; omit PR-by-PR implementation details, test logs, and
commit-history summaries. `docs/log.md` records only structural or contract
changes to the documentation bundle; Git history preserves the detailed record.

## Authority order

1. `AGENTS.md` defines agent safety, repository commands, ownership goals, and
   hard rules.
2. This constitution defines cross-cutting invariants and documentation usage.
3. `docs/architecture/current-architecture.md` defines the current runtime and
   ownership map.
4. `docs/architecture/decisions/` records accepted architecture decisions.
5. `docs/product/feature-ledger.md` defines active product-family decisions.
6. `docs/reference/prism-v4/` preserves historical/source material only.

If two documents conflict, update the lower-authority document or record a new
decision; do not leave parallel current interpretations in place.

## Role-app ownership

The four portals remain separate role applications:

| App | Owns | Must not own |
| --- | --- | --- |
| `apps/client` | public inquiry and client-scoped actions/status | PMCM command, official floorplan edits, supplier private data, audit internals |
| `apps/supplier` | assigned quotes, readiness, contracts metadata, event-day status | other bids, client data, PMCM private reviews/costs |
| `apps/guest` | access-code entry, pass, consented check-in, moderated feedback | planning, portal dashboards, PMCM internals, cross-event reads |
| `apps/event` | PMCM/coordinator command, selected event workspaces, official floorplans, supplier/billing/compliance/live operations/closure/trust | public marketing home, supplier/guest self-service ownership |

The API is shared transport and policy infrastructure, not a UI or app-session
owner. New surfaces name the actor, event scope, allowed fields, forbidden
fields, audit expectation, and verification evidence.

## Backend modular monolith

The backend is one NestJS deployable with one Prisma client. Business ownership
lives in bounded-context roots under
`apps/api/src/modules/<bounded-context>/`; technical infrastructure
lives under `apps/api/src/kernel/`. Local development fixtures live under
`apps/api/src/fixtures/` and are loaded by an explicit seed command, outside
the HTTP application module.

Each context exposes one composition root and a public `index.ts`. Internal
folders are progressive: use `api/`, `application/`, `contracts/`, `domain/`,
and `infrastructure/` only when the capability has that depth. A provider,
technical helper, repository, or deployment mode is not automatically a new
bounded context.

The kernel may be used by contexts but must not depend on business contexts.
The known access-control audit seam is recorded in the context-contract
register; it is not permission to add more kernel-to-business imports.

## Contracts and compatibility

- Shared write contracts are Zod schemas plus `z.infer` in `@prism/types`.
- Read models are shared interfaces in `@prism/types` until validation is needed
  at an untrusted boundary.
- HTTP transport belongs in `@prism/api-client`, called from feature `data/`
  adapters or thin portal adapters.
- The API exposes no `/sample/*` runtime routes. Local fixture data is loaded
  only by `npm --workspace prism-api run db:seed:fixtures` into an empty,
  loopback PostgreSQL database named `prism_sample_disposable`; the command
  requires explicit database confirmation and refuses production or populated
  fixture tables.
- Session storage keys belong in `@prism/types`; apps must not add new literal
  `prism:*` keys.
- No Prisma model is a public API. Controllers delegate to context services and
  mappers.

## Read models and context seams

Application-level cross-context production code uses a public context index, a
serialisable contract, or a focused injected port. Context roots may import
Nest modules for composition only. Private services, repositories, DTOs, and
provider adapters are not cross-context interfaces.

`modules/read-models` composes role-scoped reads and is read-only. It must not
become a write hub or a replacement for owning context policy. Intentional
cross-context database joins are documented before new queries are added.

## Frontend architecture

New screens follow:

```text
page -> View -> ViewModel -> use-case -> data -> @prism/api-client
```

App Router pages remain thin; HTTP and business rules do not live in
`page.tsx`, views, or view-models. Role and section intent may use invisible
route groups such as `(auth)` and `(portal)`. Existing URLs remain stable; a
dynamic segment or query-state migration requires route-by-route compatibility
evidence. A large shell or pathname switch is a migration hotspot, not a new
architecture pattern.

## Documentation contract

The bundle uses OKF v0.2-style Markdown:

- `docs/index.md` is the bundle landing; each directory `index.md` is a
  navigation listing; `docs/log.md` records structural/contract updates only.
- `docs/log.md` is a curated bundle log, so it is exempt from concept
  frontmatter and `At a glance` metadata.
- Every non-index concept under `docs/` has `type`, `title`, `description`,
  `tags`, `status`, `updated`, `authority`, `owner`, `audience`, `scope`,
  `last_verified`, and `sources` frontmatter. Prefer repository-relative
  paths; explicitly named skills, standards, or source artifacts are valid
  provenance when the material is not stored in this repo.
- Every non-index concept starts with an `At a glance` section that states its
  purpose, authority, owner, scope, use/change triggers, and verification.
- Use `status: canonical` for living sources of truth, `active` for maintained
  inventories or registers, and `reference` for preserved source material.
- Use `authority: normative`, `informative`, `operational`, or `reference` to
  distinguish how a document may be used; status and authority are separate.
- Living documents are current, portable, and conversation-agnostic. They do
  not depend on a branch, machine path, chat handoff, session diary, or active
  execution plan.
- Dates in `updated`, `last_verified`, `decision_date`, logs, and changelogs are
  provenance only; they must not be the condition that makes a living rule true.
- New documents use semantic lower-kebab-case names. Accepted decisions use
  numbered ADRs under `docs/architecture/decisions/`.
- Completed plans and dated reviews are promoted into durable documents and
  removed from the working tree. Git history is the archive; the V4 catalog is
  the deliberate reference exception.
- Active plans remain only while they have open decisions or acceptance work;
  keep them indexed and repair source links when supporting artifacts are retired.
- The canonical landing and directory indexes are the only navigation authority;
  do not add duplicate pointer documents.

## Verification contract

Before delivery, run the narrowest relevant checks and record evidence:

```powershell
git diff --check
npm run check:boundaries
npm run test:boundaries
```

Documentation changes additionally require a relative-link audit, frontmatter
audit, stale-path search, and proof that no source files changed. Do not use a
documentation check to claim live database, browser, staging, or production
behavior that was not executed.

Second-owner review cannot be self-certified. Architecture, contract, and
auth PRs need a recorded GitHub review from someone other than the author
before merge. CI passing is not a review. An empty GitHub `reviews` array is
not a review. Off-GitHub look-overs must be written onto the PR so the record
exists. This private repository is on GitHub Free, so CODEOWNERS and
required reviewers cannot enforce that rule; the reviews array is the
record, not a merge lock.
