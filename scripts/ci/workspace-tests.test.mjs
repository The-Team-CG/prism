import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { dependencyClosure, taskArguments, workspaces } from './task-plan.mjs';
import { runWorkspaceTests, workspaceTestMatrix } from './workspace-tests.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));

test('test matrices include each full or affected dependent suite exactly once, with separate coverage artifacts', () => {
  const graph = workspaces(repo), suites = graph.filter(item => item.scripts['test:ci']);
  const full = workspaceTestMatrix(repo, { mode: 'full' }).include;
  assert.deepEqual(full.map(item => item.workspace).sort(), suites.map(item => item.name).sort());
  assert.equal(new Set(full.map(item => item.id)).size, full.length);
  assert.ok(full.every(item => item.coverage.endsWith('/coverage/lcov.info')));
  const packages = dependencyClosure(['@prism/types'], graph);
  const affected = workspaceTestMatrix(repo, { mode: 'affected', packages }).include;
  assert.deepEqual(affected.map(item => item.workspace).sort(), suites.filter(item => packages.includes(item.name)).map(item => item.name).sort());
  assert.deepEqual(workspaceTestMatrix(repo, { mode: 'affected', packages: ['@prism/event'] }).include.map(item => item.workspace), ['@prism/event']);
});

test('uncertain and unsupported test mapping executes the complete test graph instead of an empty successful matrix', t => {
  const fallback = [{ workspace: '*', id: 'full', coverage: '**/coverage/lcov.info' }];
  for (const plan of [{ mode: 'affected', packages: [] }, { mode: 'affected', packages: ['unknown'] }, { mode: 'invalid' }]) {
    assert.deepEqual(workspaceTestMatrix(repo, plan).include, fallback);
  }
  const directory = mkdtempSync(join(tmpdir(), 'prism-test-matrix-'));
  t.after(() => { assert.ok(directory.startsWith(join(tmpdir(), 'prism-test-matrix-'))); rmSync(directory, { recursive: true, force: true }); });
  assert.deepEqual(workspaceTestMatrix(directory, { mode: 'full' }).include, fallback);
  let invocation;
  assert.equal(runWorkspaceTests(repo, '*', (...args) => { invocation = args; return { status: 13 }; }), 13);
  assert.ok(invocation[1].includes('--concurrency=1'));
  assert.ok(invocation[1].every(value => !value.startsWith('--filter=')));
  assert.throws(() => runWorkspaceTests(repo, 'unknown'), /existing test workspace/);
});

test('a workspace job runs its suite and build dependencies without running other workspace suites', () => {
  const turbo = createRequire(import.meta.url).resolve('turbo/bin/turbo');
  const args = taskArguments(['test:ci'], { mode: 'affected', packages: ['prism-api'] }, { concurrency: 1 });
  const plan = JSON.parse(execFileSync(process.execPath, [turbo, ...args, '--dry-run=json'], {
    cwd: repo, encoding: 'utf8', windowsHide: true, env: { ...process.env, TURBO_TELEMETRY_DISABLED: '1' },
  }));
  assert.deepEqual(plan.tasks.filter(item => item.task === 'test:ci').map(item => item.taskId), ['prism-api#test:ci']);
  assert.ok(plan.tasks.some(item => item.taskId === '@prism/types#build'));
  assert.equal(runWorkspaceTests(repo, 'prism-api', () => ({ status: null, signal: 'SIGTERM' })), 1);
});
