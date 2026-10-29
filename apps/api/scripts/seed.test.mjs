import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSeedOptions } from './seed.mjs';
import { assertSeedTarget, describeSeedTarget, loadSeedEnvironment, scenarioAnchor } from './seed-target.mjs';
import { compareMigrationHistory, migrationChecksums } from './db-migration-history.mjs';

test('migration doctor reports proven historical fixtures separately and rejects edited or unrelated SQL', () => {
  const name = '20261021104500_event-lifecycle_uat_portal_data';
  const sql = readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url));
  const applied = [{ migration_name: name, checksum: 'b2007aec777f5189d66486d3dd3437dbdf902da49a536387c74ac825237803c2', finished_at: new Date(), rolled_back_at: null }];
  const report = compareMigrationHistory(new Map([[name, migrationChecksums(sql)]]), applied);
  assert.deepEqual(report.issues, []);
  assert.deepEqual(report.historicalVariants, [name]);
  assert.deepEqual(report.lineEndingOnly, []);
  const edited = compareMigrationHistory(new Map([[name, migrationChecksums(`${sql}\n-- edited`)]]), applied);
  assert.equal(edited.issues[0].issue, 'checksum-mismatch');
  const unrelated = compareMigrationHistory(new Map([['unrelated', migrationChecksums(sql)]]), [{ ...applied[0], migration_name: 'unrelated' }]);
  assert.equal(unrelated.issues[0].issue, 'checksum-mismatch');
});

test('target checks reject production, remote local labels, transaction poolers, and a different project on a shared pooler', () => {
  const base = { DATABASE_URL: 'postgresql://postgres.project_a:secret@aws-0-test.pooler.supabase.com:5432/postgres', PRISM_SEED_ENV: 'uat' };
  const target = describeSeedTarget(base);
  const pinned = { ...base, PRISM_SEED_TARGET: target.fingerprint };
  assert.doesNotThrow(() => assertSeedTarget(pinned, target));
  assert.throws(() => assertSeedTarget({ ...pinned, NODE_ENV: 'production' }, target), /production/);
  assert.throws(() => assertSeedTarget({ ...pinned, PRISM_SEED_ENV: 'local' }, target), /loopback/);
  const differentProject = describeSeedTarget({ ...base, DATABASE_URL: base.DATABASE_URL.replace('project_a', 'project_b') });
  assert.throws(() => assertSeedTarget(pinned, differentProject), /mismatch/);
  const transaction = describeSeedTarget({ ...base, DATABASE_URL: base.DATABASE_URL.replace(':5432', ':6543') });
  assert.throws(() => assertSeedTarget(pinned, transaction), /session pooler/);
});

test('only the explicit env file selects the seed database, even with stale process URLs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'prism-seed-env-'));
  const file = join(directory, 'selected.env');
  const previous = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL = 'postgresql://remote:stale@db.example.com/stale';
    writeFileSync(file, 'DATABASE_URL=postgresql://postgres:local@127.0.0.1:5432/test\nPRISM_SEED_ENV=local\n');
    const selected = loadSeedEnvironment(file);
    assert.equal(selected.DIRECT_URL, undefined);
    assert.equal(describeSeedTarget(selected).database.isLoopback, true);
    assert.throws(() => loadSeedEnvironment(), /Supply --env-file/);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    rmSync(file); rmdirSync(directory);
  }
});

test('scenario dates use Manila midnight and reject malformed or impossible dates', () => {
  assert.equal(scenarioAnchor('2028-02-29'), '2028-02-29T00:00:00+08:00');
  for (const date of [undefined, '2026-02-29', '2026-13-01', '10/24/2026']) assert.throws(() => scenarioAnchor(date));
  assert.throws(() => parseSeedOptions(['--profile', 'accounts', '--verify', '--dry-run']), /Choose/);
  assert.throws(() => parseSeedOptions(['--profile', 'unknown']), /Choose/);
});

test('migration comparison distinguishes mismatch, pending, failed, missing-file, and rolled-back retries', () => {
  const done = (migration_name, checksum) => ({ migration_name, checksum, finished_at: 'done' });
  const report = compareMigrationHistory(new Map([['a', 'abc'], ['b', 'def'], ['c', 'ghi']]), [
    { migration_name: 'a', rolled_back_at: 'rolled back' }, done('a', 'abc'), done('b', 'wrong'),
    { migration_name: 'c' }, done('removed', 'xyz'),
  ]);
  assert.deepEqual(report.issues, [
    { migration: 'c', issue: 'unfinished' }, { migration: 'b', issue: 'checksum-mismatch' },
    { migration: 'c', issue: 'pending' }, { migration: 'removed', issue: 'missing-local-file' },
  ]);
});

test('Windows/Linux newline variants are reported separately from changed migration SQL', () => {
  const applied = [{ migration_name: 'migration', checksum: migrationChecksums('SELECT 1;\n')[0], finished_at: 'done' }];
  const local = new Map([['migration', migrationChecksums('SELECT 1;\r\n')]]);
  assert.deepEqual(compareMigrationHistory(local, applied).issues, []);
  assert.deepEqual(compareMigrationHistory(local, applied).lineEndingOnly, ['migration']);
  assert.equal(compareMigrationHistory(new Map([['migration', migrationChecksums('SELECT 2;\n')]]), applied).issues[0].issue, 'checksum-mismatch');
});
