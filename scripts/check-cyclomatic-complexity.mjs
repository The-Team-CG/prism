/**
 * McCabe cyclomatic complexity gate (ESLint `complexity` compatible).
 * Production functions start at 1; +1 for if / loops / catch / ternary /
 * && / || / non-default switch case. Nested functions are counted separately.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = process.cwd();
const DEFAULT_MAX = 10;

const SCAN_ROOTS = [
  "apps/api/src",
  "apps/client/src",
  "apps/event/src",
  "apps/supplier/src",
  "apps/guest/src",
  "packages/types/src",
  "packages/api-client/src",
  "packages/ui/src",
  "packages/tokens/src",
  "scripts",
];

const SKIP_DIR = new Set(["node_modules", "dist", ".next", "coverage", "generated"]);

export function isTestFile(rel) {
  return (
    /\.(test|spec)\.(ts|tsx|mjs|cjs|js)$/.test(rel) ||
    /(?:^|\/)__tests__\//.test(rel)
  );
}

export function isUiKitFile(rel) {
  return /\/src\/app\/components\/ui\//.test(rel.replaceAll("\\", "/"));
}

export function isProductionSource(rel) {
  const normalized = rel.replaceAll("\\", "/");
  return !isTestFile(normalized) && !isUiKitFile(normalized) && !normalized.endsWith(".d.ts");
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR.has(entry.name)) walk(full, acc);
    } else if (/\.(ts|tsx|mts|cts)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

function nodeName(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPrivateIdentifier(node)) return node.text;
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return String(node.text);
  if (ts.isComputedPropertyName(node)) return "[computed]";
  return "<anonymous>";
}

function functionName(node, parent) {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
    if (node.name) return node.name.text;
  }
  if (ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
    const prefix = ts.isGetAccessor(node) ? "get " : ts.isSetAccessor(node) ? "set " : "";
    return prefix + nodeName(node.name);
  }
  if (ts.isConstructorDeclaration(node)) return "constructor";
  if (parent) {
    if (ts.isVariableDeclaration(parent) && parent.name && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    if ((ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) && parent.name) {
      return nodeName(parent.name);
    }
    if (ts.isBinaryExpression(parent) && ts.isIdentifier(parent.left)) {
      return parent.left.text;
    }
  }
  return "<anonymous>";
}

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessor(node) ||
    ts.isSetAccessor(node) ||
    ts.isConstructorDeclaration(node)
  );
}

export function complexityIncrements(node) {
  if (ts.isIfStatement(node)) return 1;
  if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) return 1;
  if (ts.isWhileStatement(node) || ts.isDoStatement(node)) return 1;
  if (ts.isCatchClause(node)) return 1;
  if (ts.isConditionalExpression(node)) return 1;
  if (ts.isCaseClause(node)) return 1;
  if (ts.isBinaryExpression(node)) {
    const kind = node.operatorToken.kind;
    if (kind === ts.SyntaxKind.AmpersandAmpersandToken || kind === ts.SyntaxKind.BarBarToken) {
      return 1;
    }
  }
  return 0;
}

export function measureSource(fileName, text) {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const functions = [];

  function measureFunction(fn, parent) {
    let complexity = 1;
    const visit = (node) => {
      if (node !== fn && isFunctionLike(node)) return;
      complexity += complexityIncrements(node);
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(fn, visit);
    const start = sourceFile.getLineAndCharacterOfPosition(fn.getStart(sourceFile, false));
    functions.push({
      name: functionName(fn, parent),
      complexity,
      line: start.line + 1,
    });
  }

  const visit = (node, parent) => {
    if (isFunctionLike(node)) measureFunction(node, parent);
    ts.forEachChild(node, (child) => visit(child, node));
  };
  visit(sourceFile, undefined);
  return functions;
}

export function collectProductionComplexity(root = ROOT) {
  const files = SCAN_ROOTS.flatMap((rel) => walk(path.join(root, rel)));
  const records = [];
  for (const abs of files) {
    const rel = path.relative(root, abs).replaceAll("\\", "/");
    if (!isProductionSource(rel)) continue;
    const functions = measureSource(abs, fs.readFileSync(abs, "utf8"));
    for (const fn of functions) {
      records.push({ file: rel, ...fn });
    }
  }
  return records;
}

export function findComplexityViolations(records, max = DEFAULT_MAX) {
  return records
    .filter((record) => record.complexity > max)
    .sort((a, b) => b.complexity - a.complexity || a.file.localeCompare(b.file));
}

export function runComplexityCheck(root = ROOT, max = DEFAULT_MAX) {
  const records = collectProductionComplexity(root);
  const violations = findComplexityViolations(records, max);
  if (violations.length === 0) {
    console.log(`cyclomatic complexity ok: ${records.length} production functions, max ≤ ${max}`);
    return { ok: true, checkedCount: records.length, violations };
  }
  console.error(`cyclomatic complexity > ${max} (${violations.length} production functions):`);
  for (const item of violations) {
    console.error(`  ${item.complexity}\t${item.file}:${item.line}\t${item.name}`);
  }
  return { ok: false, checkedCount: records.length, violations };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runComplexityCheck();
  if (!result.ok) process.exit(1);
}
