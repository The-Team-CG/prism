---
type: "Playbook"
title: "Parallel worktrees"
description: "Run Prism checkouts concurrently with isolated ports and safe linked-worktree setup and removal."
tags: [runbook, git, worktrees, local-development]
status: canonical
updated: "2026-10-06"
authority: operational
owner: "D (Anthony)"
audience: [developers, agents]
scope: "Prism linked worktree ports, environment setup, and safe removal"
last_verified: "2026-10-06; referenced scripts and package commands reviewed; runtime behavior not rerun"
sources:
  - id: ports
    resource: "scripts/prism-ports.mjs"
    title: "Per-worktree port assignment"
  - id: worktree
    resource: "scripts/prism-worktree.mjs"
    title: "Worktree setup and removal"
  - id: worktree-tests
    resource: "scripts/prism-worktree.test.mjs"
    title: "Worktree safety behavior tests"
---
# Parallel worktrees

## At a glance

- **Purpose:** Run multiple Prism worktrees without port conflicts or unsafe cleanup.
- **Authority:** Operational guide for local linked worktrees.
- **Owner:** D (Anthony).
- **Scope:** Port allocation, environment preparation, local processes, and teardown.
- **Use when:** Creating or removing a linked worktree for concurrent development.
- **Change when:** Worktree or launcher scripts change.
- **Verify with:** The referenced scripts and focused worktree safety tests.

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

## Isolated local Supabase

Startup renders a local Supabase project under each checkout's `.local-dev`.
A hash of the normalized path and initial migration baseline identifies the project. Its database, Studio, gateway and
shadow ports use the persisted checkout slot in blocks of ten, independent of
app port overrides. Each checkout has separate schema/data. The primary uses
54322 for the DB and 54323 for Studio; linked worktrees add their assigned offset.
Normal stops preserve data and operate only on that checkout's project.
Removing a checkout does not automatically delete its retained Supabase data.

## Why removal is not a recursive delete

A worktree's `node_modules` is a tree of junctions pointing into the primary
checkout's real dependencies. Recursively deleting the worktree can follow those
junctions and destroy the shared tree. Removal unlinks every reparse point first,
deletes only what remains, and refuses any path that is not inside `.worktrees`.
`scripts/prism-worktree.test.mjs` proves a linked dependency file survives.
