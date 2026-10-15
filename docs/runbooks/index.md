# Runbooks

* [Docker development and testing](docker-dev-testing.md) - local Docker modes, ports, environment files, and troubleshooting.
* [Database migrations](database-migrations.md) - Prisma migration ownership, preflight, deployment, drift diagnosis, and recovery.
* [Pre-production schema baseline adoption](domain-schema-cutover.md) - local replay and backup-gated staging database rebuild guidance.
* [Audit-chain repair](audit-chain-repair.md) - backup-gated, single-chain rehashing for preproduction JSONB hash-order corruption.
* [Database roles and audit privileges](database-privileges.md) - intended runtime, migration and maintenance privileges, append-only audit evidence, and the queries that verify real grants.
* [Parallel worktrees](parallel-worktrees.md) - checkout-derived dev ports and junction-safe worktree teardown.
* [Portal accounts](portal-accounts.md) - local fixture accounts and role-boundary notes.
* [Deployment secrets](deployment-secrets.md) - GitHub Actions secrets, variables, provider targets, and deployment verification.
* [Vercel services](vercel-services.md) - proposed single-project service routes, API bindings, builds and operational limits.
* [AI provider routing](ai-provider-routing.md) - local provider/model selection, synthetic-only limits, and production gates.

Runbooks describe current procedures and required evidence. They do not
authorize destructive database actions or imply staging/production deployment.
