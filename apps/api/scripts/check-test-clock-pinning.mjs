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
const CLOCK_SURFACE_PATTERN = /(?:Date\.now|deadlineAt|slaDueAt|nextAttemptAt|leaseExpiresAt|actualEndedAt|actualStartedAt|plannedStartAt|plannedEndAt|feedback.?window|followUpInterval|(?:last)?(?:Conforme)?ReminderAt|ReminderSweep|freezeAt|retryAt|backoffUntil)/i;
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

function isTestCall(expression) {
  if (ts.isIdentifier(expression)) return expression.text === 'it' || expression.text === 'test';
  return (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    (expression.expression.text === 'it' || expression.expression.text === 'test')
  );
}

function isTestCallback(node) {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

function isLifecycleCall(expression) {
  return ts.isIdentifier(expression) && (expression.text === 'beforeEach' || expression.text === 'beforeAll');
}

function collectTestBlockSpans(source, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const blocks = [];

  function visit(node) {
    if (ts.isCallExpression(node) && isTestCall(node.expression)) {
      const callback = [...node.arguments].reverse().find(isTestCallback);
      if (callback) {
        blocks.push({
          source: source.slice(node.getStart(sourceFile), node.getEnd()),
          start: node.getStart(sourceFile),
          end: node.getEnd(),
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return blocks;
}

export function collectTestBlocks(source, fileName) {
  return collectTestBlockSpans(source, fileName).map((block) => block.source);
}

function maskRanges(source, ranges) {
  const characters = source.split('');
  for (const { start, end } of ranges) {
    for (let index = start; index < end; index += 1) characters[index] = ' ';
  }
  return characters.join('');
}

function hasPinnedSuiteSetup(source, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let pinned = false;

  function visit(node) {
    if (pinned) return;
    if (ts.isCallExpression(node) && isLifecycleCall(node.expression)) {
      const callback = [...node.arguments].reverse().find(isTestCallback);
      if (callback) {
        const analysis = analyzeTestClockSource(source.slice(node.getStart(sourceFile), node.getEnd()));
        pinned = analysis.hasFakeTimers && analysis.hasSystemTime;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return pinned;
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
      const testBlocks = collectTestBlockSpans(source, path);
      const suitePinned = hasPinnedSuiteSetup(source, path);
      const sharedAnalysis = analyzeTestClockSource(maskRanges(source, testBlocks));
      const hasUnpinnedFixture =
        (sharedAnalysis.requiresPinning && !sharedAnalysis.pinned && !suitePinned) ||
        testBlocks.some(({ source: block }) => {
          const analysis = analyzeTestClockSource(block);
          return analysis.requiresPinning && !analysis.pinned && !suitePinned;
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
