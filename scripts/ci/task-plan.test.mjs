import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { requireSuccessfulJobs } from './check-results.mjs';
import { installHooks } from './install-hooks.mjs';
import { dirtyCheckInputs, parsePushUpdates, pushSelection, runPrePush } from './pre-push.mjs';
import { runTasks } from './run-tasks.mjs';
import { git, selectTasks, taskArguments } from './task-plan.mjs';

const zero = '0'.repeat(40);

function fixture(t) {
  const repo = mkdtempSync(join(tmpdir(), 'prism-ci-'));
  t.after(() => {
    assert.ok(resolve(repo).startsWith(join(tmpdir(), 'prism-ci-')));
    rmSync(repo, { recursive: true, force: true });
  });
  const write = (file, contents) => {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    writeFileSync(join(repo, file), typeof contents === 'string' ? contents : JSON.stringify(contents));
  };
  write('package.json', { private: true, packageManager: 'npm@11.6.2', workspaces: ['apps/*', 'packages/*'] });
  write('turbo.json', { tasks: { build: { dependsOn: ['^build'] } } });
  for (const [directory, name, dependencies] of [
    ['packages/types', '@prism/types', {}], ['packages/ui', '@prism/ui', { '@prism/types': '*' }],
    ['apps/event', '@prism/event', { '@prism/ui': '*' }], ['apps/client', '@prism/client', { '@prism/types': '*' }],
    ['apps/guest', '@prism/guest', {}],
  ]) {
    write(`${directory}/package.json`, { name, dependencies, scripts: { lint: 'echo lint', typecheck: 'echo typecheck', build: 'echo build' } });
    write(`${directory}/src/index.ts`, 'export const value = 1;\n');
  }
  git(repo, ['init', '-q', '-b', 'staging']);
  git(repo, ['config', 'user.email', 'ci-fixture@example.invalid']);
  git(repo, ['config', 'user.name', 'CI fixture']);
  const commit = () => {
    git(repo, ['add', '.']);
    git(repo, ['-c', 'core.hooksPath=', 'commit', '-qm', 'fixture change']);
    return git(repo, ['rev-parse', 'HEAD']);
  };
  const base = commit();
  git(repo, ['update-ref', 'refs/remotes/origin/staging', base]);
  return { repo, write, commit, base };
}

test('a contract change selects every dependent and includes their real Turbo build targets', (t) => {
  const f = fixture(t);
  f.write('packages/types/src/index.ts', 'export const value = 2;\n');
  f.commit();
  const plan = selectTasks(f.repo, { baseRef: f.base, tasks: ['build'] });
  assert.equal(plan.mode, 'affected');
  assert.deepEqual(plan.packages, ['@prism/client', '@prism/event', '@prism/types', '@prism/ui']);
  assert.deepEqual(taskArguments(['build'], plan), ['run', 'build', '--filter=@prism/client', '--filter=@prism/event', '--filter=@prism/types', '--filter=@prism/ui']);
  const turbo = createRequire(import.meta.url).resolve('turbo/bin/turbo');
  const dryRun = JSON.parse(execFileSync(process.execPath, [turbo, ...taskArguments(['build'], plan), '--dry-run=json'], {
    cwd: f.repo, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TURBO_TELEMETRY_DISABLED: '1' },
  }));
  assert.deepEqual(dryRun.tasks.map((task) => task.taskId).sort(), ['@prism/client#build', '@prism/event#build', '@prism/types#build', '@prism/ui#build']);
});

test('portal edits and deleted source files keep unrelated portals out of selection', (t) => {
  const f = fixture(t);
  git(f.repo, ['rm', 'apps/event/src/index.ts']);
  f.commit();
  assert.deepEqual(selectTasks(f.repo, { baseRef: f.base, tasks: ['typecheck'] }).packages, ['@prism/event']);
});

test('selection compares a diverged branch to its merge base rather than including upstream-only changes', (t) => {
  const f = fixture(t);
  git(f.repo, ['switch', '-qc', 'feature']);
  f.write('apps/event/src/index.ts', 'export const value = 2;\n');
  f.commit();
  git(f.repo, ['switch', '-q', 'staging']);
  f.write('apps/guest/src/index.ts', 'export const value = 3;\n');
  f.commit();
  git(f.repo, ['switch', '-q', 'feature']);
  assert.deepEqual(selectTasks(f.repo, { baseRef: 'staging', tasks: ['build'] }).packages, ['@prism/event']);
});

test('missing history, unknown paths, manifests, empty diffs, and unsupported task selection fall back to the full graph', (t) => {
  const f = fixture(t);
  for (const baseRef of [undefined, 'missing-ref', f.base]) {
    assert.equal(selectTasks(f.repo, { baseRef, tasks: ['build'] }).mode, 'full');
  }
  for (const [file, contents] of [['turbo.json', '{}'], ['apps/new-portal/src/page.ts', 'export {};'],
    ['packages/types/package.json', { name: '@prism/types', scripts: { build: 'echo build' } }]]) {
    f.write(file, contents);
    f.commit();
    assert.equal(selectTasks(f.repo, { baseRef: f.base, tasks: ['build'] }).mode, 'full');
  }
  assert.throws(() => taskArguments(['build'], { mode: 'affected', packages: [] }), /Invalid task selection/);
  assert.throws(() => taskArguments(['test:ci'], { mode: 'full' }, { concurrency: 0 }), /positive integer/);
});

