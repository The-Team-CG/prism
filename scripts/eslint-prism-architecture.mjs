import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tsParser from "@typescript-eslint/parser";

const roles = ["client", "event", "supplier", "guest"];
const contexts = [
  "commercial",
  "event-lifecycle",
  "floorplan",
  "identity-access",
  "live-ops",
  "operations",
  "platform-ops",
  "read-models",
];
const publicContextSubpaths = new Set([
  "read-models/closeout",
  "read-models/event-scope",
  "read-models/file-evidence",
  "event-lifecycle/conforme-reminder-window",
]);

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonicalSchemaTypes = new Set();
const schemaDirectory = resolve(repoRoot, "packages/types/src/schemas");

for (const schemaFile of [
  "auth-inputs.ts",
  "common.ts",
  "event-ops-inputs.ts",
  "session-commercial-inputs.ts",
  "session-spatial-inputs.ts",
  "session-trust-inputs.ts",
  "session-w26-inputs.ts",
  "storage.ts",
]) {
  const source = readFileSync(resolve(schemaDirectory, schemaFile), "utf8");
  for (const match of source.matchAll(/export\s+type\s+([A-Za-z_$][\w$]*)\s*=\s*z\.infer/g)) {
    canonicalSchemaTypes.add(match[1]);
  }
}

function normalizedRelative(filename) {
  if (!filename || filename === "<input>") return filename ?? "";
  return relative(repoRoot, filename).replaceAll("\\", "/");
}

function sourceValue(node) {
  return node.source?.value;
}

