import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const backendCapabilityModules = [
  "access-control",
  "identity-ops",
  "trust-ops",
  "notification-ops",
  "event-core",
  "inquiry-onboarding",
  "commercial-ops",
  "supplier-ops",
  "staffing-ops",
  "finance-ops",
  "compliance-ops",
  "floorplan",
  "file-ops",
  "guest-ops",
  "closure-ops",
  "ai-governance",
  "event-read-models",
  "sample-compatibility",
];

const backendCapabilityPattern = new RegExp(
  `^apps/api/libs/modules/(?:${backendCapabilityModules.join("|")})/src/`,
);

const eventReadModelsPattern = /^apps\/api\/libs\/modules\/event-read-models\/src\//;
const eventReadModelsQueriesPattern = /^apps\/api\/libs\/modules\/event-read-models\/src\/queries\/.*\.ts$/;
const prismaMutationPattern =
  /(?:\b(?:this\.)?prisma(?:\.[A-Za-z_$][\w$]*)*|\btx(?:\.[A-Za-z_$][\w$]*)*)\.(?:createMany|create|updateMany|update|upsert|deleteMany|delete|\$executeRawUnsafe|\$executeRaw)\s*\(/;
const rawQueryPattern = /\.\$queryRaw(?:Unsafe)?\b/;

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
    name: "shared ui must not import backend modules",
    filePattern: /^packages\/ui\//,
    importPattern: /from\s+["'](?:@prism\/modules|apps\/api\/libs\/modules)/,
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
  {
    name: "backend capability modules must not import private services from other capability modules",
    filePattern: backendCapabilityPattern,
    check(normalized, source) {
      const moduleName = normalized.match(/^apps\/api\/libs\/modules\/([^/]+)\//)?.[1];
      if (!moduleName) return false;

      const privateServiceImports = source.matchAll(
        /from\s+["'](?:@prism\/modules\/|apps\/api\/libs\/modules\/|(?:\.\.\/)+)([^/"'.]+)\/src\/services\//g,
      );

      for (const privateServiceImport of privateServiceImports) {
        if (privateServiceImport[1] !== moduleName) return true;
      }

      return false;
    },
  },
  {
    name: "backend capability modules must not import event-ops compatibility internals",
    filePattern: backendCapabilityPattern,
    importPattern: /from\s+["'](?:@prism\/modules\/event-ops|apps\/api\/libs\/modules\/event-ops)/,
  },
  {
    name: "event-read-models must not mutate Prisma state",
    filePattern: eventReadModelsPattern,
    check(_normalized, source) {
      return prismaMutationPattern.test(source);
    },
  },
  {
    name: "event-read-models raw queries require an approved query builder with a query budget",
    filePattern: eventReadModelsPattern,
    check(normalized, source) {
      if (!rawQueryPattern.test(source)) return false;
      return !eventReadModelsQueriesPattern.test(normalized) || !source.includes("Query budget:");
    },
  },
  {
    name: "event-ops module must not contain tracked files after sample compatibility migration",
    filePattern: /^apps\/api\/libs\/modules\/event-ops\//,
    check() {
      return true;
    },
  },
  {
    // Agent apps deploy on their own and must stay reasoning-only: they receive
    // context and return a verdict. Shared logic belongs in @prism/pare-core,
    // contracts in @prism/types.
    name: "agent apps must not import role app or API internals",
    filePattern: /^apps\/agent-[^/]+\//,
    importPattern:
      /from\s+["'](?:@\/|apps\/|@prism\/(?:client|event|supplier|guest|ui|api-client|modules|shared|database))/,
  },
  {
    name: "agent apps must not reach a database directly",
    filePattern: /^apps\/agent-[^/]+\//,
    importPattern: /from\s+["'](?:@prisma\/client|@prisma\/adapter-pg|prisma|pg)["']/,
  },
  {
    name: "apps must not import agent app internals",
    filePattern: /^apps\/(?:api|client|event|supplier|guest)\//,
    importPattern: /from\s+["'](?:prism-agent-|apps\/agent-)/,
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
        ((rule.importPattern && rule.importPattern.test(source)) || (rule.check && rule.check(normalized, source)))
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