test('required aggregate rejects failure, cancellation, skip, missing results, and malformed input', () => {
  requireSuccessfulJobs({ checks: { result: 'success' }, tests: { result: 'success' } }, ['checks', 'tests']);
  for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
    assert.throws(() => requireSuccessfulJobs({ checks: { result: 'success' }, tests: { result } }, ['checks', 'tests']), /tests=/);
  }
  assert.throws(() => requireSuccessfulJobs({}, ['checks']), /missing/);
  for (const results of [null, [], 'success']) assert.throws(() => requireSuccessfulJobs(results, ['checks']), /Missing required/);
});

test('aggregate CLI fails closed on invalid JSON and missing expected jobs', () => {
  const script = fileURLToPath(new URL('./check-results.mjs', import.meta.url));
  assert.equal(execFileSync(process.execPath, [script, 'checks'], { encoding: 'utf8', env: { ...process.env, REQUIRED_JOB_RESULTS: '{"checks":{"result":"success"}}' } }).trim(), 'Every required job succeeded.');
  for (const input of ['{', '{}', '{"checks":{"result":"skipped"}}']) {
    assert.throws(() => execFileSync(process.execPath, [script, 'checks'], { stdio: 'pipe', env: { ...process.env, REQUIRED_JOB_RESULTS: input } }), (error) => error.status === 1);
  }
});

test('pre-push checks the committed push range and permits unrelated dirty workspace work', (t) => {
  const f = fixture(t);
  f.write('apps/event/src/index.ts', 'export const value = 2;\n');
  const head = f.commit();
  f.write('apps/guest/src/index.ts', 'export const value = 3;\n');
  const input = `refs/heads/feature ${head} refs/heads/feature ${f.base}\n`;
  const selection = pushSelection(f.repo, input);
  assert.deepEqual(selection.packages, ['@prism/event']);
  assert.deepEqual(dirtyCheckInputs(f.repo, selection), []);
  let called;
  assert.equal(runPrePush({ repo: f.repo, input, execute: (args) => { called = args; return 17; } }), 17);
  assert.deepEqual(called.tasks, ['lint', 'typecheck']);
  assert.deepEqual(called.plan.packages, ['@prism/event']);
});

test('pre-push refuses dirty selected source and dependency inputs instead of checking different content', (t) => {
  const f = fixture(t);
  f.write('apps/event/src/index.ts', 'export const value = 2;\n');
  const head = f.commit();
  const input = `refs/heads/feature ${head} refs/heads/feature ${f.base}\n`;
  f.write('packages/types/src/index.ts', 'export const value = 3;\n');
  assert.throws(() => runPrePush({ repo: f.repo, input, execute: () => assert.fail('should not execute checks') }), /packages\/types\/src\/index.ts/);
  f.write('apps/event/src/new.ts', 'export const newValue = 1;\n');
  assert.ok(dirtyCheckInputs(f.repo, pushSelection(f.repo, input)).includes('apps/event/src/new.ts'));
});

test('new remote branches use staging ancestry, unavailable remote SHAs run all checks, and deletions skip', (t) => {
  const f = fixture(t);
  f.write('apps/client/src/index.ts', 'export const value = 2;\n');
  const head = f.commit();
  assert.deepEqual(pushSelection(f.repo, `refs/heads/feature ${head} refs/heads/feature ${zero}\n`).packages, ['@prism/client']);
  assert.equal(pushSelection(f.repo, `refs/heads/feature ${head} refs/heads/feature ${'a'.repeat(40)}\n`).mode, 'full');
  assert.equal(runPrePush({ repo: f.repo, input: `(delete) ${zero} refs/heads/old ${f.base}\n`, execute: () => assert.fail('deletion must not execute checks') }), 0);
  assert.throws(() => pushSelection(f.repo, `refs/heads/old ${f.base} refs/heads/old ${zero}\n`), /checked out/);
  assert.throws(() => parsePushUpdates('untrusted invalid input'), /Invalid Git/);
});

test('task execution preserves failed commands and treats a terminated worker as failure', () => {
  const repo = fileURLToPath(new URL('../../', import.meta.url));
  let invocation;
  assert.equal(runTasks({ repo, tasks: ['test:ci'], plan: { mode: 'full', reason: 'fixture' }, concurrency: 1,
    run: (...args) => { invocation = args; return { status: 9 }; } }), 9);
  assert.ok(invocation[1].includes('--concurrency=1'));
  assert.equal(invocation[2].shell, undefined);
  assert.equal(runTasks({ repo, tasks: ['build'], plan: { mode: 'full', reason: 'fixture' }, run: () => ({ status: null, signal: 'SIGTERM' }) }), 1);
});

test('hook setup is repeatable, skips CI, and preserves an existing hook integration', (t) => {
  const f = fixture(t);
  assert.equal(installHooks(f.repo, { ci: 'true' }), 'skipped');
  assert.throws(() => git(f.repo, ['config', '--get', 'core.hooksPath']));
  assert.equal(installHooks(f.repo, { ci: '' }), 'installed');
  assert.equal(installHooks(f.repo, { ci: '' }), 'installed');
  assert.equal(git(f.repo, ['config', '--get', 'core.hooksPath']), '.githooks');
  git(f.repo, ['config', '--local', 'core.hooksPath', 'existing-hooks']);
  assert.equal(installHooks(f.repo, { ci: '' }), 'preserved');
  assert.equal(git(f.repo, ['config', '--get', 'core.hooksPath']), 'existing-hooks');
});
