#!/usr/bin/env node
/**
 * Resolves the dev/start ports for every P.R.I.S.M surface.
 *
 * The primary checkout always keeps the canonical ports (api 4000, client 3001,
 * supplier 3002, guest 3003, event 3004). Linked git worktrees derive a stable
 * offset from their own path so two worktrees can run the stack at the same
 * time instead of fighting over one port and killing each other's processes.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PRISM_BASE_PORTS = Object.freeze({
  api: 4000,
  client: 3001,
  supplier: 3002,
  guest: 3003,
  event: 3004,
});

export const PRISM_APPS = Object.freeze(Object.keys(PRISM_BASE_PORTS));
export const PRISM_PORTAL_APPS = Object.freeze(PRISM_APPS.filter((app) => app !== "api"));

/** Offsets step by 10 so no two surfaces can ever collide: the bases span 3001-4000. */
const OFFSET_STEP = 10;
/** 48 slots keeps the highest derived port (4480) well below the ephemeral range. */
const OFFSET_SLOTS = 48;

/** FNV-1a over a normalized path, so the same worktree always gets the same slot. */
export function hashWorktreePath(value) {
  const normalized = String(value ?? "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function isPrimaryCheckout({ gitDir, gitCommonDir }) {
  const normalize = (value) => path.resolve(String(value ?? ".")).replace(/\\/g, "/").toLowerCase();
  return normalize(gitDir) === normalize(gitCommonDir);
}

export function derivePortOffset({ worktreeRoot, isPrimary }) {
  if (isPrimary) return 0;
  return ((hashWorktreePath(worktreeRoot) % OFFSET_SLOTS) + 1) * OFFSET_STEP;
}

function readPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function resolvePortOffset({ env = {}, worktreeRoot, isPrimary }) {
  const explicit = Number(env.PRISM_PORT_OFFSET);
  if (Number.isInteger(explicit) && explicit >= 0) return explicit;
  return derivePortOffset({ worktreeRoot, isPrimary });
}

export function resolvePort(app, options = {}) {
  const base = PRISM_BASE_PORTS[app];
  if (base === undefined) throw new Error(`Unknown P.R.I.S.M app: ${app}`);
  const env = options.env ?? {};
  const override = readPositiveInteger(env[`PRISM_${app.toUpperCase()}_PORT`]);
  if (override !== undefined) return override;
  return base + resolvePortOffset({ ...options, env });
}

export function resolvePortSet(options = {}) {
  return Object.fromEntries(PRISM_APPS.map((app) => [app, resolvePort(app, options)]));
}

/** The API only accepts browser origins it is told about, so CORS follows the offset. */
export function corsOriginFor(ports) {
  return PRISM_PORTAL_APPS.map((app) => `http://localhost:${ports[app]}`).join(",");
}

export function apiUrlFor(ports) {
  return `http://localhost:${ports.api}`;
}

function gitValue(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/** Reads the live git layout. Falls back to "primary" when git is unavailable. */
export function describeCheckout(cwd = process.cwd()) {
  try {
    const worktreeRoot = gitValue(["rev-parse", "--show-toplevel"], cwd);
    const primary = isPrimaryCheckout({
      gitDir: path.resolve(worktreeRoot, gitValue(["rev-parse", "--git-dir"], cwd)),
      gitCommonDir: path.resolve(worktreeRoot, gitValue(["rev-parse", "--git-common-dir"], cwd)),
    });
    return { worktreeRoot, isPrimary: primary };
  } catch {
    return { worktreeRoot: path.resolve(cwd), isPrimary: true };
  }
}

export function resolveLivePortSet({ env = process.env, cwd = process.cwd() } = {}) {
  const checkout = describeCheckout(cwd);
  return { ...checkout, ports: resolvePortSet({ env, ...checkout }) };
}

function main() {
  const { worktreeRoot, isPrimary, ports } = resolveLivePortSet();
  const label = isPrimary ? "primary checkout" : "linked worktree";
  console.log(`[prism-ports] ${label}: ${worktreeRoot}`);
  for (const app of PRISM_APPS) console.log(`[prism-ports]   ${app.padEnd(9)} ${ports[app]}`);
  console.log(`[prism-ports] CORS_ORIGIN=${corsOriginFor(ports)}`);
  console.log(`[prism-ports] NEXT_PUBLIC_API_URL=${apiUrlFor(ports)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
