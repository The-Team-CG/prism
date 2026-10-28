---
okf_version: "0.2"
bundle: "P.R.I.S.M"
---
# P.R.I.S.M documentation bundle

This is the canonical documentation entrypoint. The bundle follows the Open
Knowledge Format (OKF) pattern:
directory `index.md` files are navigation, `log.md` records bundle changes, and
concept documents use YAML frontmatter with identity, authority,
scope, verification, and source/provenance entries.

## Reading order

1. [Constitution](constitution.md) — current invariants, authorities, and
   documentation rules.
2. [Architecture](architecture/index.md) — application ownership, backend
   contexts, seams, frontend structure, and accepted decisions.
3. [Product](product/index.md) — current system, product direction, feature
   decisions, readiness, and redesign evidence.
4. [Roadmap](roadmap/index.md) — active plans and explicit product/activation
   decisions.
5. [Runbooks](runbooks/index.md) — local operation, database migrations, Docker,
   and demo accounts.
6. [Reference](reference/index.md) — source-preserving V4 catalog material.

## Metadata at a glance

- `status: canonical` identifies a living source of truth; `active` identifies
  a maintained inventory or register; `reference` identifies preserved source
  material.
- `authority` distinguishes `normative` rules, `informative` models,
  `operational` procedures, and `reference` material.
- `audience`, `scope`, and `last_verified` explain who should read a document,
  what it covers, and which repository/source evidence was last checked.
  Developer assignment metadata is omitted; maintenance follows `AGENTS.md`.

## Repository entrypoints

For account lookup go directly to [portal accounts](runbooks/portal-accounts.md).
For environment identity, seed data, or migration history use
[environments and fixtures](runbooks/environments-and-fixtures.md).

| Concern | Source |
| --- | --- |
| Agent rules and ownership | [`../AGENTS.md`](../AGENTS.md) |
| Domain language | [../GLOSSARY.md](../GLOSSARY.md) |
| Human setup and commands | [`../README.md`](../README.md) |
| Release-visible change history | [`../CHANGELOG.md`](../CHANGELOG.md) |
| Bundle update history | [`log.md`](log.md) |

## Authority and maintenance

Current architecture is defined by
[`architecture/current-architecture.md`](architecture/current-architecture.md)
and its accepted ADRs. Product-family decisions live in
[`product/feature-ledger.md`](product/feature-ledger.md). The V4 catalog under
[`reference/prism-v4/`](reference/prism-v4/) preserves manuscript/defense
scope; it does not override current product or architecture documents.

Completed plans and dated review artifacts are not current authorities. Promote
their durable decisions into a concept, ADR, feature-ledger entry, or current
architecture record, then remove the working artifact; Git history preserves
the original evidence.
