import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { AuthSecurityService } from '../src/modules/identity-access/application/auth/auth-security.service.ts';
import { seedProfile } from './seed-data.mjs';
import { inspectMigrationHistory } from './db-migration-history.mjs';
import { normalizeDatabaseConnection } from './db-connection-config.mjs';

const connectionString = process.env.PRISM_SEED_TEST_URL;
test('migrated PostgreSQL: prerequisites, atomic failure, reruns, edits, collisions, and fixture access links', { skip: !connectionString }, async t => {
  const connection = normalizeDatabaseConnection(connectionString, { env: { DB_SSL: 'false' } });
  const url = new URL(connection.connectionString);
  assert.ok(connection.isLoopback, 'Integration tests require loopback PostgreSQL.');
  const name = `prism_seed_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString, max: 1 });
  await admin.query(`CREATE DATABASE "${name}"`);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.href, max: 1 });
  try {
    const migration = spawnSync(process.execPath, [fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url)), 'migrate', 'deploy'], {
      cwd: new URL('../', import.meta.url), windowsHide: true, encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: url.href, DIRECT_URL: url.href, PRISM_ENV_FILE: '__no_implicit_environment__' },
    });
    assert.equal(migration.status, 0, 'Disposable database migration deploy must succeed.');
    const client = await pool.connect();
    try {
      const anchor = '2027-03-12T00:00:00+08:00';
      const run = options => seedProfile(client, { anchor, ...options });
      const count = async table => Number((await client.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
      await t.test('missing prerequisites and read-only previews do not insert', async () => {
        await assert.rejects(run({ profile: 'portal-uat' }), /prerequisites/);
        const preview = await run({ profile: 'accounts', mode: 'dry-run' });
        assert.equal(preview.missing.length, 12);
        assert.equal(await count('identity_access.users'), 0);
      });
      await t.test('a late constraint failure rolls back every earlier account insert', async () => {
        await client.query("CREATE FUNCTION public.reject_test_coordinator() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$");
        await client.query('CREATE TRIGGER seed_test_failure BEFORE INSERT ON operations.coordinators FOR EACH ROW EXECUTE FUNCTION public.reject_test_coordinator()');
        await assert.rejects(run({ profile: 'accounts', passwordFor: () => AuthSecurityService.hashPassword('test-only-password') }), /test failure/);
        assert.equal(await count('identity_access.users'), 0);
        assert.equal(await count('commercial.suppliers'), 0);
        await client.query('DROP TRIGGER seed_test_failure ON operations.coordinators');
        await client.query('DROP FUNCTION public.reject_test_coordinator()');
      });
      await t.test('accounts authenticate with the API password implementation and reruns preserve password/2FA', async () => {
        assert.equal((await run({ profile: 'accounts', passwordFor: () => AuthSecurityService.hashPassword('test-only-password') })).inserted, 12);
        const users = (await client.query('SELECT * FROM identity_access.users')).rows;
        assert.equal(users.length, 6);
        for (const user of users) assert.equal(AuthSecurityService.verifyPassword(user.password, 'test-only-password'), true);
        await client.query("UPDATE identity_access.users SET two_factor_secret='tester-2fa', failed_login_count=2 WHERE id='usr_pmcm'");
        assert.equal((await run({ profile: 'accounts' })).inserted, 0);
        assert.equal((await client.query("SELECT two_factor_secret FROM identity_access.users WHERE id='usr_pmcm'")).rows[0].two_factor_secret, 'tester-2fa');
      });
      await t.test('all scenario rows insert and a rerun preserves tester edits and bearer tokens', async () => {
        assert.equal((await run({ profile: 'portal-uat', mode: 'dry-run' })).missing.length, 70);
        assert.equal((await run({ profile: 'portal-uat' })).inserted, 70);
        const token = (await client.query("SELECT access_token FROM commercial.quote_requests WHERE id='rq_uat_xperto_submit'")).rows[0].access_token;
        await client.query("UPDATE live_ops.event_day_tasks SET notes='tester changed this', status='done' WHERE id='task_uat_live_registration'");
        assert.equal((await run({ profile: 'portal-uat' })).inserted, 0);
        assert.equal((await run({ profile: 'portal-uat', mode: 'verify' })).missing.length, 0);
        const task = (await client.query("SELECT notes,status FROM live_ops.event_day_tasks WHERE id='task_uat_live_registration'")).rows[0];
        assert.deepEqual(task, { notes: 'tester changed this', status: 'done' });
        assert.equal((await client.query("SELECT access_token FROM commercial.quote_requests WHERE id='rq_uat_xperto_submit'")).rows[0].access_token, token);
        assert.equal(await count('event_lifecycle.events'), 5);
      });
      await t.test('Manila schedule and account/event access links match the chosen scenario', async () => {
        const date = (await client.query("SELECT to_char(event_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI') AS local FROM event_lifecycle.events WHERE id='evt_uat_live_261024'")).rows[0].local;
        assert.equal(date, '2027-03-12 00:00');
        const links = await client.query("SELECT a.id FROM operations.coordinator_assignments a JOIN operations.coordinators c ON c.id=a.coordinator_id JOIN identity_access.users u ON u.id=c.user_id WHERE u.id='usr_coord' AND a.event_id='evt_uat_live_261024'");
        assert.equal(links.rowCount, 1);
        const roles = (await client.query('SELECT role FROM operations.coordinator_assignments')).rows;
        for (const { role } of roles) assert.ok(['General Coordinator', 'Registration Staff'].includes(role));
        assert.equal((await inspectMigrationHistory(client)).issues.length, 0);
      });
      await t.test('wrong owner links are rejected without changing tester data', async () => {
        await client.query("UPDATE commercial.quote_requests SET supplier_id='sup_bloom' WHERE id='rq_uat_xperto_submit'");
        await assert.rejects(run({ profile: 'portal-uat' }), /identity collision/);
        assert.equal((await client.query("SELECT supplier_id FROM commercial.quote_requests WHERE id='rq_uat_xperto_submit'")).rows[0].supplier_id, 'sup_bloom');
      });
    } finally { client.release(); }
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
