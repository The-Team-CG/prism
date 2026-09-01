---
type: "Design Specification"
title: "P.R.I.S.M documentation governance and OKF migration"
description: "Design for restructuring Prism documentation into an Open Knowledge Format bundle with canonical architecture, ADRs, product records, roadmaps, runbooks, and preserved reference material."
tags: [documentation, architecture, governance, okf]
status: approved-for-review
timestamp: "2026-09-01T00:00:00+08:00"
sources:
  - id: prism-docs
    resource: "docs"
    title: "Current Prism documentation tree"
  - id: prism-rules
    resource: "AGENTS.md"
    title: "Current Prism agent and architecture rules"
  - id: alpha-ci-reference
    resource: "C:/Users/anton/Codes/Alpha Explora/AlphaCi Enterprise/worktrees/alphaci-enterprise-be/merry-prism/alphaci-enterprise-be/docs"
    title: "AlphaCI Enterprise OKF documentation bundle used as the reference"
---

# P.R.I.S.M documentation governance and OKF migration

## Context

Prism's current documentation is useful but grew around a numbered `prism-v4`
tree and dated execution artifacts. The repository now has a consolidated DDD-
shaped backend and a documented frontend architecture, but the documentation
does not yet expose those decisions in a portable knowledge bundle. The current
set also has two direct contradictions: the cleanup checklist says that
`docs/superpowers/**` is retired while two plans remain tracked, and `README.md`
still describes the former `apps/api/libs/modules` source tree.

The AlphaCI Enterprise backend provides a suitable structural reference: a
root `docs/index.md`, a constitution of executable invariants, typed Markdown
with YAML frontmatter, directory indexes, an update log, architecture decision
records, and separate product/capability/runbook/reference areas. Prism should
adopt the documentation mechanics and navigation discipline without copying
AlphaCI's product vocabulary or pretending that Prism has AlphaCI capabilities.

## Goals

1. Make one portable `docs/index.md` the discoverable documentation bundle
   entrypoint.
2. Make current architecture, product direction, roadmap, and operating
   procedures easy to find without reading a dated plan or chat transcript.
3. Record the five implemented architecture decisions that govern future work:
   role-app boundaries; shared contracts and sample compatibility; DDD context
   and kernel layout; cross-context seams and read models; and route-preserving
   frontend feature architecture.
4. Preserve the V4 catalog as historical/reference material while removing
   numeric filenames from the current living-document navigation.
5. Remove completed or duplicated plan/review artifacts from the working tree
   only after their durable content has been promoted into canonical documents.
6. Make documentation claims traceable to current source paths, commands, and
   explicit status values.

## Non-goals

- No product behavior, API route, database schema, or UI behavior changes.
- No frontend route-group implementation; the frontend ADR documents the
  accepted structure and the roadmap retains the future implementation work.
- No backend context split into separate deployables or microservices.
- No rewrite of the source-preserving V4 catalog.
- No deletion of Git history. Removed plans and dated reviews remain recoverable
  from commits.
- No new documentation generator or CI dependency unless an existing repository
  check already requires it.

## Design

### 1. Documentation bundle layout

The final working tree uses semantic directory names and follows the AlphaCI
OKF pattern. `index.md` files are navigation-only directory listings; typed
concept documents use YAML frontmatter; `log.md` is the bundle update history.

```text
docs/
├── index.md                         # canonical bundle landing
├── constitution.md                  # current executable documentation and architecture invariants
├── log.md                           # bundle update history
├── architecture/
│   ├── index.md
│   ├── current-architecture.md     # current runtime, apps, packages, backend contexts, kernel
│   ├── context-contracts.md        # public context surfaces and directional dependency rules
│   ├── fe-be-architecture-assessment.md
│   └── decisions/
│       ├── index.md
│       ├── adr-0001-role-app-boundaries.md
│       ├── adr-0002-shared-contracts-and-sample-compatibility.md
│       ├── adr-0003-ddd-modular-monolith-contexts.md
│       ├── adr-0004-cross-context-seams-and-read-models.md
│       └── adr-0005-next-route-and-feature-mvvm.md
├── product/
│   ├── index.md
│   ├── actual-system.md
│   ├── future-state.md
│   ├── feature-ledger.md
│   ├── evolution-governance.md
│   ├── redesign-inventory.md
│   ├── implementation-revisions.md
│   └── readiness-foundation.md
├── roadmap/
│   ├── index.md
│   └── architecture-priority-risk-matrix.md
├── runbooks/
│   ├── index.md
│   ├── docker-dev-testing.md
│   └── portal-accounts.md
└── reference/
    ├── index.md
    └── prism-v4/
        ├── index.md
        └── complete-feature-catalog.md
```

