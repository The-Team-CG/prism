# P.R.I.S.M Version 4 Documentation Index

Source: official PRISM V4 feature catalog (DOCX).  
**Docs landing:** [`../README.md`](../README.md).

This set keeps the Version 4 **baseline catalog** for manuscript/defense counts and the **living** redesign docs. The catalog is a baseline, not a hard ceiling. Day-to-day build truth is Tier 1 (plus root `AGENTS.md` / `README.md`).

Owners (system goals, not loose assignees): **A** Maxine (UX) · **B** Francis (PMCM ops) · **C** Ethan (external portals) · **D** Anthony (platform trust).

Living docs are **conversation-agnostic**: durable product and engineering truth only. Completed execution plans, owner session notes, and historical defense/plan artifacts were removed in the 2026-07 docs cleanup—recover from git history if needed.

## Official count summary

| Persona | V3 | V4 add | V4 total |
| --- | ---: | ---: | ---: |
| PMCM Admin | 67 | +10 AI | 77 |
| Client | 13 | 0 | 13 |
| Supplier | 13 | 0 | 13 |
| Coordinator | 7 | 0 | 7 |
| Guest | 5 | 0 | 5 |
| External / public | 8 | 0 | 8 |
| Security | 4 | 0 | 4 |
| Numbered features | 117 | +10 | 127 |
| System behaviors | 31 | +6 | 37 |
| **Grand total** | **148** | **+16** | **164** |

---

## Living (Tier 1) — build from these

| Document | Path | Use |
| --- | --- | --- |
| System architecture | [./15-system-architecture.md](./15-system-architecture.md) | Apps, API modules, packages, boundaries, stop rules |
| Feature ledger | [./11-feature-ledger.md](./11-feature-ledger.md) | Feature-family decisions, ownership, verification |
| Product evolution governance | [./10-product-evolution-and-redesign-governance.md](./10-product-evolution-and-redesign-governance.md) | Add / revise / merge / defer / retire |
| Redesign readiness | [./14-redesign-readiness-foundation.md](./14-redesign-readiness-foundation.md) | Sample-state fencing, session keys, owner boundaries |
| Implemented revisions | [./07-implemented-feature-revisions.md](./07-implemented-feature-revisions.md) | Implementation reality and gaps |
| Redesign inventory | [./12-redesign-inventory.md](./12-redesign-inventory.md) | Routes × severity × role apps |
| Docs cleanup checklist | [./13-docs-cleanup-checklist.md](./13-docs-cleanup-checklist.md) | Hygiene rules |

**Ops:** [`../portal-accounts.md`](../portal-accounts.md), [`../docker-dev-testing-guide.md`](../docker-dev-testing-guide.md). Architecture alias: [`../architecture.md`](../architecture.md).

---

## Narrative (Tier 2)

| Document | Path | Use |
| --- | --- | --- |
| Actual system | [./16-actual-system.md](./16-actual-system.md) | Actors, lifecycle, workflows, ownership |
| Future state | [./18-future-state.md](./18-future-state.md) | Target state |

---

## Baseline catalog (Tier 3)

| Document | Path | Use |
| --- | --- | --- |
| Complete catalog | [./01-complete-feature-catalog.md](./01-complete-feature-catalog.md) | Source-preserving catalog tables; manuscript/defense counts |

### Recommended reading order

1. `AGENTS.md` + root `README.md` for day-to-day work  
2. `15` + `11` + `07` for architecture and what ships next  
3. `01` when panel or manuscript needs original scope counts  
