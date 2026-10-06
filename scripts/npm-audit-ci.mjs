import { execFileSync } from "node:child_process";

/**
 * Prisma 7.9.1 pins mysql2@3.15.3. This repo uses PostgreSQL via @prisma/adapter-pg
 * and never opens a MySQL connection. Revisit when Prisma ships a patched mysql2 pin.
 */
const ALLOWED_ADVISORIES = new Set([
  "GHSA-3f6p-5ww8-9rcr",
  "GHSA-rgwj-5xj2-c3m3",
  // braces uncontrolled resource consumption, reached only through eslint-config-next@14 ->
  // @next/eslint-plugin-next -> fast-glob -> micromatch. These run in lint tooling on repository-controlled
  // glob patterns, never on request input or in a shipped bundle. Clearing it needs the Next 15+ lint config.
  // Reviewed 2026-10-06; revisit by 2026-12-01 or when the apps move to Next 15.
  "GHSA-vfj7-8cjw-p6xm",
]);

function advisoryIds(vulnerability) {
  const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
  const ids = new Set();
  for (const item of via) {
    if (typeof item === "string") {
      const match = item.match(/GHSA-[0-9a-z-]+/i);
      if (match) ids.add(match[0]);
      continue;
    }
    if (item && typeof item.url === "string") {
      const match = item.url.match(/GHSA-[0-9a-z-]+/i);
      if (match) ids.add(match[0]);
    }
    if (item && typeof item.source === "string" && item.source.startsWith("GHSA-")) {
      ids.add(item.source);
    }
  }
  return [...ids];
}

function isAllowed(vulnerability, allowedPackages) {
  const ids = advisoryIds(vulnerability);
  if (ids.length > 0 && ids.every((id) => ALLOWED_ADVISORIES.has(id))) {
    return true;
  }
  const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
  return (
    via.length > 0 &&
    via.every((item) => typeof item === "string" && allowedPackages.has(item))
  );
}

function collectAllowed(vulnerabilities) {
  const allowed = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
      if (allowed.has(name) || !isAllowed(vulnerability, allowed)) continue;
      allowed.add(name);
      changed = true;
    }
  }
  return allowed;
}

function isHighOrCritical(vulnerability) {
  const severity = String(vulnerability.severity || "").toLowerCase();
  return severity === "high" || severity === "critical";
}

let stdout;
try {
  stdout = execFileSync("npm", ["audit", "--json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
} catch (error) {
  stdout = error.stdout;
  if (!stdout) {
    console.error(error.stderr || error.message);
    process.exit(error.status ?? 1);
  }
}

let report;
try {
  report = JSON.parse(stdout);
} catch {
  console.error(stdout || "npm audit did not return JSON");
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const allowed = collectAllowed(vulnerabilities);
const remaining = Object.entries(vulnerabilities).filter(
  ([name, vulnerability]) => isHighOrCritical(vulnerability) && !allowed.has(name),
);

if (remaining.length === 0) {
  if (Object.keys(vulnerabilities).length > 0) {
    console.log("npm audit: high/critical findings are covered by a documented exception.");
  }
  process.exit(0);
}

for (const [name, vulnerability] of remaining) {
  console.error(`${name} (${vulnerability.severity})`);
}
process.exit(1);
