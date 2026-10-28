import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { localProject, renderConfig, developmentEnv, excludedServices, excludedServicesFor, localStorageServiceRoleKey } from './local-supabase.mjs';

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
  assert.equal(generated.PRISM_SESSION_TTL_SECONDS, '28800');
  assert.equal(generated.CORS_ORIGIN, 'http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004');
  assert.equal(generated.PRISM_MAIL_TRANSPORT, 'log');
  assert.deepEqual(
    ['PRISM_CLIENT_PORTAL_URL', 'PRISM_SUPPLIER_PORTAL_URL', 'PRISM_EVENT_PORTAL_URL'].map((name) => generated[name]),
    ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3004'],
  );
  assert.equal(generated.PRISM_GUEST_PORTAL_URL, undefined);
  assert.equal(generated.NEXT_PUBLIC_GUEST_PORTAL_URL, 'http://localhost:3003');
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

const LF = String.fromCharCode(10);
test('local Supabase Storage is opt-in and leaves every default untouched', () => {
  const project = localProject({ worktreeRoot: 'C:/work/prism', ports: { api: 4000 } });
  const ports = { api: 4000, client: 3001, supplier: 3002, guest: 3003, event: 3004 };
  const url = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  assert.equal(excludedServicesFor(), excludedServices);
  const started = excludedServicesFor({ storage: true }).split(',');
  assert.deepEqual(excludedServices.split(',').filter((service) => !started.includes(service)), ['storage-api']);
  const template = ['project_id = "prism-local"', '[db.pooler]', 'enabled = false', '[storage]', 'enabled = false', '[realtime]', 'enabled = false', ''].join(LF);
  assert.equal(renderConfig(template, project), renderConfig(template, project, { storage: false }));
  const enabled = renderConfig(template, project, { storage: true });
  assert.ok(enabled.includes(['[storage]', 'enabled = true', '[realtime]', 'enabled = false'].join(LF)));
  assert.ok(enabled.includes(['[db.pooler]', 'enabled = false'].join(LF)));
  assert.equal(developmentEnv(url, project, ports, 'secret').PRISM_STORAGE_PROVIDER, undefined);
  const withStorage = developmentEnv(url, project, ports, 'secret', { storage: { url: 'http://127.0.0.1:54321', serviceRoleKey: 'service-key' } });
  assert.deepEqual(
    [withStorage.PRISM_STORAGE_PROVIDER, withStorage.PRISM_STORAGE_SUPABASE_URL, withStorage.PRISM_STORAGE_SUPABASE_SERVICE_ROLE_KEY, withStorage.PRISM_STORAGE_SUPABASE_BUCKET],
    ['supabase', 'http://127.0.0.1:54321', 'service-key', 'prism-documents'],
  );
});

test('Storage boot reads only the checkout Storage service key when CLI status omits it', () => {
  const calls = [];
  const inspect = (...args) => { calls.push(args); return { status: 0, stdout: JSON.stringify(['ANON_KEY=public', 'SERVICE_KEY=generated-local-service-key', 'S3_PROTOCOL_ACCESS_KEY_SECRET=unrelated']) }; };
  assert.equal(localStorageServiceRoleKey('prism-test-checkout', inspect), 'generated-local-service-key');
  assert.deepEqual(calls[0][1], ['inspect', '--format', '{{json .Config.Env}}', 'supabase_storage_prism-test-checkout']);
  assert.equal(localStorageServiceRoleKey('missing', () => ({ status: 1, stdout: 'unavailable' })), '');
  assert.equal(localStorageServiceRoleKey('missing', () => ({ status: 0, stdout: 'not json' })), '');
  assert.equal(localStorageServiceRoleKey('missing', () => ({ status: 0, stdout: JSON.stringify(['ANON_KEY=public']) })), '');
});

test('Mailpit is explicit and generated host/container environments point to the local inbox', () => {
  const args = ['postgresql://postgres:postgres@127.0.0.1:54322/postgres', project, ports, 'secret'];
  assert.equal(developmentEnv(...args).PRISM_MAIL_TRANSPORT, 'log');
  const env = developmentEnv(...args, { mailpit: 'http://127.0.0.1:54324' });
  assert.equal(env.PRISM_MAIL_TRANSPORT, 'mailpit');
  assert.equal(env.PRISM_MAILPIT_URL, 'http://127.0.0.1:54324');
  assert.equal(env.RESEND_API_KEY, undefined);
});
