# P.R.I.S.M Documentation Cleanup Checklist

Last updated: 2026-07-16

Keeps the docs set small, current, and executable. Full map: [`../README.md`](../README.md).

## Tiers (summary)

| Tier | What | Examples |
| --- | --- | --- |
| 0 | Always open | Root `AGENTS.md`, `README.md` |
| 1 | Living build truth | `15`, `11`, `10`, `14`, `07`, `12`, this checklist |
| 2 | Narrative | `16`, `18` |
| 3 | Baseline catalog | `01`, `00-index` |

## Canonical (living)

| File | Status | Role |
| --- | --- | --- |
| `AGENTS.md` | Canonical | Agent handbook |
| `CLAUDE.md` | Pointer | Must point at `AGENTS.md` only |
| `README.md` | Canonical | Human runbook |
| `docs/README.md` | Canonical | Docs tier landing |
| `docs/architecture.md` | Stub | Links to `15-system-architecture.md` |
| `docs/portal-accounts.md` | Ops | Sample logins |
| `docs/docker-dev-testing-guide.md` | Ops | Docker detail |
| `docs/prism-v4/00-index.md` | Index | Living vs baseline navigation |
| `docs/prism-v4/01-complete-feature-catalog.md` | Baseline | Catalog / defense counts |
| `docs/prism-v4/07-implemented-feature-revisions.md` | Living | Implementation reality |
| `docs/prism-v4/10-product-evolution-and-redesign-governance.md` | Living | Evolution rules |
| `docs/prism-v4/11-feature-ledger.md` | Living | Feature decisions |
| `docs/prism-v4/12-redesign-inventory.md` | Living | Route inventory |
| `docs/prism-v4/13-docs-cleanup-checklist.md` | Living | This file |
| `docs/prism-v4/14-redesign-readiness-foundation.md` | Living | Sample-state / session contract |
| `docs/prism-v4/15-system-architecture.md` | Living | **Architecture source of truth** |
| `docs/prism-v4/16-actual-system.md` | Narrative | Full system story |
| `docs/prism-v4/18-future-state.md` | Narrative | Target state |

## Retired (2026-07 aggressive cleanup)

| Path | Decision | Reason |
| --- | --- | --- |
| `docs/superpowers/**` | Removed | Completed plans/specs; owner goals live in `AGENTS.md` + living v4 docs |
| `docs/ethan/**` | Removed | Owner working notes, not product canon |
| Root `PRISM_Audits/`, `OwnerB_PRISM_StoryLogs/` | Removed | Session dumps; not living docs |
| `prism-v4/02`–`06`, `08`–`09`, `17` | Removed | Historical plan/defense/snapshot clutter |
| `prism-v4/features/*`, `page-screenshots/*`, `MANIFEST.md` | Removed | Persona slices and old screenshot evidence |
| `scripts/capture-prism-feature-pages.mjs` | Removed | Screenshot pipeline for deleted evidence set |
| `apps/api/scripts/db-setup.mjs`, `db-reset.mjs` | Removed | Orphaned; package scripts call Prisma directly |
| `apps/client/practice/*` | Removed | Practice-only files |

Recover any of the above from **git history** if needed for panel or forensics.

## Cleanup rules

1. **No long-lived `docs/superpowers/` tree.** Short execution plans only if explicitly approved; delete when done.
2. **No root-level audit dumps or story logs.** Promote findings into code, tests, or living docs (`11`, `15`, `07`) instead.
3. **No app-local competing product docs** that restate architecture or invent sample-state as the normal path.
4. Do not duplicate `AGENTS.md` into `CLAUDE.md`.
5. Keep `docs/README.md`, `00-index.md`, and this checklist updated when adding governing docs.
6. Preserve `01-complete-feature-catalog.md` for manuscript/defense counts; do not treat it as a hard ceiling.
7. Remove or rewrite docs that imply `apps/client` is an all-role PMCM shell.
8. Keep public vs signed-in dashboard boundaries explicit.
9. Sample-state guidance belongs in `14`; do not reintroduce `/api/sample/state` as a normal read path.
10. Session/storage keys belong in `@prism/types`; docs must not endorse new app-local `prism:*` keys.
11. Single architecture source: `15-system-architecture.md` (optional stub `docs/architecture.md` only).
12. Single feature-decision source: `11-feature-ledger.md`.
13. Do not keep unchecked implementation checklists after the work exists.
14. Owner labels must map to system goals (A Maxine / B Francis / C Ethan / D Anthony).

## Verification

```bash
git status --short --branch
git ls-files PRISM_Audits OwnerB_PRISM_StoryLogs docs/ethan docs/superpowers
git ls-files docs/prism-v4/04-implementation-plan.md docs/prism-v4/features docs/prism-v4/page-screenshots
git ls-files apps/client/practice scripts/capture-prism-feature-pages.mjs apps/api/scripts/db-setup.mjs apps/api/scripts/db-reset.mjs
# CLAUDE.md should point at AGENTS.md
rg -n "15-system-architecture|11-feature-ledger|docs/README" AGENTS.md README.md docs/README.md docs/prism-v4/00-index.md
rg -n "Owner system goal|Owner A|Owner B|Owner C|Owner D" AGENTS.md docs/prism-v4
```

Expected:

- Zero tracked files under retired paths above.
- Tier landing and architecture links resolve.
- Owner system goals remain discoverable from `AGENTS.md` and living docs.
- Working tree contains only intentional changes before commit.
