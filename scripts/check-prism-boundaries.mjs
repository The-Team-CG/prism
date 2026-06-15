import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const boundaryRules = [
  {
    name: "client app must not import event app internals",
    filePattern: /^apps\/client\//,
    importPattern: /from\s+["'](?:apps\/event|@prism\/event)/,
  },
  {
    name: "event app must not import client app internals",
    filePattern: /^apps\/event\//,
    importPattern: /from\s+["'](?:apps\/client|@prism\/client)/,
  },
  {
    name: "shared ui must not import app-local modules",
    filePattern: /^packages\/ui\//,
    importPattern: /from\s+["'](?:@\/|apps\/)/,
  },
  {
    name: "shared types must not import React or app modules",
    filePattern: /^packages\/types\//,
    importPattern: /from\s+["'](?:react|@\/|apps\/|@prism\/ui)/,
  },
  {
    name: "api client must not import role app modules",
    filePattern: /^packages\/api-client\//,
    importPattern: /from\s+["'](?:@\/|apps\/)/,
  },
  {
    name: "role apps must not read the broad sample state aggregate",
    filePattern: /^apps\/(?:client|event|supplier|guest)\//,
    importPattern: /(?:eventOpsClient\.sample\.state\(|prismApi\.state\(|["']\/api\/sample\/state["']|["']\/sample\/state["'])/,
  },
  {
    name: "role apps must not import the client mock sample dataset",
    filePattern: /^apps\/(?:client|event|supplier|guest)\//,
    allowedFilePattern: /^apps\/client\/src\/lib\/prism-api\.ts$/,
    importPattern: /from\s+["']@\/mock\/prism-sample-state["']/,
  },
  {
    name: "role apps must use shared Prism session and sample storage keys",
    filePattern: /^apps\/(?:client|event|supplier|guest)\//,
    importPattern:
      /["']prism:(?:client-session|mock-auth-session|supplier-session|guest-session|event-command-session|prism-sample-state)["']/,
  },
  {
    name: "backend services must not inject Prisma as any",
    filePattern: /^apps\/api\/libs\/modules\/.*\/src\/.*service\.ts$/,
    importPattern: /(?:private\s+readonly\s+)?prisma\s*:\s*any\b/,
  },
];

export function listTrackedSourceFiles(root = process.cwd()) {
  return execFileSync("git", ["ls-files", "apps", "packages"], {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
    .filter((file) => existsSync(join(root, file)));
}

export function findBoundaryViolations(fileSources, rules = boundaryRules) {
  const violations = [];

  for (const [file, source] of Object.entries(fileSources)) {
    const normalized = file.replaceAll("\\", "/");

    for (const rule of rules) {
      if (
        rule.filePattern.test(normalized) &&
        !(rule.allowedFilePattern && rule.allowedFilePattern.test(normalized)) &&
        rule.importPattern.test(source)
      ) {
        violations.push(`${normalized}: ${rule.name}`);
      }
    }
  }

  return violations;
}

export function runBoundaryCheck(root = process.cwd()) {
  const files = listTrackedSourceFiles(root);
  const fileSources = Object.fromEntries(files.map((file) => [file, readFileSync(join(root, file), "utf8")]));
  const violations = findBoundaryViolations(fileSources);

  if (violations.length > 0) {
    console.error("P.R.I.S.M boundary violations:");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    return { ok: false, checkedCount: files.length, violations };
  }

  console.log(`P.R.I.S.M boundary check passed for ${files.length} files.`);
  return { ok: true, checkedCount: files.length, violations };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runBoundaryCheck();
  if (!result.ok) process.exit(1);
}
