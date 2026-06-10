# CLAUDE.md

## Project: P.R.I.S.M

P.R.I.S.M is PMCM's internal event operating system for Ms. Mys and her team. It is not a generic SaaS product. The current Prism boundary is role-specific portals plus one shared API.

Canonical feature and revision docs:

- `docs/prism-v4/01-complete-feature-catalog.md`: complete Version 4 feature list and official counts.
- `docs/prism-v4/04-implementation-plan.md`: feature-to-build mapping.
- `docs/prism-v4/05-prism-defense-demo-guide.md`: defense demo flow and evidence rules.
- `docs/prism-v4/07-implemented-feature-revisions.md`: implemented/partial features that need revisions and how to revise them.
- `docs/prism-v4/08-revision-phase-plan.md`: phase-by-phase revision roadmap.

## App Boundaries

- `apps/client`: client-facing portal on port `3001`.
- `apps/supplier`: supplier portal on port `3002`.
- `apps/guest`: guest portal on port `3003`.
- `apps/event`: PMCM admin and coordinator event command app on port `3004`.
- `apps/api`: shared NestJS API on port `4000`.
- `packages/ui`: shared shadcn command shell and dashboard primitives.
- `packages/tokens`: shared Prism UI tokens.
- `packages/api-client`: shared API request helpers.
- `packages/types`: shared interface types.

Use `start-prism.cmd` and `stop-prism.cmd` from `c:\Codes\prism` for local full-stack startup and shutdown.

## Product Truths

- The lifecycle is inquiry -> conforme -> briefing/proposal -> planning -> event day -> closure/archive.
- Public surfaces are landing and inquiry only.
- Dashboards are signed-in surfaces.
- Event creation and client portal access are gated by accepted inquiry plus signed conforme.
- Clients submit guided layout preferences inside confirmed events.
- PMCM owns official floorplan editing, supplier readiness, coordinator assignment, audit review, and event operations in `apps/event`.

## API Notes

- Keep one shared NestJS API in `apps/api`.
- Preserve existing API routes unless a task explicitly calls for a route change.
- `libs/modules/event-ops` is the PMCM event-operations module.
- `EventOpsService` currently acts as a facade/orchestrator while audit, supplier, and coordinator responsibilities are being extracted into smaller services.
- Demo data should be seeded during non-production startup or explicit demo seed/reset actions, not during normal read/list requests.

## Implementation Defaults

- Preserve role-specific portal boundaries. Do not rebuild `apps/client` as an all-role PMCM shell.
- Preserve existing uncommitted user work. Do not revert unrelated changes.
- Keep current editor internals intact when moving workflow ownership.
- Use API-backed demo auth/RBAC for now; do not introduce an external auth provider in this pass.

## Verification

For `apps/api`:

```bash
npm run test:event-ops
npm run typecheck
npm run build
npm run prisma:validate
```

For `apps/event`:

```bash
npm run build
```

Root workspace gates:

```bash
npm run typecheck
npm run build
```
