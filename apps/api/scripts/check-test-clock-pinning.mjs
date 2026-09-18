import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_SOURCE_ROOTS = [
  { path: join(SCRIPT_ROOT, 'src'), prefix: 'src' },
  { path: join(SCRIPT_ROOT, 'test'), prefix: 'test' },
];
const DEFAULT_ALLOWLIST_PATH = join(dirname(fileURLToPath(import.meta.url)), 'test-clock-allowlist.json');

// This intentionally small heuristic catches tests for deadline-like surfaces,
// not every use of Date. A dated literal plus one of these markers means the
// test must pin the clock, or document why its date is inert in the allowlist.
const DATE_LITERAL_PATTERN = /new\s+Date\s*\(\s*['"]20\d{2}-/;
const CLOCK_SURFACE_PATTERN = /(?:Date\.now|deadlineAt|slaDueAt|nextAttemptAt|leaseExpiresAt|actualEndedAt|actualStartedAt|plannedStartAt|plannedEndAt|feedback.?window|followUpInterval|reminderDueAt|(?:last)?(?:Conforme)?ReminderAt|ReminderSweep|freezeAt|retryAt|backoffUntil)/i;
const FAKE_TIMER_PATTERN = /vi\.useFakeTimers\s*\(/;
const SYSTEM_TIME_PATTERN = /vi\.setSystemTime\s*\(/;

function collectTestFiles(root) {
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return collectTestFiles(path);
    return entry.isFile() && entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

function relativePath(root, path) {
  return relative(root, path).replaceAll('\\', '/');
}

function isRootedIn(expression, names) {
  if (ts.isIdentifier(expression)) return names.includes(expression.text);
  if (ts.isPropertyAccessExpression(expression)) return isRootedIn(expression.expression, names);
  if (ts.isCallExpression(expression)) return isRootedIn(expression.expression, names);
  return false;
}

function isTestCall(expression) {
  return isRootedIn(expression, ['it', 'test']);
}

function isSuiteCall(expression) {
  return isRootedIn(expression, ['describe', 'suite']);
}

function isTestCallback(node) {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

function isLifecycleCall(expression) {
  return ts.isIdentifier(expression) && (expression.text === 'beforeEach' || expression.text === 'beforeAll');
}

function findCallback(argumentsList) {
  return [...argumentsList].reverse().find(isTestCallback);
}

function collectTestClockNodes(source, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const blocks = [];
  const lifecycleCalls = [];

  function visit(node, suiteScopes, callback) {
    callback(node, suiteScopes);
    const suiteCallback = ts.isCallExpression(node) && findCallback(node.arguments);
    if (ts.isCallExpression(node) && isSuiteCall(node.expression) && suiteCallback) {
      const scope = { start: suiteCallback.getStart(sourceFile), end: suiteCallback.getEnd() };
      ts.forEachChild(node, (child) => visit(child, child === suiteCallback ? [...suiteScopes, scope] : suiteScopes, callback));
      return;
    }
    ts.forEachChild(node, (child) => visit(child, suiteScopes, callback));
  }

  visit(sourceFile, [], (node, suiteScopes) => {
    if (!ts.isCallExpression(node)) return;
    const callback = findCallback(node.arguments);
    if (!callback) return;
    if (isTestCall(node.expression)) {
      blocks.push({
        source: source.slice(node.getStart(sourceFile), node.getEnd()),
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        suiteScopes,
      });
    }
    if (isLifecycleCall(node.expression)) {
      lifecycleCalls.push({
        source: source.slice(node.getStart(sourceFile), node.getEnd()),
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        suiteScopes,
      });
    }
  });

  const blockedRanges = [...blocks, ...lifecycleCalls];
  const sharedNodes = [];
  visit(sourceFile, [], (node, suiteScopes) => {
    if (!ts.isVariableStatement(node) && !ts.isExpressionStatement(node) && !ts.isFunctionDeclaration(node) && !ts.isReturnStatement(node)) return;
    const start = node.getStart(sourceFile);
    const end = node.getEnd();
    if (blockedRanges.some((range) => start < range.end && range.start < end)) return;
    sharedNodes.push({ source: source.slice(start, end), suiteScopes });
  });

  return { blocks, lifecycleCalls, sharedNodes };
}

export function collectTestBlocks(source, fileName) {
  return collectTestClockNodes(source, fileName).blocks.map((block) => block.source);
}

function hasPinnedSuiteSetup(lifecycleCalls, suiteScopes) {
  return lifecycleCalls.some(({ source, suiteScopes: hookScopes }) => {
    const hookScope = hookScopes.at(-1);
    const appliesToScope = !hookScope || suiteScopes.some((scope) => scope.start === hookScope.start && scope.end === hookScope.end);
    return appliesToScope && analyzeTestClockSource(source).pinned;
  });
}

function scopeKey(suiteScopes) {
  return suiteScopes.map((scope) => `${scope.start}:${scope.end}`).join('|');
}

export function loadTestClockAllowlist(path = DEFAULT_ALLOWLIST_PATH) {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value) || !value.files || typeof value.files !== 'object') {
    throw new Error(`${path} must contain a files object`);
  }

  for (const [file, reason] of Object.entries(value.files)) {
    if (typeof reason !== 'string' || reason.trim() === '') {
      throw new Error(`${path} entry ${file} must have a non-empty reason`);
    }
  }
  return value.files;
}

export function analyzeTestClockSource(source) {
  const hasDateLiteral = DATE_LITERAL_PATTERN.test(source);
  const hasClockSurface = CLOCK_SURFACE_PATTERN.test(source);
  const hasFakeTimers = FAKE_TIMER_PATTERN.test(source);
  const hasSystemTime = SYSTEM_TIME_PATTERN.test(source);
  return {
    hasDateLiteral,
    hasClockSurface,
    hasFakeTimers,
    hasSystemTime,
    requiresPinning: hasDateLiteral && hasClockSurface,
    pinned: hasFakeTimers && hasSystemTime,
  };
}

export function findUnpinnedClockFixtures({ sourceRoot, sourceRoots, allowlistPath = DEFAULT_ALLOWLIST_PATH } = {}) {
  const allowlist = loadTestClockAllowlist(allowlistPath);
  const roots = sourceRoot
    ? [{ path: sourceRoot, prefix: '' }]
    : (sourceRoots ?? DEFAULT_SOURCE_ROOTS).map((root) => (typeof root === 'string' ? { path: root, prefix: '' } : root));
  const reason = 'dated fixture references a clock-sensitive surface without vi.useFakeTimers() and vi.setSystemTime()';

  return roots.flatMap(({ path: root, prefix }) =>
    collectTestFiles(root).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      const rootRelativeFile = relativePath(root, path);
      const relativeFile = prefix ? `${prefix}/${rootRelativeFile}` : rootRelativeFile;
      // Existing module allowlist entries were relative to src/modules; keep
      // them valid while reporting the new API-root-relative path.
      const legacyRelativeFile = rootRelativeFile.startsWith('modules/')
        ? rootRelativeFile.slice('modules/'.length)
        : rootRelativeFile;
      const { blocks: testBlocks, lifecycleCalls, sharedNodes } = collectTestClockNodes(source, path);
      const sharedByScope = new Map();
      for (const node of sharedNodes) {
        const key = scopeKey(node.suiteScopes);
        const current = sharedByScope.get(key) ?? { source: [], suiteScopes: node.suiteScopes };
        current.source.push(node.source);
        sharedByScope.set(key, current);
      }
      const hasUnpinnedSharedFixture = [...sharedByScope.values()].some(({ source: sharedSource, suiteScopes }) => {
        const analysis = analyzeTestClockSource(sharedSource.join('\n'));
        return analysis.requiresPinning && !analysis.pinned && !hasPinnedSuiteSetup(lifecycleCalls, suiteScopes);
      });
      const hasUnpinnedLifecycleFixture = lifecycleCalls.some(({ source: lifecycleSource, suiteScopes }) => {
        const analysis = analyzeTestClockSource(lifecycleSource);
        return analysis.requiresPinning && !analysis.pinned && !hasPinnedSuiteSetup(lifecycleCalls, suiteScopes);
      });
      const hasUnpinnedFixture =
        hasUnpinnedSharedFixture ||
        hasUnpinnedLifecycleFixture ||
        testBlocks.some(({ source: block, suiteScopes }) => {
          const analysis = analyzeTestClockSource(block);
          return analysis.requiresPinning && !analysis.pinned && !hasPinnedSuiteSetup(lifecycleCalls, suiteScopes);
        });

      if (!hasUnpinnedFixture || allowlist[relativeFile] || allowlist[rootRelativeFile] || allowlist[legacyRelativeFile]) return [];
      return [{ file: relativeFile, reason }];
    }),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = findUnpinnedClockFixtures();
  if (violations.length > 0) {
    console.error('Unpinned dated test fixtures found:');
    for (const violation of violations) console.error(`- ${violation.file}: ${violation.reason}`);
    process.exitCode = 1;
  } else {
    console.log('Test clock pinning check passed.');
  }
}
