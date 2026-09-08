#!/usr/bin/env node
/**
 * Starts a Next portal on the port this checkout owns.
 *
 * The port used to be hard-coded in each portal's package.json, which meant a
 * linked worktree started on the primary checkout's port and the port guard
 * killed the primary's dev server. The port now comes from the checkout.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { apiUrlFor, resolveLivePortSet } from "./prism-ports.mjs";

const require = createRequire(import.meta.url);
const { readProcessIdentity, removeCheckoutLease, writeCheckoutLease } = require("./port-ownership.cjs");

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

function resolveNextBin(appDir) {
  const require = createRequire(path.join(appDir, "package.json"));
  return require.resolve("next/dist/bin/next");
}

function main() {
  const app = readArg("--app");
  const mode = readArg("--mode", "dev");
  if (!app) {
    console.error("[dev-portal] Usage: node scripts/dev-portal.mjs --app <client|supplier|guest|event> [--mode dev|start]");
    process.exit(1);
  }

  const appDir = process.cwd();
  const { ports, worktreeRoot, isPrimary } = resolveLivePortSet({ cwd: appDir });
  const port = ports[app];
  if (!port) {
    console.error(`[dev-portal] Unknown portal: ${app}`);
    process.exit(1);
  }

  const scope = isPrimary ? "primary checkout" : `worktree ${path.basename(worktreeRoot)}`;
  console.log(`[dev-portal] ${app} -> port ${port} (${scope})`);

  let nextBin;
  try {
    nextBin = resolveNextBin(appDir);
  } catch {
    console.error(`[dev-portal] Next.js is not installed for ${appDir}. Run npm install in this checkout, then retry.`);
    process.exit(1);
  }

  const guard = spawnSync(
    process.execPath,
    [path.join(REPO_ROOT, "scripts", "kill-prism-port.cjs"), "--app", app, "--port", String(port), "--root", worktreeRoot],
    { stdio: "inherit" },
  );
  if (guard.status !== 0) process.exit(guard.status ?? 1);

  const child = spawn(process.execPath, [nextBin, mode, "--port", String(port)], {
    cwd: appDir,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_API_URL: apiUrlFor(ports), PRISM_CHECKOUT_ROOT: worktreeRoot },
  });
  let leaseWritten = false;
  try {
    const identity = readProcessIdentity(child.pid);
    if (!identity.startTime) throw new Error("process start identity was unavailable");
    writeCheckoutLease({ ownerRoot: worktreeRoot, app, identity });
    leaseWritten = true;
  } catch (error) {
    console.error(`[dev-portal] Refusing to run without a durable checkout lease: ${error.message}`);
    try { child.kill(); } catch {}
    try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch {}
    process.exit(1);
  }
  let shuttingDown = false;
  let shutdownTimer;
  const signalHandlers = {};
  const removeSignalHandlers = () => {
    for (const [signal, handler] of Object.entries(signalHandlers)) process.removeListener(signal, handler);
  };
  const forwardSignal = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    try { child.kill(signal); } catch {}
    shutdownTimer = setTimeout(() => {
      try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch {}
    }, 5000);
    shutdownTimer.unref();
  };
  signalHandlers.SIGINT = () => forwardSignal("SIGINT");
  signalHandlers.SIGTERM = () => forwardSignal("SIGTERM");
  process.on("SIGINT", signalHandlers.SIGINT);
  process.on("SIGTERM", signalHandlers.SIGTERM);
  child.on("exit", (code, signal) => {
    if (shutdownTimer) clearTimeout(shutdownTimer);
    if (leaseWritten) removeCheckoutLease({ ownerRoot: worktreeRoot, app });
    if (signal) {
      removeSignalHandlers();
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 0;
  });
}

main();