function roleFromPath(filename) {
  return normalizedRelative(filename).match(/^apps\/(client|event|supplier|guest)\//)?.[1] ?? null;
}

function resolveRelativeSource(filename, source) {
  if (!source.startsWith(".")) return null;
  return normalizedRelative(resolve(dirname(filename), source)).replace(/\.(?:[cm]?[jt]sx?)$/, "");
}

function isRoleImport(filename, source, role) {
  const otherRolePattern = new RegExp(`^(?:apps/|@prism/)(?!${role}(?:/|$))(${roles.filter((candidate) => candidate !== role).join("|")})(?:/|$)`);
  if (otherRolePattern.test(source)) return true;

  const resolved = resolveRelativeSource(filename, source);
  return resolved ? roles.some((otherRole) => otherRole !== role && resolved.startsWith(`apps/${otherRole}/`)) : false;
}

function reportImport(context, node, message) {
  context.report({ node: node.source ?? node, message });
}

function importRuleVisitors(context, check) {
  return {
    ImportDeclaration(node) {
      check(node, context);
    },
    ExportNamedDeclaration(node) {
      if (node.source) check(node, context);
    },
    ExportAllDeclaration(node) {
      check(node, context);
    },
  };
}

const noCrossPortalImports = {
  meta: {
    type: "problem",
    docs: { description: "prevent role portals from importing another portal" },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename();
    const role = roleFromPath(filename);
    if (!role) return {};

    return importRuleVisitors(context, (node, currentContext) => {
      const source = sourceValue(node);
      if (typeof source === "string" && isRoleImport(filename, source, role)) {
        reportImport(currentContext, node, `Role app '${role}' must use package contracts, not another portal's internals.`);
      }
    });
  },
};

const noPrivateContextImports = {
  meta: {
    type: "problem",
    docs: { description: "prevent private bounded-context imports" },
    schema: [],
  },
  create(context) {
    const normalized = normalizedRelative(context.getFilename());
    if (!normalized.startsWith("apps/api/src/modules/")) return {};

    const owner = normalized.match(/^apps\/api\/src\/modules\/([^/]+)\//)?.[1];
    return importRuleVisitors(context, (node, currentContext) => {
      const source = sourceValue(node);
      if (typeof source !== "string") return;

      const contextAlias = source.match(/^@prism\/contexts\/([^/]+)(?:\/(.*))?$/);
      if (contextAlias?.[2] && !publicContextSubpaths.has(`${contextAlias[1]}/${contextAlias[2]}`)) {
        reportImport(currentContext, node, "Import bounded-context capabilities through its public entrypoint, not a private implementation.");
        return;
      }

      const directImport = source.match(/^apps\/api\/src\/modules\/([^/]+)\//);
      if (directImport && directImport[1] !== owner) {
        reportImport(currentContext, node, "A bounded context must not import another context's private implementation.");
        return;
      }

      const resolved = resolveRelativeSource(context.getFilename(), source);
      if (resolved?.startsWith("apps/api/src/modules/")) {
        if (normalized.endsWith(".module.ts") || normalized.endsWith(".module.tsx") || resolved.includes("/contracts/") || resolved.includes("/read-models/")) {
          return;
        }
        if (normalized.endsWith(".test.ts") || normalized.endsWith(".test.tsx") || normalized.endsWith(".spec.ts") || normalized.endsWith(".spec.tsx")) {
          return;
        }
        const importedOwner = resolved.match(/^apps\/api\/src\/modules\/([^/]+)\//)?.[1];
        if (importedOwner && importedOwner !== owner) {
          reportImport(currentContext, node, "A bounded context must not import another context's private implementation.");
        }
      }
    });
  },
};

const noLocalContractDefinitions = {
  meta: {
    type: "problem",
    docs: { description: "keep shared Zod-inferred contracts in @prism/types" },
    schema: [],
  },
  create(context) {
    const normalized = normalizedRelative(context.getFilename());
    const role = roleFromPath(context.getFilename());
    if (!role || !normalized.includes("/src/lib/") || normalized.endsWith("/src/lib/prism-api.ts")) return {};

    function checkDeclaration(node) {
      const name = node.id?.name;
      if (name && canonicalSchemaTypes.has(name)) {
        context.report({
          node: node.id,
          message: `Shared contract '${name}' belongs in @prism/types; import the canonical type instead of redefining it locally.`,
        });
      }
    }

    return {
      TSTypeAliasDeclaration: checkDeclaration,
      TSInterfaceDeclaration: checkDeclaration,
    };
  },
};

const noInlineZod = {
  meta: {
    type: "problem",
    docs: { description: "keep Zod schemas in the canonical shared contract package" },
    schema: [],
  },
  create(context) {
    const normalized = normalizedRelative(context.getFilename());
    const canonical = normalized.startsWith("packages/types/src/schemas/");
    const zodValidationPipe = normalized === "apps/api/src/kernel/shared/zod-validation.pipe.ts";
    if (canonical || zodValidationPipe) return {};

    return importRuleVisitors(context, (node, currentContext) => {
      if (sourceValue(node) === "zod") {
        reportImport(currentContext, node, "Zod schemas belong in packages/types/src/schemas; consume the shared contract instead of defining one here.");
      }
    });
  },
};

const noProductionAny = {
  meta: {
    type: "problem",
    docs: { description: "keep production API code free of explicit any types" },
    schema: [],
  },
  create(context) {
    const normalized = normalizedRelative(context.getFilename());
    if (
      !normalized.startsWith("apps/api/src/") ||
      normalized.startsWith("apps/api/src/fixtures/") ||
      /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalized)
    ) return {};

    function checkAny(node) {
      context.report({
        node,
        message: "Avoid explicit 'any' in production API code; use a selected payload or explicit contract mapping.",
      });
    }

    return {
      TSAnyKeyword: checkAny,
    };
  },
};

export default {
  parser: tsParser,
  plugin: {
    rules: {
      "no-cross-portal-imports": noCrossPortalImports,
      "no-private-context-imports": noPrivateContextImports,
      "no-local-contract-definitions": noLocalContractDefinitions,
      "no-inline-zod": noInlineZod,
      "no-production-any": noProductionAny,
    },
  },
};
