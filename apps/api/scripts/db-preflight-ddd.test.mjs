import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { assertReadOnlyQuery } from './check-data-invariants.mjs';
import {
  buildCrossEventChecks,
  buildDddPrechecks,
  expectedForeignKeyCatalog,
  resolveDisposablePreflightTarget,
  resolveProtectedArtifactPath,
  runDddPreflight,
} from './db-preflight-ddd.mjs';
import { discoverMigrations } from './check-prisma-migrations.mjs';
import { domainPersistenceCatalog, loadOwnershipManifest } from './domain-persistence-catalog.mjs';

describe('DDD database preflight safety', () => {
  it('requires an explicitly named loopback disposable target', () => {
    assert.throws(() => resolveDisposablePreflightTarget({ env: {} }), /must explicitly name a loopback disposable database/);
    assert.throws(
      () => resolveDisposablePreflightTarget({ rawUrl: 'postgresql://user:pass@db.example.test:5432/prism_preflight_demo', env: {} }),
      /only accepts a loopback database/,
    );
    assert.throws(
      () => resolveDisposablePreflightTarget({ rawUrl: 'postgresql://user:pass@localhost:5432/prism', env: {} }),
      /only accepts a loopback database/,
    );
    const target = resolveDisposablePreflightTarget({
      rawUrl: 'postgresql://user:pass@127.0.0.1:5432/prism_preflight_demo',
      env: {},
    });
    assert.equal(target.databaseName, 'prism_preflight_demo');
    assert.equal(target.isLoopback, true);
  });

  it('requires a private absolute report path outside the repository', () => {
    const repoRoot = path.resolve('workspace', 'prism');
    const repositoryArtifactPath = path.join(repoRoot, 'report.json');
    const privateArtifactPath = path.join(os.tmpdir(), 'prism-preflight.json');
    assert.throws(() => resolveProtectedArtifactPath('report.json'), /absolute artifact path/);
    assert.throws(
      () => resolveProtectedArtifactPath(repositoryArtifactPath, { repoRoot }),
      /outside the repository/,
    );
    assert.equal(
      resolveProtectedArtifactPath(privateArtifactPath, { repoRoot }),
      privateArtifactPath,
    );
  });
});

