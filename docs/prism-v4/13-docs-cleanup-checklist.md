# P.R.I.S.M Documentation Cleanup Checklist

Last updated: 2026-06-20

This checklist keeps the docs set small, current, and executable. It is the Phase 0 documentation hygiene output from the whole-app capability maturity plan.

## Canonical Documents

| File | Status | Role |
| --- | --- | --- |
| `AGENTS.md` | Canonical | Root agent/product instruction file. |
| `CLAUDE.md` | Symlink | Points to `AGENTS.md`; do not edit separately. |
| `README.md` | Canonical overview | Human entrypoint for repo layout, commands, and current docs. |
| `docs/prism-v4/00-index.md` | Canonical docs index | Navigation for the v4 docs set. |
| `docs/prism-v4/01-complete-feature-catalog.md` | Preserve | Baseline catalog and official manuscript/defense counts. |
| `docs/prism-v4/07-implemented-feature-revisions.md` | Active | Current implementation reality and backlog. |
| `docs/prism-v4/10-product-evolution-and-redesign-governance.md` | Active | Rules for product evolution. |
| `docs/prism-v4/11-feature-ledger.md` | Active | Feature-family decisions for the redesign. |
| `docs/prism-v4/12-redesign-inventory.md` | Active | Route/app redesign severity and ownership. |
| `docs/prism-v4/13-docs-cleanup-checklist.md` | Active | Documentation hygiene rules. |
| `docs/prism-v4/14-redesign-readiness-foundation.md` | Active | Handoff contract for sample-state fencing, session conventions, owner boundaries, and legacy removal before redesign branches. |
| `docs/prism-v4/15-system-architecture.md` | Active | Canonical role-app/API/package architecture, data domains, boundaries, and stop rules. |
| `docs/prism-v4/16-actual-system.md` | Active | Full P.R.I.S.M system details: actors, lifecycle, workflows, data ownership, feature families, and completion evidence. |
| `docs/prism-v4/17-current-state-2026-06-20.md` | Active | Dated current-state snapshot for June 20, 2026. |
| `docs/prism-v4/18-future-state.md` | Active | July 31 and post-July future-state target for full system completion. |
| `docs/superpowers/specs/2026-06-11-prism-capability-maturity-plan-design.md` | Active | Whole-app redesign and capability maturity plan, including explicit system goals for Owner A (Maxine), Owner B (Francis), Owner C (Ethan), and Owner D (Anthony). |
| `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md` | Active | Whole-system completion sprint calendar through July 31, 2026 with actionable work for Maxine, Francis, Ethan, and Anthony. |
| `docs/superpowers/plans/2026-06-20-prism-system-completion-review.md` | Active companion | Current-vs-target feature audit, confidence gates, missing completion tasks, and catalog traceability check for the July completion calendar. |
| `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md` | Active implementation plan | Anthony/Owner D backend modular-monolith path, July execution boundary, capability module contracts, and boundary-check guardrails. |

## Files To Keep

| Path | Reason |
| --- | --- |
| `docs/prism-v4/02-system-behaviors.md` | Source-preserving behavior rules and AI-related automatic behavior notes. |
| `docs/prism-v4/03-ai-features-and-security.md` | AI/security summary for review and defense. |
| `docs/prism-v4/04-implementation-plan.md` | Catalog-to-build mapping, still useful for traceability. |
| `docs/prism-v4/05-prism-defense-sample-guide.md` | Defense/sample story and fallback evidence. |
| `docs/prism-v4/06-chapter-3-cross-reference.md` | Manuscript mapping. |
| `docs/prism-v4/08-revision-phase-plan.md` | Historical revision-first roadmap. |
| `docs/prism-v4/09-defense-sample-runbook.md` | Local defense rehearsal runbook. |
| `docs/prism-v4/features/*.md` | Persona-specific source slices from the catalog. |
| `docs/prism-v4/page-screenshots/2026-05-07/*` | Visual evidence snapshot. Keep until replaced by a newer verified screenshot set. |

