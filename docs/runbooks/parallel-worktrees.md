# Parallel worktrees

Two linked worktrees could not run the stack at the same time. Port assignments
are now persisted in shared Git metadata, and the port guard uses a durable
checkout lease with the process PID and creation identity. An unproven process is
preserved for manual cleanup.

## Ports follow the checkout

`scripts/prism-ports.mjs` resolves ports from the checkout instead of a literal.
The primary checkout keeps the canonical ports, so nothing changes for ordinary
work. Linked worktrees receive collision-free offsets in steps of ten. The
assignment file prunes worktrees that no longer exist and refuses to resolve
ports when Git enumeration or slot capacity is unavailable.

```bash
npm run ports                 # print this checkout's ports, CORS origin, and API URL
```

`PRISM_PORT_OFFSET` overrides the assigned offset, including back to `0`, and
`PRISM_<APP>_PORT` pins one surface. The port guard only stops a process with a
matching lease and process creation identity; it does not use a global Node
fallback when evidence is missing.

## Creating and removing a worktree

```bash
npm run worktree:create -- <name> [base]   # add .worktrees/<name> on codex/<name>
npm run worktree:setup                     # prepare the worktree you are standing in
npm run worktree:remove -- <name>          # junction-safe teardown
```

Setup seeds `apps/api/.env` and each portal `.env.local` from the committed
examples, then writes that worktree's `PORT`, `CORS_ORIGIN`, and
`NEXT_PUBLIC_API_URL`. To intentionally copy the primary checkout's local
database credentials, pass `--copy-local-env`; setup prints an explicit warning
when it does so. Dependencies are not installed for you; run the install yourself
in the new worktree.

Linked worktrees use local Node processes. Docker Compose exposes the canonical
primary-checkout ports, so `start-prism.ps1 -Docker` fails clearly from a linked
worktree instead of starting a colliding stack.

## Why removal is not a recursive delete

A worktree's `node_modules` is a tree of junctions pointing into the primary
checkout's real dependencies. Recursively deleting the worktree can follow those
junctions and destroy the shared tree. Removal unlinks every reparse point first,
deletes only what remains, and refuses any path that is not inside `.worktrees`.
`scripts/prism-worktree.test.mjs` proves a linked dependency file survives.
