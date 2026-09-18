import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeTestClockSource,
  findUnpinnedClockFixtures,
  loadTestClockAllowlist,
} from './check-test-clock-pinning.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./check-test-clock-pinning.mjs', import.meta.url));
const API_ROOT = resolve(SCRIPT_PATH, '..', '..');

function fixtureRoot(files) {
  const root = mkdtempSync(join(tmpdir(), 'prism-test-clocks-'));
  for (const [file, source] of Object.entries(files)) {
    const path = join(root, file);
    const directory = resolve(path, '..');
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, source);
  }
  return root;
}

describe('test clock pinning heuristic', () => {
  it('requires a fake and explicitly set system clock for dated clock-sensitive fixtures', () => {
    assert.deepEqual(analyzeTestClockSource("const due = new Date('2026-09-08'); expect(Date.now()).toBeGreaterThan(due.getTime());"), {
      hasDateLiteral: true,
      hasClockSurface: true,
      hasFakeTimers: false,
      hasSystemTime: false,
      requiresPinning: true,
      pinned: false,
    });
    assert.equal(analyzeTestClockSource("vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-08')); const due = new Date('2026-09-08');").pinned, true);
  });

  it('does not require pinning for fixture-only dates', () => {
    assert.equal(analyzeTestClockSource("const createdAt = new Date('2026-09-08'); expect(createdAt).toBeInstanceOf(Date);").requiresPinning, false);
  });

  it('reports an unpinned file and accepts a reasoned allowlist entry', () => {
    const root = fixtureRoot({
      'live.test.ts': "const deadlineAt = new Date('2026-09-08'); expect(Date.now()).toBeGreaterThan(deadlineAt.getTime());",
      'pinned.test.ts': "vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-08')); const deadlineAt = new Date('2026-09-08');",
      'inert.test.ts': "const createdAt = new Date('2026-09-08');",
    });
    const allowlistPath = join(root, 'allowlist.json');
    writeFileSync(allowlistPath, JSON.stringify({ files: { 'inert.test.ts': 'Fixture is only serialized and never compared with the clock.' } }));
    try {
      assert.deepEqual(findUnpinnedClockFixtures({ sourceRoot: root, allowlistPath }), [{
        file: 'live.test.ts',
        reason: 'dated fixture references a clock-sensitive surface without vi.useFakeTimers() and vi.setSystemTime()',
      }]);
      assert.equal(loadTestClockAllowlist(allowlistPath)['inert.test.ts'], 'Fixture is only serialized and never compared with the clock.');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('scans source and integration-test roots, not only bounded modules', () => {
    const root = fixtureRoot({
      'src/compatibility/sample.test.ts': "const due = new Date('2026-09-08'); expect(Date.now()).toBeGreaterThan(due.getTime());",
      'test/integration/clock.test.ts': "const due = new Date('2026-09-08'); expect(Date.now()).toBeGreaterThan(due.getTime());",
    });
    const allowlistPath = join(root, 'allowlist.json');
    writeFileSync(allowlistPath, JSON.stringify({ files: {} }));
    try {
      assert.deepEqual(
        findUnpinnedClockFixtures({
          sourceRoots: [
            { path: join(root, 'src'), prefix: 'src' },
            { path: join(root, 'test'), prefix: 'test' },
          ],
          allowlistPath,
        }).map((violation) => violation.file),
        ['src/compatibility/sample.test.ts', 'test/integration/clock.test.ts'],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not let one pinned test mask another test in the same file', () => {
    const root = fixtureRoot({
      'mixed.test.ts': `
        it('pinned fixture', () => {
          vi.useFakeTimers();
          vi.setSystemTime(new Date('2026-09-08'));
          const due = new Date('2026-09-08');
          expect(Date.now()).toBeGreaterThanOrEqual(due.getTime());
        });
        it('unpinned fixture', () => {
          const due = new Date('2026-09-08');
          expect(Date.now()).toBeGreaterThan(due.getTime());
        });
      `,
    });
    const allowlistPath = join(root, 'allowlist.json');
    writeFileSync(allowlistPath, JSON.stringify({ files: {} }));
    try {
      assert.deepEqual(findUnpinnedClockFixtures({ sourceRoot: root, allowlistPath }), [{
        file: 'mixed.test.ts',
        reason: 'dated fixture references a clock-sensitive surface without vi.useFakeTimers() and vi.setSystemTime()',
      }]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires a suite pin when a shared clock-sensitive fixture is outside test blocks', () => {
    const root = fixtureRoot({
      'shared-fixture.test.ts': `
        const fixture = { deadlineAt: new Date('2026-09-08') };
        it('uses the shared fixture', () => {
          expect(Date.now()).toBeGreaterThan(fixture.deadlineAt.getTime());
        });
      `,
    });
    const allowlistPath = join(root, 'allowlist.json');
    writeFileSync(allowlistPath, JSON.stringify({ files: {} }));
    try {
      assert.deepEqual(findUnpinnedClockFixtures({ sourceRoot: root, allowlistPath }), [{
        file: 'shared-fixture.test.ts',
        reason: 'dated fixture references a clock-sensitive surface without vi.useFakeTimers() and vi.setSystemTime()',
      }]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes against the checked-in module tests', () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH], { cwd: API_ROOT, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /passed/);
  });
});