## Retired Or Removed Files

| Path | Decision | Reason |
| --- | --- | --- |
| May 2026 UI modernization Phase 2 plan | Removed | Its deliverables now exist, but it still reads as an unchecked implementation plan. Future UI work belongs in the active capability maturity plan plus `11-feature-ledger.md` and `12-redesign-inventory.md`. |
| June 2026 architecture hardening plan | Removed | Stale old-name planning artifact. |
| Root `Prism-CHECKLIST.md`, `prism-strategy.md`, `prism-feature-list.md`, `DESIGN.md` | Removed earlier | Superseded by `docs/prism-v4`. |
| `apps/api/README.md` | Removed | App-local module guidance described stale module boundaries and duplicated setup instructions that now belong in root `README.md` plus the active v4 docs. |
| `apps/event/docs/prism-feature-soundness-review.md` and `apps/event/docs/prism-maintainability-tech-debt-audit.md` | Removed | App-local snapshots were stale and competed with the current v4 docs, redesign inventory, and readiness foundation. |

## Cleanup Rules

1. Keep one active plan for the whole redesign: `docs/superpowers/specs/2026-06-11-prism-capability-maturity-plan-design.md`.
2. Do not create a new `docs/superpowers/plans/*` file unless it is a short-lived execution plan for an approved phase or an active companion review for the July 31 system-completion calendar; the active calendar is `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md` and its active completion review is `docs/superpowers/plans/2026-06-20-prism-system-completion-review.md`.
3. When a plan is completed, either convert it into a closeout note inside the active docs or remove it.
4. Do not keep unchecked implementation checklists after the implementation exists.
5. Do not duplicate `AGENTS.md` into `CLAUDE.md`; `CLAUDE.md` must remain a symlink.
6. Keep `00-index.md` and `MANIFEST.md` updated when adding governing docs.
7. Preserve catalog and manuscript docs even when feature decisions change.
8. Remove docs that contradict role-specific app boundaries.
9. Rewrite docs that imply `apps/client` is an all-role PMCM shell.
10. Keep public pages and signed-in dashboard boundaries explicit in docs.
11. Redesign or implementation plans must state which owner system goal they advance.
12. Owner labels must not be used as vague assignees; link them to the system goals in the maturity plan and the named owners Maxine, Francis, Ethan, and Anthony.
13. Sample-state guidance belongs in `14-redesign-readiness-foundation.md`; app-local docs should not reintroduce `/api/sample/state` as a normal read path.
14. Session/storage conventions belong in `@prism/types`; docs should not endorse app-local literal `prism:*` keys.

## Verification Commands

Run these after documentation cleanup:

```bash
git status --short --branch
git ls-files -s CLAUDE.md AGENTS.md
rg -n -i "old-name-token-one|old-name-token-two" docs/prism-v4 docs/superpowers README.md AGENTS.md
Test-Path docs/superpowers/plans
rg -n "10-product-evolution|11-feature-ledger|12-redesign-inventory|13-docs-cleanup-checklist|15-system-architecture|16-actual-system|17-current-state-2026-06-20|18-future-state" docs/prism-v4 README.md AGENTS.md
rg -n "Owner system goal|Owner System Goals|system goal" docs/prism-v4 docs/superpowers/specs README.md AGENTS.md
npm --workspace prism-api run db:doctor:runtime
git diff --check
```

Expected:

- `CLAUDE.md` is mode `120000` and targets `AGENTS.md`.
- No stale old-name terms appear in active docs.
- `docs/superpowers/plans` does not exist unless a short-lived approved execution plan is active.
- New governing docs are linked from the index and manifest.
- Owner system goals are discoverable from the active maturity plan and supporting docs.
- API-backed sample auth and sample-state compatibility paths have a valid database configuration, or failures return the documented service-unavailable guidance.
- Working tree contains only intentional changes before commit.
