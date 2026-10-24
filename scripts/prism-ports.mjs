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
import crypto from "node:crypto";
import fs from "node:fs";
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
const SLOT_METADATA_FILE = "prism-port-slots.json";

function resolveWorktreePath(value) {
  const raw = String(value).trim();
  return /^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith("\\\\")
    ? path.win32.resolve(raw)
    : path.resolve(raw);
}

export function normalizeWorktreePath(value) {
  const raw = String(value ?? "").trim();
  return raw ? resolveWorktreePath(raw).replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/\/$/, "").toLowerCase() : "";
}

/** FNV-1a over a normalized path, so the same worktree always gets the same slot. */
export function hashWorktreePath(value) {
  const normalized = normalizeWorktreePath(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function isPrimaryCheckout({ gitDir, gitCommonDir }) {
  return normalizeWorktreePath(gitDir ?? ".") === normalizeWorktreePath(gitCommonDir ?? ".");
}

export function derivePortOffset({ worktreeRoot, isPrimary }) {
  if (isPrimary) return 0;
  return ((hashWorktreePath(worktreeRoot) % OFFSET_SLOTS) + 1) * OFFSET_STEP;
}

/** Assigns each existing linked worktree a deterministic, collision-free slot. */
export function assignPortSlots(worktreePaths, previousAssignments = {}) {
  const normalizedPaths = [...new Set(worktreePaths.map(normalizeWorktreePath).filter(Boolean))].sort();
  const assignments = {};
  const used = new Set();

  for (const worktreePath of normalizedPaths) {
    const prior = Number(previousAssignments[worktreePath]);
    if (Number.isInteger(prior) && prior > 0 && prior <= OFFSET_SLOTS && !used.has(prior)) {
      assignments[worktreePath] = prior;
      used.add(prior);
    }
  }
  for (const worktreePath of normalizedPaths) {
    if (assignments[worktreePath]) continue;
    const preferred = (hashWorktreePath(worktreePath) % OFFSET_SLOTS) + 1;
    let slot = preferred;
    for (let attempts = 0; attempts < OFFSET_SLOTS && used.has(slot); attempts += 1) {
      slot = (slot % OFFSET_SLOTS) + 1;
    }
    if (used.has(slot)) throw new Error(`No free P.R.I.S.M port slot for ${worktreePath}`);
    assignments[worktreePath] = slot;
    used.add(slot);
  }
  return assignments;
}

function readPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function resolvePortOffset({ env = {}, worktreeRoot, isPrimary, worktreeSlot }) {
  const explicit = Number(env.PRISM_PORT_OFFSET);
  if (Number.isInteger(explicit) && explicit >= 0) return explicit;
  if (!isPrimary && Number.isInteger(worktreeSlot) && worktreeSlot > 0) {
    return worktreeSlot * OFFSET_STEP;
  }
  return derivePortOffset({ worktreeRoot, isPrimary });
}

export function resolvePort(app, options = {}) {
  const base = PRISM_BASE_PORTS[app];
  if (base === undefined) throw new Error(`Unknown P.R.I.S.M app: ${app}`);
  const env = options.env ?? {};
  const explicitValue = env[`PRISM_${app.toUpperCase()}_PORT`] ?? (app === "api" ? env.PORT : undefined);
  const override = readPositiveInteger(explicitValue);
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

/** Each portal's browser-facing origin on the live port set. The API reads the client, supplier and event origins as PRISM_*_PORTAL_URL. */
export function portalUrlsFor(ports) {
  return Object.fromEntries(PRISM_PORTAL_APPS.map((app) => [
    `NEXT_PUBLIC_${app.toUpperCase()}_PORTAL_URL`,
    `http://localhost:${ports[app]}`,
  ]));
}

function gitValue(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

export function listWorktreePaths(cwd = process.cwd()) {
  const output = gitValue(["worktree", "list", "--porcelain"], cwd);
  return parseWorktreeList(output);
}

export function parseWorktreeList(output, exists = (candidate) => fs.existsSync(candidate)) {
  return String(output)
    .split(/\r?\n\s*\r?\n/)
    .map((block) => {
      if (/^prunable(?:\s.*)?$/m.test(block)) return "";
      const match = block.match(/^worktree\s+(.+)$/m);
      if (!match) return "";
      const candidate = resolveWorktreePath(match[1]);
      return exists(candidate) ? candidate : "";
    })
    .filter(Boolean);
}

function sleepBriefly() {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
}

function withMetadataLock(metadataPath, callback) {
  const lockPath = `${metadataPath}.lock`;
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
  let handle;
  for (let attempt = 0; attempt < 200 && !handle; attempt += 1) {
    try {
      handle = fs.openSync(lockPath, "wx");
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        if (Date.now() - fs.statSync(lockPath).mtimeMs > 30_000) fs.rmSync(lockPath, { force: true });
      } catch {
        // Another writer may be replacing the lock.
      }
      sleepBriefly();
    }
  }
  if (!handle) throw new Error(`Timed out acquiring port metadata lock ${lockPath}`);
  try {
    return callback();
  } finally {
    fs.closeSync(handle);
    fs.rmSync(lockPath, { force: true });
  }
}

function reconcilePortSlots(commonDir, linkedPaths) {
  const metadataPath = path.join(commonDir, SLOT_METADATA_FILE);
  return withMetadataLock(metadataPath, () => {
    let previous = {};
    if (fs.existsSync(metadataPath)) {
      const parsed = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      previous = parsed && parsed.slots && typeof parsed.slots === "object" ? parsed.slots : {};
    }
    const slots = assignPortSlots(linkedPaths, previous);
    const next = { version: 1, slots };
    if (JSON.stringify(next) !== JSON.stringify({ version: 1, slots: previous })) {
      const temporary = `${metadataPath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
      fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, "utf8");
      fs.renameSync(temporary, metadataPath);
    }
    return slots;
  });
}

/** Reads the live git layout. Falls back to "primary" when git is unavailable. */
export function describeCheckout(cwd = process.cwd()) {
  try {
    const worktreeRoot = gitValue(["rev-parse", "--show-toplevel"], cwd);
    // git reports these relative to the *cwd*, not the worktree root, and it can
    // return one absolute and one relative in the same breath. Resolving them
    // against the worktree root therefore pointed above the repo whenever the
    // cwd was a workspace folder (`npm --workspace <app> run dev`), which made
    // the primary checkout look like a linked worktree. Let git absolutize both.
    const [gitDir, gitCommonDir] = gitValue(
      ["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"],
      cwd,
    ).split(/\r?\n/);
    return { worktreeRoot, isPrimary: isPrimaryCheckout({ gitDir, gitCommonDir }) };
  } catch {
    return { worktreeRoot: path.resolve(cwd), isPrimary: true };
  }
}

export function resolveLivePortSet({ env = process.env, cwd = process.cwd() } = {}) {
  const checkout = describeCheckout(cwd);
  const commonDir = gitValue(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd);
  const primaryRoot = path.dirname(commonDir);
  const worktreePaths = listWorktreePaths(cwd);
  const linkedPaths = worktreePaths.filter((worktreePath) => normalizeWorktreePath(worktreePath) !== normalizeWorktreePath(primaryRoot));
  if (!worktreePaths.some((worktreePath) => normalizeWorktreePath(worktreePath) === normalizeWorktreePath(checkout.worktreeRoot))) {
    throw new Error(`Current checkout is absent from git worktree enumeration: ${checkout.worktreeRoot}`);
  }
  const assignments = reconcilePortSlots(commonDir, linkedPaths);
  const worktreeSlot = assignments[normalizeWorktreePath(checkout.worktreeRoot)];
  if (!checkout.isPrimary && !worktreeSlot) throw new Error(`No persisted port slot for linked worktree ${checkout.worktreeRoot}`);
  return { ...checkout, ports: resolvePortSet({ env, ...checkout, worktreeSlot }) };
}

function main() {
  const { worktreeRoot, isPrimary, ports } = resolveLivePortSet();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ worktreeRoot, isPrimary, ports, corsOrigin: corsOriginFor(ports), apiUrl: apiUrlFor(ports) }));
    return;
  }
  const label = isPrimary ? "primary checkout" : "linked worktree";
  console.log(`[prism-ports] ${label}: ${worktreeRoot}`);
  for (const app of PRISM_APPS) console.log(`[prism-ports]   ${app.padEnd(9)} ${ports[app]}`);
  console.log(`[prism-ports] CORS_ORIGIN=${corsOriginFor(ports)}`);
  console.log(`[prism-ports] NEXT_PUBLIC_API_URL=${apiUrlFor(ports)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
