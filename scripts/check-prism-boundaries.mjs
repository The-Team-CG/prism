import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const backendContexts = [
  "commercial",
  "event-lifecycle",
  "floorplan",
  "identity-access",
  "live-ops",
  "operations",
  "platform-ops",
  "read-models",
];

const backendContextPattern = new RegExp(
  "^apps/api/src/modules/(?:" + backendContexts.join("|") + ")/",
);
const backendKernelPattern = /^apps\/api\/src\/kernel\//;
const backendSourcePattern = /^apps\/api\/src\/(?:modules|kernel)\//;
const readModelsPattern = /^apps\/api\/src\/modules\/read-models\//;
const legacyBackendPattern = /^apps\/api\/libs\/(?:contexts|modules|core)\//;
const prismaMutationPattern =
  /(?:\b(?:this\.)?prisma(?:\.[A-Za-z_$][\w$]*)*|\btx(?:\.[A-Za-z_$][\w$]*)*)\.(?:createMany|create|updateMany|update|upsert|deleteMany|delete|\$executeRawUnsafe|\$executeRaw)\s*\(/;
const rawQueryPattern = /\.\$queryRaw(?:Unsafe)?\b/;
const aiProviderSdkImportPattern =
  /\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)["'](?:@anthropic-ai\/sdk(?:\/[^"']*)?|@openrouter\/[^"']+|openai(?:\/[^"']*)?|@google\/generative-ai(?:\/[^"']*)?|@google-cloud\/vertexai(?:\/[^"']*)?|@aws-sdk\/client-bedrock-runtime(?:\/[^"']*)?|@ai-sdk\/[^"']+|ai(?:\/[^"']*)?)["']/;
const aiProviderImportExceptionPattern =
  /^apps\/api\/src\/modules\/platform-ops\/infrastructure\/ai-governance\//;

function contextOf(normalized) {
  return normalized.match(/^apps\/api\/src\/modules\/([^/]+)\//)?.[1] ?? null;
}

function hasPrivateModuleImport(source) {
  const nestedImports = source.matchAll(/from\s+["'](@prism\/(?:contexts|kernel)\/[^/"']+\/[^"']+)["']/g);
  const publicSubpathSeams = new Set([
    '@prism/contexts/read-models/closeout',
    '@prism/contexts/read-models/event-scope',
    '@prism/contexts/read-models/participant-facts',
    '@prism/contexts/read-models/guest-events',
    '@prism/contexts/read-models/account-contacts',
    '@prism/contexts/read-models/commercial-facts-reader',
    '@prism/contexts/read-models/lifecycle-facts',
    '@prism/contexts/read-models/guest-pass-delivery-eligibility',
    '@prism/contexts/event-lifecycle/conforme-reminder-window',
    '@prism/contexts/event-lifecycle/post-event-reference',
    '@prism/contexts/event-lifecycle/operations-reference',
    '@prism/contexts/identity-access/coordinator-reference',
    '@prism/contexts/operations/live-ops-reference',
    '@prism/contexts/commercial/registration-supplier-reference',
    '@prism/contexts/live-ops/urgent-issue-reference',
    '@prism/contexts/event-lifecycle/floorplan-reference',
    '@prism/contexts/floorplan/event-drafts',
  ]);
  return [...nestedImports].some((match) => !publicSubpathSeams.has(match[1]));
}

function hasPrivateCrossContextImport(normalized, source) {
  const owner = contextOf(normalized);
  if (!owner) return false;

  const directContextImport = /from\s+["']apps\/api\/src\/modules\/([^/"']+)\/[^"']+["']/g;
  for (const match of source.matchAll(directContextImport)) {
    if (match[1] !== owner) return true;
  }

  return false;
}

export const boundaryRules = [
  {
    name: "shared floorplan canvas must not import apps, portals, UI or API clients",
    filePattern: /^packages\/floorplan-canvas\//,
    importPattern: /\b(?:from\s*|import\s*\(\s*|require\s*\(\s*)["'](?:@\/|apps\/|@prism\/(?:api-client|client|event|guest|supplier|ui|compatibility)(?:\/|["']))/,
  },  {
    name: "provider SDK imports must stay in AI gateway infrastructure",
    filePattern: /^(?:apps|packages)\//,
    allowedFilePattern: aiProviderImportExceptionPattern,
    importPattern: aiProviderSdkImportPattern,
  },
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
    importPattern: /from\s+["'](?:@prism\/(?:modules|kernel|contexts)|apps\/api\/)/,
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
    name: "role apps must not read a whole-system state aggregate",
    filePattern: /^apps\/(?:client|event|supplier|guest)\//,
    importPattern: /(?:eventOpsClient\.sample\.state\(|prismApi\.state\(|["']\/api\/sample\/state["']|["']\/sample\/state["'])/,
  },
  {
    name: "role apps must not retain browser-local fixture fallbacks",
    filePattern: /^apps\/(?:client|event|supplier|guest)\//,

    importPattern: /from\s+["'](?:@\/mock\/prism-sample-state|@\/compatibility\/sample\/prism-api)["']/,
  },
  {
    name: "role apps must use shared Prism session keys",
    filePattern: /^apps\/(?:client|event|supplier|guest)\//,
    importPattern:
      /["']prism:(?:client-session|mock-auth-session|supplier-session|guest-session|event-command-session)["']/,
  },
  {
    name: "backend services must not inject Prisma as any",
    filePattern: /^apps\/api\/src\/(?:modules|kernel)\/.*\/.*service\.ts$/,
    importPattern: /(?:private\s+readonly\s+)?prisma\s*:\s*any\b/,
  },
  {
    name: "backend code must use public context and kernel entrypoints",
    filePattern: backendSourcePattern,
    check(_normalized, source) {
      return hasPrivateModuleImport(source);
    },
  },
  {
    name: "backend contexts must not import another context's private implementation",
    filePattern: backendContextPattern,
    check(normalized, source) {
      return hasPrivateCrossContextImport(normalized, source);
    },
  },
  {
    name: "backend contexts must not import local fixture seed code",
    filePattern: backendContextPattern,
    importPattern: /from\s+["'][^"']*\/fixtures\/[^"']+["']/,
  },
  {
    name: "kernel must not import local fixture seed code",
    filePattern: backendKernelPattern,
    importPattern: /from\s+["'][^"']*\/fixtures\/[^"']+["']/,
  },
  {
    name: "read models must not mutate Prisma state",
    filePattern: readModelsPattern,
    check(normalized, source) {
      // Database behavior tests seed their own rows; the rule protects production read-model code.
      if (/\.test\.ts$/.test(normalized)) return false;
      return prismaMutationPattern.test(source);
    },
  },
  {
    name: "read models raw queries require an approved query builder with a query budget",
    filePattern: readModelsPattern,
    check(normalized, source) {
      if (!rawQueryPattern.test(source)) return false;
      return !normalized.includes("/application/queries/") || !source.includes("Query budget:");
    },
  },
  {
    name: "legacy backend source roots must remain empty after DDD consolidation",
    filePattern: legacyBackendPattern,
    check() {
      return true;
    },
  },
];

export function listTrackedSourceFiles(root = process.cwd()) {
  let files;
  try {
    files = execFileSync("git", ["ls-files", "apps", "packages"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).split(/\r?\n/).filter(Boolean);
  } catch {
    const visit = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return visit(path);
      return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
    });
    files = ["apps", "packages"]
      .flatMap((directory) => visit(join(root, directory)))
      .map((path) => path.slice(root.length + 1).replaceAll("\\", "/"));
  }

  return files
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
        violations.push(normalized + ": " + rule.name);
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
    for (const violation of violations) console.error("- " + violation);
    return { ok: false, checkedCount: files.length, violations };
  }

  console.log("P.R.I.S.M boundary check passed for " + files.length + " files.");
  return { ok: true, checkedCount: files.length, violations };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runBoundaryCheck();
  if (!result.ok) process.exit(1);
}
