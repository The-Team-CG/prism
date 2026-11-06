import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { dependencyCacheKeys } from './dependency-cache.mjs';
import { cachePruningPlan, pruneCaches } from './prune-caches.mjs';

test('installed dependencies require matching installer inputs and runtime, while source outputs rebuild separately', t => {
  const repo = mkdtempSync(join(tmpdir(), 'prism-cache-'));
  t.after(() => { assert.ok(repo.startsWith(join(tmpdir(), 'prism-cache-'))); rmSync(repo, { recursive: true, force: true }); });
  const write = (path, text) => { mkdirSync(dirname(join(repo, path)), { recursive: true }); writeFileSync(join(repo, path), typeof text === 'string' ? text : JSON.stringify(text)); };
  write('package.json', { workspaces: ['apps/*', 'packages/*'] });
  write('package-lock.json', { packages: { 'node_modules/@playwright/test': { version: '1.64.1' } } });
  write('apps/api/package.json', { name: 'api' });
  write('packages/types/package.json', { name: 'types' });
  for (const path of ['apps/api/prisma/schema.prisma', 'apps/api/prisma.config.ts', 'apps/api/src/kernel/database/db-connection-config.cjs']) write(path, '// original');
  const runtime = { node: 'v24.19.0', platform: 'linux', arch: 'x64', image: 'ubuntu26' };
  const original = dependencyCacheKeys(repo, runtime);
  write('packages/types/src/index.ts', 'export const newSource = true;');
  assert.deepEqual(dependencyCacheKeys(repo, runtime), original, 'Shared source does not belong in an installed-dependency archive.');
  for (const path of ['apps/api/package.json', 'package-lock.json', 'apps/api/prisma/schema.prisma', 'apps/api/prisma.config.ts']) {
    const before = readFileSync(join(repo, path), 'utf8');
    write(path, `${before}\n`);
    assert.notEqual(dependencyCacheKeys(repo, runtime).dependencies, original.dependencies, path);
    write(path, before);
  }
  for (const [key, value] of [['node', 'v24.20.0'], ['platform', 'win32'], ['arch', 'arm64'], ['image', 'ubuntu24']]) {
    assert.notEqual(dependencyCacheKeys(repo, { ...runtime, [key]: value }).dependencies, original.dependencies, key);
  }
  write('.npmrc', 'ignore-scripts=true');
  assert.notEqual(dependencyCacheKeys(repo, runtime).dependencies, original.dependencies);
  write('package-lock.json', { packages: { 'node_modules/@playwright/test': { version: '1.65.0' } } });
  assert.notEqual(dependencyCacheKeys(repo, runtime).browser, original.browser);
  write('package.json', { workspaces: ['apps/*', 'packages/*', 'tools/*'] });
  write('tools/check/package.json', { name: 'extra-workspace', scripts: { postinstall: 'one' } });
  const extended = dependencyCacheKeys(repo, runtime);
  write('tools/check/package.json', { name: 'extra-workspace', scripts: { postinstall: 'two' } });
  assert.notEqual(dependencyCacheKeys(repo, runtime).dependencies, extended.dependencies, 'Cache inputs do not depend on the affected mapper supporting a new workspace layout.');
  assert.throws(() => dependencyCacheKeys(repo, { ...runtime, image: 'invalid\noutput' }), /Invalid cache runtime/);
});

const entry = (id, key, size, day = id, ref = 'refs/heads/staging') => ({ id, key, size_in_bytes: size, ref,
  last_accessed_at: `2026-11-${String(day).padStart(2, '0')}T00:00:00Z` });

test('cache retention removes legacy and superseded owned entries while protecting current staging and unrelated caches', () => {
  const inventory = [entry(1, 'turbo-v2-old', 50), entry(2, 'someone-elses-cache', 100),
    entry(3, 'prism-deps-v1-current', 40, 1), entry(4, 'prism-deps-v1-newer-pr', 30, 4, 'refs/pull/2/merge'),
    entry(5, 'prism-deps-v1-old-pr', 30, 2, 'refs/pull/1/merge'), entry(6, 'prism-playwright-v1-current', 10)];
  const plan = cachePruningPlan(inventory, { keepKeys: ['prism-deps-v1-current'], budgetBytes: 150 });
  assert.deepEqual(plan.remove.map(item => item.id).sort(), [1, 4, 5]);
  assert.equal(plan.remainingBytes, 150);
  const repeated = cachePruningPlan(inventory.filter(item => !plan.remove.includes(item)), { keepKeys: ['prism-deps-v1-current'], budgetBytes: 150 });
  assert.deepEqual(repeated.remove, []);
  assert.equal(cachePruningPlan([entry(1, 'unrelated', 500)], { budgetBytes: 10 }).remainingBytes, 500);
  assert.throws(() => cachePruningPlan([{ ...entry(1, 'prism-deps-v1-bad', 10), size_in_bytes: -1 }]), /Invalid cache inventory/);
});

test('cache maintenance refuses PRs before requesting anything and only deletes owned cache IDs', async () => {
  const requested = [], logs = [];
  const args = { repository: 'example/prism', token: 'private-token', event: 'push', ref: 'refs/heads/staging', keepKeys: [], log: value => logs.push(value),
    request: async (url, options) => {
      requested.push({ url, method: options.method ?? 'GET' });
      assert.equal(options.headers.Authorization, 'Bearer private-token');
      if (!options.method) return { ok: true, json: async () => ({ actions_caches: [entry(1, 'turbo-v2-old', 100), entry(2, 'unrelated', 100)] }) };
      return { ok: false, status: 404 };
    } };
  await assert.rejects(pruneCaches({ ...args, event: 'pull_request' }), /trusted staging push/);
  assert.deepEqual(requested, []);
  await pruneCaches(args);
  assert.deepEqual(requested.map(item => item.method), ['GET', 'DELETE']);
  assert.match(requested[1].url, /\/actions\/caches\/1$/);
  assert.ok(logs.every(value => !value.includes('private-token')));
  await assert.rejects(pruneCaches({ ...args, request: async () => ({ ok: false, status: 403 }) }), /inventory failed \(403\)/);
});
