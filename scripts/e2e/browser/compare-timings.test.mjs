import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareBrowserTimings } from './compare-timings.mjs';

const samples = () => ['development', 'production'].flatMap(server => ['desktop', 'mobile'].flatMap(project =>
  Array.from({ length: 5 }, (_, index) => ({ server, project, sample: index + 1, revision: 'a'.repeat(40), node: 'v24.19.0',
    platform: 'linux', arch: 'x64', logicalCpus: 4, image: 'ubuntu26', imageVersion: 'one',
    success: true, completeSuite: true, elapsedMs: (server === 'production' ? 500 : 1000) + index * 10 + (project === 'mobile' ? 20 : 0),
    phases: ['create-database', 'mailpit', 'migrate', 'seed-accounts', 'seed-portal-uat', 'build-api', 'api-ready',
      'prepare-fixtures', 'portals-ready', 'playwright', 'cleanup-restore portal files', 'cleanup-stop Mailpit',
      'cleanup-drop database', 'cleanup-close pool', ...(server === 'production' ? ['build-client', 'build-supplier', 'build-guest', 'build-event'] : [])]
      .map(phase => ({ phase, status: 'passed' })) }))));

test('browser comparisons include the complete build/setup time and both viewport critical paths', () => {
  const result = compareBrowserTimings(samples());
  assert.deepEqual(result.modes.development.criticalPath, { minMs: 1020, medianMs: 1040, maxMs: 1060 });
  assert.deepEqual(result.modes.production.criticalPath, { minMs: 520, medianMs: 540, maxMs: 560 });
  assert.equal(result.productionClearlyFaster, true);
});

test('failed, missing, duplicated, filtered and mixed-source samples cannot establish a speedup', () => {
  assert.throws(() => compareBrowserTimings(samples().slice(1)), /Missing or extra/);
  for (const patch of [{ success: false }, { completeSuite: false }, { elapsedMs: 0 }, { phases: [] }, { project: 'all' }]) {
    const runs = samples(); Object.assign(runs[0], patch);
    assert.throws(() => compareBrowserTimings(runs), /Failed, partial or invalid/);
  }
  for (const patch of [{ revision: 'b'.repeat(40) }, { node: 'v24.20.0' }, { logicalCpus: 2 }, { imageVersion: 'two' }]) {
    const runs = samples(); Object.assign(runs[0], patch);
    assert.throws(() => compareBrowserTimings(runs), /mix revisions or runner configurations/);
  }
  const duplicated = samples(); duplicated[0] = duplicated[1];
  assert.throws(() => compareBrowserTimings(duplicated), /Duplicate/);
  const skippedBuild = samples();
  skippedBuild.find(run => run.server === 'production').phases = skippedBuild.find(run => run.server === 'production').phases.filter(phase => phase.phase !== 'build-event');
  assert.throws(() => compareBrowserTimings(skippedBuild), /Failed, partial or invalid/);
});

test('one sample and overlapping ranges remain insufficient to switch production defaults', () => {
  assert.equal(compareBrowserTimings(samples().filter(run => run.sample === 1), 1).productionClearlyFaster, false);
  const runs = samples(); runs.find(run => run.server === 'production').elapsedMs = 1050;
  assert.equal(compareBrowserTimings(runs).productionClearlyFaster, false);
});
