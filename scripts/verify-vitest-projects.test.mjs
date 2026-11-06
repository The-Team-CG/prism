import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

test('API test projects discover every existing behavior file exactly once', () => {
  const root = resolve('apps/api');
  const expected = ['src', 'test/integration'].flatMap((directory) =>
    readdirSync(resolve(root, directory), { recursive: true })
      .filter((file) => file.endsWith('.test.ts'))
      .map((file) => resolve(root, directory, file).replaceAll('\\', '/'))).sort();
  const result = spawnSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'list', '--filesOnly', '--json'],
    { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  const discovered = JSON.parse(result.stdout);
  assert.deepEqual(discovered.map((item) => item.file).sort(), expected,
    'Project partitioning must not omit or duplicate behavior files, including database suites.');
  assert.ok(discovered.some((item) => item.projectName === 'shared-policy'));
  assert.ok(discovered.some((item) => item.projectName === 'isolated'));
});