describe('DDD preflight ownership and data checks', () => {
  const manifest = loadOwnershipManifest();

  it('compares every current FK and requires only same-domain FKs in the target layout', () => {
    const current = expectedForeignKeyCatalog(manifest);
    const final = expectedForeignKeyCatalog(manifest, { final: true });
    assert.equal(current.length, 120);
    assert.equal(current.filter(({ sourceSchema, targetSchema }) => sourceSchema !== targetSchema).length, 50);
    assert.equal(final.length, 75);
    assert.ok(final.every(({ sourceSchema, targetSchema }) => sourceSchema === targetSchema));
  });

  it('renders owner tables and validates preflight SQL without exposing row contents', () => {
    for (const final of [false, true]) {
      const checks = buildDddPrechecks(manifest, { final });
      assert.equal(checks.length, 16);
      for (const check of checks) {
        assertReadOnlyQuery(check.query, check.id);
        assert.doesNotMatch(check.query, /\{\{[^}]+\}\}/);
        assert.match(check.query, /opaque_id/);
        for (const [domain, table] of check.tables ?? []) {
          assert.equal(manifest.ownership.filter((entry) => entry.domain === domain && entry.table === table).length, 1);
        }
      }
      assert.match(checks.find(({ id }) => id === 'audit_chain_integrity').query,
        final ? /"platform_ops"\."audit_logs"/ : /"trust_ops"\."audit_logs"/);
      assert.match(checks.find(({ id }) => id === 'orphan_quote_request_references').query,
        final ? /"commercial"\."quotes"/ : /"supplier_ops"\."quotes"/);
    }
  });

  it('builds same-domain cross-event checks from declared local relationships', () => {
    const columns = new Map([
      ['commercial.billing_statements', new Set(['id', 'event_id', 'source_id'])],
      ['commercial.billing_sources', new Set(['id', 'event_id'])],
    ]);
    const localManifest = {
      ownership: [
        { domain: 'commercial', table: 'billing_statements', currentSchema: 'finance_ops', targetSchema: 'commercial' },
        { domain: 'commercial', table: 'billing_sources', currentSchema: 'finance_ops', targetSchema: 'commercial' },
      ],
      foreignKeys: [{
        name: 'billing_statements_source_id_fkey',
        table: 'billing_statements',
        sourceDomain: 'commercial',
        targetDomain: 'commercial',
        targetTable: 'billing_sources',
        targetCurrentSchema: 'finance_ops',
        sameDomain: true,
        columns: ['source_id'],
        definition: 'FOREIGN KEY (source_id) REFERENCES finance_ops.billing_sources(id) ON UPDATE CASCADE ON DELETE SET NULL',
      }],
    };
    const [check] = buildCrossEventChecks(localManifest, columns, { final: true });
    assert.match(check.query, /"commercial"\."billing_statements"/);
    assert.match(check.query, /source\."source_id" = target\."id"/);
    assert.match(check.query, /source\.event_id <> target\.event_id/);
  });

  it('runs the preflight in one read-only transaction and writes only the private artifact', async () => {
    const tables = [
      ...domainPersistenceCatalog(manifest).tables,
      { schema: 'public', table: '_prisma_migrations' },
    ];
    const schemas = [...new Set([
      ...domainPersistenceCatalog(manifest).schemas,
      ...domainPersistenceCatalog(manifest, { final: true }).schemas,
      'public',
    ])];
    const oids = new Map(tables.map((entry, index) => [entry.schema + '.' + entry.table, String(10_000 + index)]));
    const expectedFks = expectedForeignKeyCatalog(manifest);
    const migrations = discoverMigrations();
    const migrationRows = migrations.map(({ name, sql }) => ({
      migration_name: name,
      checksum: createHash('sha256').update(sql.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8').digest('hex'),
      started_at: new Date('2026-10-01T00:00:00.000Z'),
      finished_at: new Date('2026-10-01T00:00:01.000Z'),
      rolled_back_at: null,
    }));
    const actionCodes = { 'NO ACTION': 'a', RESTRICT: 'r', CASCADE: 'c', 'SET NULL': 'n', 'SET DEFAULT': 'd' };
    const calls = [];
    const client = {
      async query(sql, values) {
        calls.push({ sql, values });
        if (sql === 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.includes('current_database()')) return { rows: [{ database_name: 'prism_preflight_test', server_version_num: '160004' }] };
        if (sql.includes('FROM information_schema.schemata')) return { rows: schemas.map((schema_name) => ({ schema_name })) };
        if (sql.includes('FROM pg_class AS relation')) {
          return { rows: tables.map(({ schema, table }) => ({ table_schema: schema, table_name: table, oid: oids.get(schema + '.' + table) })) };
        }
        if (sql.includes('pg_get_constraintdef')) return { rows: [] };
        if (sql.includes('FROM pg_constraint AS constraint_row') && sql.includes('source_namespace')) {
          return { rows: expectedFks.map((fk) => ({
            name: fk.name,
            source_schema: fk.sourceSchema,
            source_table: fk.sourceTable,
            source_columns: fk.sourceColumns,
            target_schema: fk.targetSchema,
            target_table: fk.targetTable,
            target_columns: fk.targetColumns,
            delete_action: actionCodes[fk.onDelete],
            update_action: actionCodes[fk.onUpdate],
            validated: fk.validated,
            deferrable: fk.deferrable,
            initially_deferred: fk.initiallyDeferred,
          })) };
        }
        if (sql.includes('FROM public._prisma_migrations')) return { rows: migrationRows };
        if (sql.includes('FROM information_schema.columns')) {
          return { rows: tables.map(({ schema, table }) => ({ table_schema: schema, table_name: table, column_name: 'id' })) };
        }
        if (sql.includes('AS row_count') && sql.includes('AS key_samples')) {
          return { rows: tables.map(({ schema, table }) => ({ schema, table, row_count: '0', key_samples: [] })) };
        }
        if (sql.includes('FROM pg_indexes')) return { rows: [] };
        if (sql.includes('AS payload_checksum')) return { rows: [] };
        if (sql.startsWith('SELECT COALESCE(sum(')) return { rows: [{ total: '0' }] };
        if (sql.startsWith('WITH violations AS (')) return { rows: [{ violation_count: '0', sample_ids: [] }] };
        throw new Error('unexpected preflight query');
      },
      release() {},
    };
    class PoolStub {
      constructor(options) {
        assert.match(options.connectionString, /127\.0\.0\.1/);
        assert.equal(options.statement_timeout, 60_000);
      }
      async connect() { return client; }
      async end() {}
    }

    const directory = await mkdtemp(path.join(os.tmpdir(), 'prism-ddd-preflight-test-'));
    try {
      const artifactPath = path.join(directory, 'preflight.json');
      const { report } = await runDddPreflight({
        env: {},
        rawUrl: 'postgresql://user:pass@127.0.0.1:5432/prism_preflight_test',
        PoolClass: PoolStub,
        artifactPath,
        manifest,
      });
      const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
      assert.equal(report.status, 'ready');
      assert.equal(report.catalog.expectedTableCount, 93);
      assert.equal(report.foreignKeys.matchesManifest, true);
      assert.equal(report.migrationLedger.pending.length, 0);
      assert.equal(artifact.checks.length >= 16, true);
      assert.deepEqual(calls[0].sql, 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      assert.equal(calls.at(-1).sql, 'COMMIT');
      assert.equal(calls.some(({ sql }) => /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i.test(sql)), false);
      assert.equal(JSON.stringify(artifact).includes('person@example.test'), false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

