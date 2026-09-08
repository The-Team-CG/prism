# Parallel worktrees

Two linked worktrees could not run the stack at the same time. Every portal had
its port written into `apps/<portal>/package.json`, and the port guard identifies
its target by matching argv substrings such as `next dev --port 3001`. A second
worktree therefore started on the first worktree's port, matched its markers, and
killed it.

## Ports follow the checkout

`scripts/prism-ports.mjs` resolves ports from the checkout instead of a literal.
The primary checkout keeps the canonical ports, so nothing changes for ordinary
work. A linked worktree derives a stable offset from its own path, in steps of
ten, so its whole stack moves together and no two surfaces collide.

```bash
npm run ports                 # print this checkout's ports, CORS origin, and API URL
```

`PRISM_PORT_OFFSET` overrides the derived offset, including back to `0`, and
`PRISM_<APP>_PORT` pins one surface. The port guard now refuses to stop a process
whose argv points at a different checkout, so an explicit override cannot make one
worktree kill another.

## Creating and removing a worktree

```bash
npm run worktree:create -- <name> [base]   # add .worktrees/<name> on codex/<name>
npm run worktree:setup                     # prepare the worktree you are standing in
npm run worktree:remove -- <name>          # junction-safe teardown
```

Setup seeds `apps/api/.env` and each portal `.env.local` from the primary checkout
(falling back to the committed examples), then writes that worktree's `PORT`,
`CORS_ORIGIN`, and `NEXT_PUBLIC_API_URL`. Dependencies are not installed for you;
run the install yourself in the new worktree.

## Why removal is not a recursive delete

A worktree's `node_modules` is a tree of junctions pointing into the primary
checkout's real dependencies. Recursively deleting the worktree can follow those
junctions and destroy the shared tree. Removal unlinks every reparse point first,
deletes only what remains, and refuses any path that is not inside `.worktrees`.
`scripts/prism-worktree.test.mjs` proves a linked dependency file survives.
