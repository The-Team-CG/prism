# P.R.I.S.M Agent Notes

These notes preserve the product boundaries established by the project docs and the current MVP direction.

## Product Truths

- P.R.I.S.M is PMCM's internal event operating system for Ms. Mys and her team. It is not a generic SaaS and not a public multi-tenant product.
- The current feature source of truth is `docs/prism-v4/01-complete-feature-catalog.md`.
- The current implementation/revision source is `docs/prism-v4/07-implemented-feature-revisions.md`.
- The current phase roadmap is `docs/prism-v4/08-revision-phase-plan.md`.
- The supporting root docs are `README.md`, `CLAUDE.md`, and `AGENTS.md`.
- The lifecycle is inquiry -> conforme -> briefing/proposal -> planning -> event day -> closure/archive.
- Event creation and client portal access are gated by accepted inquiry plus signed conforme.
- Dashboards are signed-in surfaces. Public pages are landing and inquiry only.

## App Boundaries

- `apps/client` is the client-facing portal on port `3001`.
- `apps/event` is the PMCM(admin)/coordinator event command app on port `3004`.
- `apps/supplier` is the supplier portal on port `3002`.
- `apps/guest` is the guest portal on port `3003`.
- `apps/api` is the shared NestJS API on port `4000`.
- Do not rebuild `apps/client` as an all-role PMCM shell. The old MVP docs called that temporary; the current boundary is role-specific apps.

## Floorplan Rule

- Clients do not manage official floorplans from the dashboard.
- Official floorplans are managed from the selected event workspace in `apps/event`.
- Clients submit guided layout preferences inside a confirmed event.
- PMCM can edit the real floorplan and controls submit/approve workflow in `prism-event`.
- Client users only see submitted/approved official layouts read-only.

## Implementation Defaults

- Keep one shared NestJS API in `apps/api` on port `4000`.
- Keep the existing canvas/editor internals intact when moving workflow ownership.
- Use API-backed demo auth/RBAC for now; no external auth provider in this pass.
- Preserve existing uncommitted user work. Do not revert unrelated changes.
