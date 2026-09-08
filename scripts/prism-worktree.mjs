#!/usr/bin/env node
/**
 * Create, prepare, and tear down linked git worktrees for parallel P.R.I.S.M work.
 *
 * Two hazards this exists to remove:
 *  - a fresh worktree inherits the canonical ports, so starting it kills the
 *    primary checkout's dev servers. Setup writes the worktree's derived ports
 *    into its own env files instead.
 *  - `node_modules` in a worktree is a tree of junctions pointing at the primary
 *    checkout. A naive recursive delete can follow them and destroy the real
 *    dependency tree, so removal unlinks every reparse point first.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  PRISM_PORTAL_APPS,
  apiUrlFor,
  corsOriginFor,
  describeCheckout,
  resolveLivePortSet,
} from "./prism-ports.mjs";

export const WORKTREES_DIRNAME = ".worktrees";

/** Refuses any path that is not a direct child of <repoRoot>/.worktrees. */
export function assertInsideWorktrees(repoRoot, target) {
  const root = path.resolve(repoRoot, WORKTREES_DIRNAME);
  const resolved = path.resolve(target);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to touch ${resolved}: not inside ${root}`);
  }
  try {
    const targetStat = fs.lstatSync(resolved);
    if (targetStat.isSymbolicLink()) {
      throw new Error(`Refusing to touch ${resolved}: target is a symlink or junction`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const realPathWithMissingTail = (candidate) => {
    const tail = [];
    let existing = candidate;
    while (!fs.existsSync(existing)) {
      const parent = path.dirname(existing);
      if (parent === existing) break;
      tail.unshift(path.basename(existing));
      existing = parent;
    }
    const realExisting = fs.realpathSync.native(existing);
    return tail.reduce((current, segment) => path.join(current, segment), realExisting);
  };
  const rootReal = realPathWithMissingTail(root);
  const targetReal = realPathWithMissingTail(resolved);
  const realRelative = path.relative(rootReal, targetReal);
  if (!realRelative || realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    throw new Error(`Refusing to touch ${resolved}: resolved path is outside ${root}`);
  }
  return resolved;
}

/** Replaces existing KEY= lines and appends the rest, preserving unrelated content. */
export function upsertEnvLines(content, entries) {
  let lines = String(content ?? "").replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0 && lines.at(-1) === "") lines.pop();
  for (const [key, value] of Object.entries(entries)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=.*$`);
    let replaced = false;
    const nextLines = [];
    for (const current of lines) {
      if (!pattern.test(current)) {
        nextLines.push(current);
      } else if (!replaced) {
        nextLines.push(line);
        replaced = true;
      }
    }
    lines = replaced ? nextLines : [...nextLines, line];
  }
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

/** Describes the env edits a worktree needs so its stack does not collide. */
export function planEnvFiles(ports) {
  const plan = [{ file: path.join("apps", "api", ".env"), entries: { PORT: ports.api, CORS_ORIGIN: corsOriginFor(ports) } }];
  for (const app of PRISM_PORTAL_APPS) {
    plan.push({ file: path.join("apps", app, ".env.local"), entries: { NEXT_PUBLIC_API_URL: apiUrlFor(ports) } });
  }
  return plan;
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
}

function seedFrom(primaryRoot, relativeFile, targetPath) {
  if (fs.existsSync(targetPath)) return false;
  const source = path.join(primaryRoot, relativeFile);
  const fallback = path.join(primaryRoot, relativeFile.replace(/\.env\.local$/, ".env.example").replace(/\.env$/, ".env.example"));
  const chosen = fs.existsSync(source) ? source : fallback;
  if (!fs.existsSync(chosen)) return false;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(chosen, targetPath);
  return chosen;
}

