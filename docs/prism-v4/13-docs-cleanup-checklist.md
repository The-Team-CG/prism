# P.R.I.S.M Documentation Cleanup Checklist

Last updated: 2026-06-11

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
| `docs/superpowers/specs/2026-06-11-prism-capability-maturity-plan-design.md` | Active | Whole-app redesign and capability maturity plan. |

## Files To Keep

| Path | Reason |
| --- | --- |
| `docs/prism-v4/02-system-behaviors.md` | Source-preserving behavior rules and AI-related automatic behavior notes. |
| `docs/prism-v4/03-ai-features-and-security.md` | AI/security summary for review and defense. |
| `docs/prism-v4/04-implementation-plan.md` | Catalog-to-build mapping, still useful for traceability. |
| `docs/prism-v4/05-prism-defense-demo-guide.md` | Defense/demo story and fallback evidence. |
| `docs/prism-v4/06-chapter-3-cross-reference.md` | Manuscript mapping. |
| `docs/prism-v4/08-revision-phase-plan.md` | Historical revision-first roadmap. |
| `docs/prism-v4/09-defense-demo-runbook.md` | Local defense rehearsal runbook. |
| `docs/prism-v4/features/*.md` | Persona-specific source slices from the catalog. |
| `docs/prism-v4/page-screenshots/2026-05-07/*` | Visual evidence snapshot. Keep until replaced by a newer verified screenshot set. |

## Retired Or Removed Files

| Path | Decision | Reason |
| --- | --- | --- |
| May 2026 UI modernization Phase 2 plan | Removed | Its deliverables now exist, but it still reads as an unchecked implementation plan. Future UI work belongs in the active capability maturity plan plus `11-feature-ledger.md` and `12-redesign-inventory.md`. |
| June 2026 architecture hardening plan | Removed | Stale old-name planning artifact. |
| Root `Prism-CHECKLIST.md`, `prism-strategy.md`, `prism-feature-list.md`, `DESIGN.md` | Removed earlier | Superseded by `docs/prism-v4`. |

## Cleanup Rules

1. Keep one active plan for the whole redesign: `docs/superpowers/specs/2026-06-11-prism-capability-maturity-plan-design.md`.
2. Do not create a new `docs/superpowers/plans/*` file unless it is a short-lived execution plan for an approved phase.
3. When a plan is completed, either convert it into a closeout note inside the active docs or remove it.
4. Do not keep unchecked implementation checklists after the implementation exists.
5. Do not duplicate `AGENTS.md` into `CLAUDE.md`; `CLAUDE.md` must remain a symlink.
6. Keep `00-index.md` and `MANIFEST.md` updated when adding governing docs.
7. Preserve catalog and manuscript docs even when feature decisions change.
8. Remove docs that contradict role-specific app boundaries.
9. Rewrite docs that imply `apps/client` is an all-role PMCM shell.
10. Keep public pages and signed-in dashboard boundaries explicit in docs.

## Verification Commands

Run these after documentation cleanup:

```bash
git status --short --branch
git ls-files -s CLAUDE.md AGENTS.md
rg -n -i "old-name-token-one|old-name-token-two" docs/prism-v4 docs/superpowers README.md AGENTS.md
Test-Path docs/superpowers/plans
rg -n "10-product-evolution|11-feature-ledger|12-redesign-inventory|13-docs-cleanup-checklist" docs/prism-v4 README.md AGENTS.md
git diff --check
```

Expected:

- `CLAUDE.md` is mode `120000` and targets `AGENTS.md`.
- No stale old-name terms appear in active docs.
- `docs/superpowers/plans` does not exist unless a short-lived approved execution plan is active.
- New governing docs are linked from the index and manifest.
- Working tree contains only intentional changes before commit.
