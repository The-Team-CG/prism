import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { localProject, renderConfig, developmentEnv } from './local-supabase.mjs';

const ports = { api: 4000, client: 3001, supplier: 3002, guest: 3003, event: 3004 };
const project = localProject({ worktreeRoot: 'C:/Codes/prism', ports });
test('checkout identity is stable and independent worktrees reserve distinct infrastructure ports', () => {
  assert.equal(localProject({ worktreeRoot: 'c:\\Codes\\prism', ports }).id, project.id);
  const other = localProject({ worktreeRoot: 'C:/Codes/worktree', ports: { ...ports, api: 4020 } });
  assert.notEqual(other.id, project.id);
  assert.equal(other.dbPort, 54342);
  assert.equal(other.studioPort, 54343);
  assert.throws(() => localProject({ worktreeRoot: 'x', ports: { api: 9999 } }));
});
test('generated environments contain one local URL, clear stale overrides, and reject hosted status', () => {
  const generated = developmentEnv('postgresql://postgres:postgres@127.0.0.1:54322/postgres', project, ports, 'local-secret');
  assert.equal(generated.DIRECT_URL, '');
  assert.equal(generated.SUPABASE_DB_URL, '');
  assert.equal(generated.DB_SSL, 'false');
  assert.equal(generated.PRISM_TRUST_PROXY, 'false');
  assert.equal(generated.CORS_ORIGIN, 'http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004');
  assert.throws(() => developmentEnv('postgresql://postgres:secret@prod.example.com:54322/postgres', project, ports, 'local-secret'));
});
test('config rendering does not replace unrelated ports', () => {
  const other = localProject({ worktreeRoot: 'worktree', ports: { ...ports, api: 4010 } });
  assert.equal(renderConfig('project_id = "prism-local"\nport = 54322\nport = 12345\n', other), `project_id = "${other.id}"\nport = 54332\nport = 12345\n`);
});

test('launch preflight refuses an unprepared shell and inherited hosted migration overrides', () => {
  const run = (env) => spawnSync(process.execPath, ['scripts/local-supabase.mjs', 'check'], { env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.notEqual(run({ PRISM_LOCAL_DEV: '' }).status, 0);
  const generated = developmentEnv('postgresql://postgres:postgres@127.0.0.1:54322/postgres', project, ports, 'local-secret');
  assert.equal(run(generated).status, 0);
  assert.notEqual(run({ ...generated, DIRECT_URL: 'postgresql://postgres:secret@prod.example.com:5432/postgres' }).status, 0);
});
