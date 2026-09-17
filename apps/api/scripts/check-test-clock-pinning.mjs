import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE_ROOT = join(SCRIPT_ROOT, 'src', 'modules');
const DEFAULT_ALLOWLIST_PATH = join(dirname(fileURLToPath(import.meta.url)), 'test-clock-allowlist.json');

// This intentionally small heuristic catches tests for deadline-like surfaces,
// not every use of Date. A dated literal plus one of these markers means the
// test must pin the clock, or document why its date is inert in the allowlist.
const DATE_LITERAL_PATTERN = /new\s+Date\s*\(\s*['"]20\d{2}-/;
const CLOCK_SURFACE_PATTERN = /(?:Date\.now|deadlineAt|slaDueAt|nextAttemptAt|leaseExpiresAt|actualEndedAt|actualStartedAt|plannedStartAt|plannedEndAt|feedback.?window|reminder|freeze|escalat|retry|backoff)/i;
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

export function findUnpinnedClockFixtures({ sourceRoot = DEFAULT_SOURCE_ROOT, allowlistPath = DEFAULT_ALLOWLIST_PATH } = {}) {
  const allowlist = loadTestClockAllowlist(allowlistPath);
  return collectTestFiles(sourceRoot).flatMap((path) => {
    const relativeFile = relativePath(sourceRoot, path);
    const analysis = analyzeTestClockSource(readFileSync(path, 'utf8'));
    if (!analysis.requiresPinning || analysis.pinned || allowlist[relativeFile]) return [];
    return [{ file: relativeFile, reason: 'dated fixture references a clock-sensitive surface without vi.useFakeTimers() and vi.setSystemTime()' }];
  });
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
