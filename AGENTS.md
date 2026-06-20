# P.R.I.S.M Agent Notes

These notes preserve the product boundaries established by the project docs and the current Prism direction.

## Product Truths

- P.R.I.S.M is PMCM's internal event operating system for Ms. Mys and her team. It is not a generic SaaS and not a public multi-tenant product.
- The current feature baseline is `docs/prism-v4/01-complete-feature-catalog.md`; it is preserved for traceability and manuscript/defense counts, not as a hard ceiling.
- The current implementation/revision source is `docs/prism-v4/07-implemented-feature-revisions.md`.
- The current product evolution rules are `docs/prism-v4/10-product-evolution-and-redesign-governance.md`.
- The current feature decision ledger is `docs/prism-v4/11-feature-ledger.md`.
- The current whole-app redesign inventory is `docs/prism-v4/12-redesign-inventory.md`.
- The current documentation cleanup checklist is `docs/prism-v4/13-docs-cleanup-checklist.md`.
- The current redesign readiness handoff contract is `docs/prism-v4/14-redesign-readiness-foundation.md`.
- The current whole-app redesign plan is `docs/superpowers/specs/2026-06-11-prism-capability-maturity-plan-design.md`.
- The current sprint execution calendar is `docs/superpowers/plans/2026-06-15-prism-redesign-agile-calendar.md`.
- The current system completion review and confidence gate audit is `docs/superpowers/plans/2026-06-20-prism-system-completion-review.md`.
- The maturity plan defines explicit system goals for Owner A (Maxine), Owner B (Francis), Owner C (Ethan), and Owner D (Anthony). Do not treat owners as loose assignees; every redesign or capability branch should state which owner system goal it advances.
- The historical revision roadmap is `docs/prism-v4/08-revision-phase-plan.md`.
- The supporting root docs are `README.md` and `AGENTS.md`; `CLAUDE.md` is a symlink to `AGENTS.md`.
- The lifecycle is inquiry -> conforme -> briefing/proposal -> planning -> event day -> closure/archive.
- Event creation and client portal access are gated by accepted inquiry plus signed conforme.
- Dashboards are signed-in surfaces. Public pages are landing and inquiry only.

## App Boundaries

- `apps/client` is the client-facing portal on port `3001`.
- `apps/event` is the PMCM(admin)/coordinator event command app on port `3004`.
- `apps/supplier` is the supplier portal on port `3002`.
- `apps/guest` is the guest portal on port `3003`.
- `apps/api` is the shared NestJS API on port `4000`.
- Do not rebuild `apps/client` as an all-role PMCM shell. The old Prism docs called that temporary; the current boundary is role-specific apps.

## Floorplan Rule

- Clients can manage official floorplans from the dashboard.
- Official floorplans are managed from the selected event workspace in `apps/event`.
- Clients submit guided layout preferences inside a confirmed event.
- PMCM can edit the real floorplan and controls submit/approve workflow in `apps/event`.
- Client users only see submitted/approved official layouts read-only.

## Implementation Defaults

- Keep one shared NestJS API in `apps/api` on port `4000`.
- Keep the existing canvas/editor internals intact when moving workflow ownership.
- Use API-backed sample auth/RBAC for now; no external auth provider in this pass.
- Treat `/api/sample/state` and local sample state as compatibility-only for seed/demo/reset paths; new role surfaces should use scoped APIs and typed contracts.
- Session and sample storage keys belong in `@prism/types`; do not add new app-local literal `prism:*` storage keys.
- Preserve existing uncommitted user work. Do not revert unrelated changes.

## Visual Rules

- Do not use active underline treatments in public or app header navigation.
- Do not add decorative eyebrow pills, rounded outline labels, or uppercase badge labels like `PMCM-led client planning`.
- Do not add that badge/eyebrow-pill treatment to event status cards, dashboard cards, landing pages, or mockup panels.
- Do not render a profile/avatar block in sidebars when the top bar already has the account/profile menu.