export function prepareWorktree({ worktreeRoot, primaryRoot, ports }) {
  const written = [];
  for (const { file, entries } of planEnvFiles(ports)) {
    const targetPath = path.join(worktreeRoot, file);
    const seededFrom = seedFrom(primaryRoot, file, targetPath);
    if (seededFrom && file === path.join("apps", "api", ".env") && path.resolve(seededFrom) === path.resolve(primaryRoot, file)) {
      console.log(`[prism-worktree] copied ${seededFrom}; it contains local credentials and must not be committed.`);
    }
    const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : "";
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, upsertEnvLines(current, entries));
    written.push(file);
  }
  return written;
}

/** Junction/symlink directories under root, deepest first so parents unlink cleanly. */
export function collectLinkedDirectories(root) {
  const found = [];
  const worktreeReal = fs.realpathSync.native(root);
  const isInside = (candidate) => {
    const relative = path.relative(worktreeReal, fs.realpathSync.native(candidate));
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  };
  const walk = (current) => {
    try {
      if (!isInside(current)) return;
    } catch {
      return;
    }
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        found.push(entryPath);
        continue;
      }
      if (entry.isDirectory()) {
        try {
          if (isInside(entryPath)) walk(entryPath);
        } catch {
          // A disappearing or inaccessible reparse point is skipped safely.
        }
      }
    }
  };
  walk(root);
  return found.sort((left, right) => right.length - left.length);
}

function unlinkDirectoryLink(target) {
  try {
    fs.rmdirSync(target);
    return true;
  } catch {
    try {
      fs.unlinkSync(target);
      return true;
    } catch {
      return false;
    }
  }
}

export function removeWorktreeTree(repoRoot, target) {
  const resolved = assertInsideWorktrees(repoRoot, target);
  const links = collectLinkedDirectories(resolved);
  let unlinked = 0;
  for (const link of links) if (unlinkDirectoryLink(link)) unlinked += 1;
  fs.rmSync(resolved, { recursive: true, force: true });
  return { unlinked, links: links.length };
}

function reportPorts(worktreeRoot, ports) {
  console.log(`[prism-worktree] ${worktreeRoot}`);
  for (const [app, port] of Object.entries(ports)) console.log(`[prism-worktree]   ${app.padEnd(9)} ${port}`);
}

function runSetup(cwd) {
  const { worktreeRoot, isPrimary, ports } = resolveLivePortSet({ cwd, env: process.env });
  const primaryRoot = isPrimary ? worktreeRoot : git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd).replace(/[/\\]\.git$/, "");
  const written = prepareWorktree({ worktreeRoot, primaryRoot, ports });
  reportPorts(worktreeRoot, ports);
  console.log(`[prism-worktree] wrote ${written.length} env file(s); dependencies still need an install in this worktree.`);
}

function runCreate(name, base) {
  const { worktreeRoot: primaryRoot } = describeCheckout(process.cwd());
  const target = assertInsideWorktrees(primaryRoot, path.join(primaryRoot, WORKTREES_DIRNAME, name));
  git(["worktree", "add", "-b", `codex/${name}`, target, base], primaryRoot);
  runSetup(target);
}

function runRemove(name) {
  const { worktreeRoot: primaryRoot } = describeCheckout(process.cwd());
  const target = assertInsideWorktrees(primaryRoot, path.join(primaryRoot, WORKTREES_DIRNAME, name));
  const { unlinked, links } = removeWorktreeTree(primaryRoot, target);
  console.log(`[prism-worktree] unlinked ${unlinked}/${links} junction(s) before deleting ${target}`);
  try {
    git(["worktree", "remove", "--force", target], primaryRoot);
  } catch {
    console.log("[prism-worktree] git worktree remove reported an error; pruning metadata instead.");
  }
  git(["worktree", "prune"], primaryRoot);
  console.log("[prism-worktree] done.");
}

function main(argv) {
  const [command, name] = argv;
  if (command === "setup") return runSetup(process.cwd());
  if (command === "create" && name) return runCreate(name, argv[2] ?? "staging");
  if (command === "remove" && name) return runRemove(name);
  console.error("Usage: node scripts/prism-worktree.mjs <setup | create <name> [base] | remove <name>>");
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
