# P.R.I.S.M docs

Open **Tier 0–1** for normal work. Narrative and baseline catalog are optional depth.

## Tier 0 — always

| Doc | Role |
| --- | --- |
| [`../AGENTS.md`](../AGENTS.md) | Agent handbook (boundaries, commands, Zod, stop rules) |
| [`../README.md`](../README.md) | Human runbook (install, Docker, ports) |

## Tier 1 — living (build from these)

| Doc | Role |
| --- | --- |
| [`architecture.md`](architecture.md) → [`prism-v4/15-system-architecture.md`](prism-v4/15-system-architecture.md) | **Architecture** (apps, API modules, packages, stop rules) |
| [`prism-v4/11-feature-ledger.md`](prism-v4/11-feature-ledger.md) | Feature-family decisions and verification |
| [`prism-v4/10-product-evolution-and-redesign-governance.md`](prism-v4/10-product-evolution-and-redesign-governance.md) | Add / revise / merge / defer / retire |
| [`prism-v4/14-redesign-readiness-foundation.md`](prism-v4/14-redesign-readiness-foundation.md) | Sample-state fencing, session keys, owner boundaries |
| [`prism-v4/07-implemented-feature-revisions.md`](prism-v4/07-implemented-feature-revisions.md) | Implementation reality vs gaps |
| [`prism-v4/12-redesign-inventory.md`](prism-v4/12-redesign-inventory.md) | Routes × severity × role app |
| [`prism-v4/13-docs-cleanup-checklist.md`](prism-v4/13-docs-cleanup-checklist.md) | Doc hygiene rules |
| [`portal-accounts.md`](portal-accounts.md) | Sample logins |
| [`docker-dev-testing-guide.md`](docker-dev-testing-guide.md) | Docker detail beyond root README |

Do **not** add long-lived files under `docs/superpowers/`. Short execution plans, if ever needed, must be deleted when done (git history keeps them).

Living docs are **conversation-agnostic**: durable product and engineering truth only—no chat handoffs, session diaries, or deleted-plan references as if still active.

## Tier 2 — narrative (onboarding / depth)

| Doc | Role |
| --- | --- |
| [`prism-v4/16-actual-system.md`](prism-v4/16-actual-system.md) | Actors, lifecycle, workflows |
| [`prism-v4/18-future-state.md`](prism-v4/18-future-state.md) | Target state |

## Tier 3 — baseline catalog (preserve, rarely edit)

| Doc | Role |
| --- | --- |
| [`prism-v4/01-complete-feature-catalog.md`](prism-v4/01-complete-feature-catalog.md) | Manuscript / defense counts; baseline inventory, not a hard ceiling |
| [`prism-v4/00-index.md`](prism-v4/00-index.md) | Slim v4 navigation |

## Single sources of truth

| Concern | Doc |
| --- | --- |
| Agents | `AGENTS.md` |
| Architecture | `prism-v4/15-system-architecture.md` |
| Feature decisions | `prism-v4/11-feature-ledger.md` |
| Product evolution rules | `prism-v4/10-product-evolution-and-redesign-governance.md` |