The existing `docs/architecture.md` and `docs/README.md` remain as very small
compatibility pointers to `architecture/index.md` and `index.md` respectively.
They are aliases, not alternate sources of truth. All active links and root
README links point to the semantic files.

### 2. Source migration map

| Current path | Final path | Treatment |
| --- | --- | --- |
| `docs/prism-v4/15-system-architecture.md` | `docs/architecture/current-architecture.md` | Move and rewrite metadata/links; current architecture source |
| `docs/prism-v4/11-feature-ledger.md` | `docs/product/feature-ledger.md` | Move and retain active feature decisions |
| `docs/prism-v4/10-product-evolution-and-redesign-governance.md` | `docs/product/evolution-governance.md` | Move and retain product decision rules |
| `docs/prism-v4/07-implemented-feature-revisions.md` | `docs/product/implementation-revisions.md` | Move and retain implementation reality/gaps |
| `docs/prism-v4/12-redesign-inventory.md` | `docs/product/redesign-inventory.md` | Move and retain route/severity/owner inventory |
| `docs/prism-v4/14-redesign-readiness-foundation.md` | `docs/product/readiness-foundation.md` | Move and retain contract and readiness gates |
| `docs/prism-v4/16-actual-system.md` | `docs/product/actual-system.md` | Move and update current-state links |
| `docs/prism-v4/18-future-state.md` | `docs/product/future-state.md` | Move and mark target-state content clearly |
| `docs/prism-v4/01-complete-feature-catalog.md` | `docs/reference/prism-v4/complete-feature-catalog.md` | Preserve as source/reference; do not treat as current scope authority |
| `docs/prism-v4/00-index.md` | `docs/reference/prism-v4/index.md` | Rewrite as reference navigation |
| `docs/prism-v4/13-docs-cleanup-checklist.md` | `docs/constitution.md` | Promote current documentation rules and retirement policy |
| `docs/README.md` | `docs/index.md` | Promote to canonical OKF bundle landing; replace old path with pointer |
| `docs/portal-accounts.md` | `docs/runbooks/portal-accounts.md` | Move to operating procedure area |
| `docs/docker-dev-testing-guide.md` | `docs/runbooks/docker-dev-testing.md` | Move to operating procedure area |
| `docs/reviews/2026-09-01-fe-be-architecture-alignment.md` | `docs/architecture/fe-be-architecture-assessment.md` | Promote durable findings; remove date/branch/session framing |
| `docs/reviews/2026-09-01-fe-be-priority-risk-matrix.md` | `docs/roadmap/architecture-priority-risk-matrix.md` | Promote active sequence/risk/dependency matrix; remove branch framing |
| `docs/reviews/2026-09-01-be-ddd-consolidation-design.md` | architecture + ADR-0003 | Promote final decisions and evidence; remove duplicate review artifact |
| `docs/superpowers/plans/2026-09-01-fe-be-architecture-alignment.md` | roadmap + architecture assessment + ADRs | Promote durable constraints and follow-up items; remove completed execution plan |
| `docs/superpowers/plans/feature-architecture-mvvm.md` | ADR-0005 + roadmap | Promote accepted FE pattern and future waves; remove old plan |

No final document may refer to a removed plan as an active authority. A brief
historical note may say that earlier artifacts were promoted and removed, with
Git history as the recovery mechanism.

### 3. Canonical authorities

The final bundle uses the following authority order:

1. `AGENTS.md` — agent safety, repository commands, ownership, and hard rules.
2. `docs/constitution.md` — current cross-cutting invariants and documentation
   contract; it must agree with `AGENTS.md`.
3. `docs/architecture/current-architecture.md` — current runtime and ownership
   map.
4. `docs/architecture/decisions/` — accepted decisions and their consequences.
5. `docs/product/feature-ledger.md` — active product-family decisions.
6. `docs/roadmap/architecture-priority-risk-matrix.md` — sequenced follow-up
   work, dependencies, risks, and evidence required for closure.
7. `docs/reference/prism-v4/` — source-preserving historical catalog only.

