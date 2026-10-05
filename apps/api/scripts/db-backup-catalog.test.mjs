import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { describe, it } from 'node:test';

import { buildJsonBackupCatalog } from './db-backup-catalog.mjs';
import { createJsonDatabaseBackup } from './db-backup-json.mjs';
import { loadOwnershipManifest } from './domain-persistence-catalog.mjs';

describe('JSON database backup catalog', () => {
  it('exports exactly the owned tables plus the Prisma migration ledger', () => {
    const catalog = buildJsonBackupCatalog(loadOwnershipManifest());
    assert.equal(catalog.tables.length, 93);
    assert.equal(catalog.tables.filter(({ domain }) => domain !== 'prisma').length, 92);
    assert.deepEqual(
      catalog.tables.filter(({ domain }) => domain === 'prisma').map(({ schema, table }) => ({ schema, table })),
      [{ schema: 'public', table: '_prisma_migrations' }],
    );
    assert.equal(catalog.tables.some(({ schema, table }) => schema === 'trust_ops' && table === 'audit_logs'), true);
    assert.equal(catalog.tables.some(({ schema, table }) => schema === 'platform_ops' && table === 'privacy_legal_holds'), true);
  });

  it('uses target owner schemas without changing the system ledger location', () => {
    const catalog = buildJsonBackupCatalog(loadOwnershipManifest(), { final: true });
    assert.equal(catalog.tables.length, 93);
    assert.equal(catalog.tables.some(({ schema, table }) => schema === 'platform_ops' && table === 'audit_logs'), true);
    assert.equal(catalog.tables.some(({ schema, table }) => schema === 'trust_ops' && table === 'audit_logs'), false);
    assert.equal(catalog.tables.some(({ schema, table }) => schema === 'public' && table === '_prisma_migrations'), true);
    assert.equal(catalog.tables.some(({ schema, table }) => schema === 'platform_ops' && table === 'privacy_legal_holds'), true);
  });

  it('rejects a manifest that collides with a system table', () => {
    const manifest = {
      ownership: [{
        model: 'Collision',
        domain: 'system',
        currentSchema: 'public',
        targetSchema: 'public',
        table: '_prisma_migrations',
      }],
    };
    assert.throws(() => buildJsonBackupCatalog(manifest), /duplicate table public\._prisma_migrations/);
  });

  it('exports only manifest tables plus the migration ledger in one read-only snapshot', async () => {
    const catalog = buildJsonBackupCatalog(loadOwnershipManifest());
    const queries = [];
    let rowId = 'opaque-fixture-id';
    const client = {
      async query(sql, values) {
        queries.push({ sql, values });
        if (sql.startsWith('BEGIN TRANSACTION')) return { rows: [] };
        if (sql.includes('FROM information_schema.tables')) {
          return { rows: catalog.tables.map(({ schema, table }) => ({ table_schema: schema, table_name: table })) };
        }
        if (sql.startsWith('SELECT * FROM')) return { rows: [{ id: rowId }] };
        if (sql === 'COMMIT') return { rows: [] };
        throw new Error('unexpected backup query');
      },
      release() {},
    };
    class PoolStub {
      constructor(options) {
        assert.match(options.connectionString, /127\.0\.0\.1/);
      }
      async connect() { return client; }
      async end() {}
    }

    const directory = await mkdtemp(path.join(os.tmpdir(), 'prism-db-backup-test-'));
    const file = path.join(directory, 'prism-db-backup-2026-10-05T00-00-00-000Z.json');
    const staleTemporaryFile = file + '.tmp';
    try {
      await writeFile(staleTemporaryFile, 'preserve existing file');
      const result = await createJsonDatabaseBackup({
        env: { DIRECT_URL: 'postgresql://user:pass@127.0.0.1:5432/prism_preflight_backup' },
        PoolClass: PoolStub,
        directory,
        now: new Date('2026-10-05T00:00:00.000Z'),
      });
      const snapshot = JSON.parse(await readFile(result.file, 'utf8'));
      assert.equal(result.tableCount, 93);
      assert.equal(result.rowCount, 93);
      assert.deepEqual(snapshot.tables.map(({ schema, table }) => schema + '.' + table).sort(),
        catalog.tables.map(({ schema, table }) => schema + '.' + table).sort());
      assert.equal(queries[0].sql, 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      assert.equal(queries.at(-1).sql, 'COMMIT');
      assert.equal(queries.filter(({ sql }) => sql.startsWith('SELECT * FROM')).length, 93);
      assert.equal(await readFile(staleTemporaryFile, 'utf8'), 'preserve existing file');
      if (process.platform !== 'win32') {
        assert.equal((await stat(result.file)).mode & 0o777, 0o600);
      }

      rowId = 'must-not-replace-first-backup';
      await assert.rejects(
        createJsonDatabaseBackup({
          env: { DIRECT_URL: 'postgresql://user:pass@127.0.0.1:5432/prism_preflight_backup' },
          PoolClass: PoolStub,
          directory,
          now: new Date('2026-10-05T00:00:00.000Z'),
        }),
        /EEXIST/,
      );
      const preserved = JSON.parse(await readFile(result.file, 'utf8'));
      assert.equal(preserved.tables[0].rows[0].id, 'opaque-fixture-id');
      assert.deepEqual((await readdir(directory)).filter((name) => name.endsWith('.tmp') && name !== path.basename(staleTemporaryFile)), []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