The report/assessment is evidence and interpretation, not a replacement for
the architecture or ADRs. The roadmap is an active delivery aid, not permission
to change behavior without a feature-specific design and review.

### 4. OKF document contract

Every non-index Markdown concept under `docs/` uses this frontmatter shape:

```yaml
---
type: "Architecture Reference"
title: "Human-readable title"
description: "One-sentence purpose"
tags: [architecture]
status: stable
updated: "2026-09-01"
sources:
  - id: source-id
    resource: "repo-relative/path"
    title: "Source title"
---
```

Allowed statuses are `draft`, `review`, `stable`, `active`, `deprecated`, and
`reference`. `updated` is the content date, not a branch date. Sources use
repository-relative paths or durable external references only when the source
cannot be checked into Prism. Dated branch names, chat phrasing, and absolute
developer-machine paths are not allowed in final living docs.

Each directory index lists only the concepts in that directory and gives a
one-line use description. The bundle landing explains the reading order:
constitution → architecture → decisions → product → roadmap → runbooks →
reference. `docs/log.md` records structural or contract-level updates with the
date and affected areas.

### 5. ADR format

Each ADR contains:

- YAML frontmatter with `type: "Decision"`, title, description, tags, status,
  date, and source paths;
- decision date, status, and scope;
- context/problem;
- accepted decision;
- rejected alternatives;
- consequences and migration constraints;
- verification commands or evidence.

The five ADRs are deliberately concise and describe current accepted decisions,
not unfinished implementation checklists. Future changes update or supersede
an ADR rather than adding another copy of the same rule.

### 6. Documentation retirement policy

The final tree removes `docs/superpowers/plans/*` and dated `docs/reviews/*`
after promotion. This is safe because Git history retains the originals and
the final canonical documents carry their durable content. New execution plans
may be created only for an approved multi-step change, must be temporary, and
must be removed or promoted when the work closes. A plan cannot be cited as a
current source after completion.

The V4 catalog is intentionally retained under `docs/reference/` because it is
source-preserving manuscript/defense material. It is labelled `reference` and
must not override current architecture, product, or implementation documents.

## Verification and acceptance

The migration is accepted only when all of the following are true:

1. `docs/index.md` and every directory index link to existing final paths.
2. Every final concept document has valid frontmatter, a clear status, and
   source paths that exist or are explicitly external.
3. `git ls-files docs/superpowers/plans docs/reviews` returns no files.
4. No tracked Markdown contains `apps/api/libs`, `libs/modules`, a dated branch
   name, or a link to a removed path.
5. `CLAUDE.md` is a pointer and does not duplicate `AGENTS.md`.
6. Root `README.md`, `AGENTS.md`, `CLAUDE.md`, and all docs cross-reference the
   semantic structure.
7. The current backend source tree, role-app boundaries, shared-contract rules,
   sample compatibility fence, read-model rule, and frontend route/MVVM rule
   are each represented by an ADR or constitution section.
8. `git diff --check` passes, repository documentation/link checks pass if
   available, and the existing code/boundary baseline remains unchanged.
9. The final commit is conventional, is pushed from the feature branch, and
   `git rev-parse HEAD` equals `git ls-remote` for that branch.

## Risks and controls

| Risk | Control |
| --- | --- |
| Internal links break during moves | Use a complete source-to-final map, search all tracked Markdown, and run a link/path checker before commit. |
| Durable findings are lost with removed plans | Promote content into named canonical docs before deletion; verify each mapping row. |
| Two architecture sources drift | Keep `current-architecture.md` and ADR index as the only architecture authorities; leave aliases as pointers only. |
| OKF metadata becomes decorative | Validate required frontmatter fields and source paths with a repository script or deterministic audit command. |
| Historical catalog is mistaken for current scope | Place it under `reference/prism-v4`, label it `reference`, and explain precedence in `constitution.md` and `docs/index.md`. |
| Documentation migration changes product behavior | Restrict the diff to Markdown and required docs links/metadata; run code status and boundary checks to prove no source changes. |

## Design decision

Use the hybrid semantic OKF migration described above. It adopts AlphaCI's
portable bundle mechanics and ADR/runbook discipline, preserves Prism's
source-preserving catalog, promotes the current architecture assessment and
risk matrix into durable locations, and removes only duplicated or completed
working artifacts after their content is represented elsewhere.
