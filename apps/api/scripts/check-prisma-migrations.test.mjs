import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  auditMigrationSet,
  discoverMigrations,
  parseMigrationName,
} from './check-prisma-migrations.mjs';

const policy = {
  legacyMaxVersion: '20260909100000',
  legacyMigrationNames: ['20260908000400_legacy_change'],
  legacyDuplicateVersions: [],
  systemSchemas: ['information_schema', 'pg_catalog'],
  forbiddenSchemas: ['public'],
  owners: {
    commercial: { schemas: ['finance_ops', 'supplier_ops'] },
    'event-lifecycle': { schemas: ['compliance_ops', 'event_core'] },
    'live-ops': { schemas: ['staffing_ops'] },
    operations: { schemas: ['guest_ops', 'staffing_ops'] },
    'platform-ops': { schemas: ['platform_ops', 'trust_ops'] },
  },
};
const futurePolicy = { ...policy, legacyMigrationNames: [] };

const temporaryRoots = [];

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

function migration(name, sql) {
  return { name, sql, path: `prisma/migrations/${name}` };
}

function ownerAwareMigration({
  version = '20260911123000',
  owner = 'commercial',
  slug = 'supplier_reconciliation',
  kind = 'schema',
  risk = 'medium',
  sql = 'ALTER TABLE "supplier_ops"."quotes" ADD COLUMN "reconciled_at" TIMESTAMP(3);',
} = {}) {
  return migration(
    `${version}_${owner}_${slug}`,
    `-- prism-owner: ${owner}\n-- prism-kind: ${kind}\n-- prism-risk: ${risk}\n${sql}`,
  );
}

describe('Prisma migration policy', () => {
  it('parses owner-aware names and preserves the full change slug', () => {
    assert.deepEqual(
      parseMigrationName(
        '20260911123000_event-lifecycle_close_event',
        policy,
      ),
      {
        version: '20260911123000',
        owner: 'event-lifecycle',
        slug: 'close_event',
        legacy: false,
      },
    );
  });

  it('accepts the immutable legacy baseline, including an old duplicate timestamp', () => {
    const result = auditMigrationSet(
      [
        migration(
          '20260908000400_legacy_change',
          'ALTER TABLE "event_core"."events" ADD COLUMN "legacy_flag" BOOLEAN;',
        ),
        migration(
          '20260908000400_legacy_change_two',
          'ALTER TABLE "event_core"."events" ADD COLUMN "legacy_flag_two" BOOLEAN;',
        ),
      ],
      {
        ...policy,
        legacyMigrationNames: [
          '20260908000400_legacy_change',
          '20260908000400_legacy_change_two',
        ],
        legacyDuplicateVersions: ['20260908000400'],
      },
    );

    assert.deepEqual(result.errors, []);
    assert.equal(result.summary.legacy, 2);
  });

  it('rejects edited legacy SQL when an immutable checksum is recorded', () => {
    const name = '20260908000400_legacy_change';
    const originalSql = 'ALTER TABLE "event_core"."events" ADD COLUMN "legacy_flag" BOOLEAN;';
    const checksum = createHash('sha256')
      .update(originalSql, 'utf8')
      .digest('hex');
    const result = auditMigrationSet(
      [migration(name, `${originalSql} -- edited`)],
      {
        ...policy,
        legacyMigrationChecksums: { [name]: checksum },
      },
    );

    assert.match(result.errors.join('\n'), /immutable legacy migration\.sql checksum mismatch/);
  });

  it('accepts a future owner-aware migration with matching metadata and schema', () => {
    const result = auditMigrationSet([ownerAwareMigration()], futurePolicy);

    assert.deepEqual(result.errors, []);
    assert.equal(result.summary.ownerAware, 1);
  });

  it('requires metadata on an otherwise valid future migration', () => {
    const result = auditMigrationSet(
      [
        migration(
          '20260911123000_commercial_supplier_reconciliation',
          'ALTER TABLE "supplier_ops"."quotes" ADD COLUMN "reconciled_at" TIMESTAMP(3);',
        ),
      ],
      futurePolicy,
    );

    assert.match(result.errors.join('\n'), /missing prism-owner metadata/);
    assert.match(result.errors.join('\n'), /missing prism-kind metadata/);
    assert.match(result.errors.join('\n'), /missing prism-risk metadata/);
  });

  it('rejects a future migration without a known owner-aware name', () => {
    const result = auditMigrationSet(
      [migration('20260911123000_new_supplier_change', 'SELECT 1;')],
      futurePolicy,
    );

    assert.match(result.errors.join('\n'), /owner-aware name/);
  });

  it('rejects an allowlisted name beyond the immutable baseline', () => {
    const futureName = '20260910120000_commercial_future_legacy';
    const result = parseMigrationName(futureName, {
      ...futurePolicy,
      legacyMigrationNames: [futureName],
    });

    assert.match(result.error, /incorrectly listed as legacy/);
  });

  it('rejects an invalid calendar timestamp', () => {
    const result = parseMigrationName('99999999999999_commercial_future', futurePolicy);

    assert.match(result.error, /invalid calendar timestamp/);
  });

  it('rejects a new duplicate timestamp version and names every colliding folder', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({ slug: 'first' }),
        ownerAwareMigration({ slug: 'second' }),
      ],
      futurePolicy,
    );

    const errors = result.errors.join('\n');
    assert.match(errors, /duplicate migration version/);
    assert.match(errors, /20260911123000_commercial_first/);
    assert.match(errors, /20260911123000_commercial_second/);
  });

  it('passes unique migration timestamp versions', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({ slug: 'first' }),
        ownerAwareMigration({ version: '20260911123001', slug: 'second' }),
      ],
      futurePolicy,
    );

    assert.deepEqual(result.errors, []);
  });

  it('rejects a migration that reaches outside its owner schemas', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({
          sql: 'ALTER TABLE "trust_ops"."notification_logs" ADD COLUMN "x" TEXT;',
        }),
      ],
      futurePolicy,
    );

    assert.match(result.errors.join('\n'), /not allowed for owner commercial/);
  });

  it('rejects the public schema for new domain migrations', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({
          sql: 'ALTER TABLE "public"."quotes" ADD COLUMN "x" TEXT;',
        }),
      ],
      futurePolicy,
    );

    assert.match(result.errors.join('\n'), /schema public is forbidden/);
  });

  it('rejects schema DDL that targets the public schema', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({
          risk: 'high',
          sql: 'DROP SCHEMA "public" CASCADE;',
        }),
      ],
      futurePolicy,
    );

    assert.match(result.errors.join('\n'), /schema public is forbidden/);
  });

  it('rejects schema renames and privileges that target the public schema', () => {
    const renameResult = auditMigrationSet(
      [
        ownerAwareMigration({
          sql: 'ALTER SCHEMA "supplier_ops" RENAME TO "public";',
        }),
      ],
      futurePolicy,
    );
    const grantResult = auditMigrationSet(
      [
        ownerAwareMigration({
          sql: 'GRANT USAGE ON SCHEMA "public" TO app_user;',
        }),
      ],
      futurePolicy,
    );

    assert.match(renameResult.errors.join('\n'), /schema public is forbidden/);
    assert.match(grantResult.errors.join('\n'), /schema public is forbidden/);
  });

  it('rejects procedural SQL that static analysis cannot safely classify', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({
          kind: 'schema',
          risk: 'low',
          sql: "DO $$ BEGIN EXECUTE 'DELETE FROM \"supplier_ops\".\"quotes\"'; END $$;",
        }),
      ],
      futurePolicy,
    );

    assert.match(result.errors.join('\n'), /unsupported SQL requires manual review/);
  });

  it('rejects owner-aware DDL that leaves table ownership unqualified', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({
          sql: 'CREATE TABLE supplier_reconciliation (id TEXT PRIMARY KEY);',
        }),
      ],
      futurePolicy,
    );

    assert.match(result.errors.join('\n'), /schema-qualified/);
  });

  it('rejects an unqualified concurrent index target', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({
          sql: 'CREATE INDEX CONCURRENTLY "quotes_reconciled_idx" ON quotes ("status");',
        }),
      ],
      futurePolicy,
    );

    assert.match(result.errors.join('\n'), /schema-qualified/);
  });

  it('accepts PostgreSQL ONLY syntax when its target is schema-qualified', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({
          sql: 'ALTER TABLE ONLY "supplier_ops"."quotes" ADD COLUMN "reconciled_at" TIMESTAMP(3);',
        }),
      ],
      futurePolicy,
    );

    assert.deepEqual(result.errors, []);
  });

  it('accepts PostgreSQL IF EXISTS ONLY and CREATE INDEX ON ONLY syntax', () => {
    const alterResult = auditMigrationSet(
      [
        ownerAwareMigration({
          sql: 'ALTER TABLE IF EXISTS ONLY "supplier_ops"."quotes" ADD COLUMN "reconciled_at" TIMESTAMP(3);',
        }),
      ],
      futurePolicy,
    );
    const indexResult = auditMigrationSet(
      [
        ownerAwareMigration({
          sql: 'CREATE INDEX "quotes_reconciled_idx" ON ONLY "supplier_ops"."quotes" ("status");',
        }),
      ],
      futurePolicy,
    );

    assert.deepEqual(alterResult.errors, []);
    assert.deepEqual(indexResult.errors, []);
  });

  it('rejects a relation reference that leaves the table unqualified', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({
          owner: 'event-lifecycle',
          sql: 'ALTER TABLE "event_core"."events" ADD CONSTRAINT "events_supplier_fk" FOREIGN KEY ("supplier_id") REFERENCES events(id);',
        }),
      ],
      futurePolicy,
    );

    assert.match(result.errors.join('\n'), /schema-qualified/);
  });

  it('enforces documented table ownership in a shared physical schema', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({
          owner: 'operations',
          sql: 'ALTER TABLE "staffing_ops"."event_day_tasks" ADD COLUMN "x" TEXT;',
        }),
      ],
      {
        ...futurePolicy,
        requireTableOwnerMappingsForSchemas: ['staffing_ops'],
        tableOwners: {
          staffing_ops: {
            event_day_tasks: ['live-ops'],
          },
        },
      },
    );

    assert.match(result.errors.join('\n'), /table staffing_ops\.event_day_tasks is owned by live-ops/);
  });

  it('allows shared-schema index changes only for an explicitly assigned owner', () => {
    const sql = 'DROP INDEX IF EXISTS "staffing_ops"."event_schedule_days_event_id_day_date_idx";';
    const sharedSchemaPolicy = {
      ...futurePolicy,
      requireTableOwnerMappingsForSchemas: ['staffing_ops'],
      indexOwners: {
        staffing_ops: {
          event_schedule_days_event_id_day_date_idx: ['live-ops'],
        },
      },
    };
    const allowed = auditMigrationSet(
      [ownerAwareMigration({ owner: 'live-ops', slug: 'drop_schedule_day_index', sql })],
      sharedSchemaPolicy,
    );
    const wrongOwner = auditMigrationSet(
      [ownerAwareMigration({ owner: 'operations', slug: 'drop_schedule_day_index', sql })],
      sharedSchemaPolicy,
    );

    assert.deepEqual(allowed.errors, []);
    assert.match(wrongOwner.errors.join('\n'), /index staffing_ops\.event_schedule_days_event_id_day_date_idx is owned by live-ops, not operations/);
  });

  it('allows a documented table exception outside the owner schema bucket', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({
          owner: 'platform-ops',
          sql: 'ALTER TABLE "identity"."security_alerts" ADD COLUMN "reviewed_at" TIMESTAMP(3);',
        }),
      ],
      {
        ...futurePolicy,
        tableOwners: {
          identity: {
            security_alerts: ['platform-ops'],
          },
        },
      },
    );

    assert.deepEqual(result.errors, []);
  });

  it('rejects a high-risk operation declared as low risk', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({
          risk: 'low',
          sql: 'ALTER TABLE "supplier_ops"."quotes" DROP COLUMN "legacy_status";',
        }),
      ],
      futurePolicy,
    );

    assert.match(result.errors.join('\n'), /risk low is below inferred high/);
  });

  it('rejects data writes declared as schema-only', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({
          kind: 'schema',
          sql: 'UPDATE "supplier_ops"."quotes" SET "status" = \'reconciled\';',
        }),
      ],
      futurePolicy,
    );

    assert.match(result.errors.join('\n'), /kind schema does not cover inferred data/);
  });

  it('rejects an owner migration with mismatched owner metadata', () => {
    const result = auditMigrationSet(
      [
        ownerAwareMigration({
          sql: '-- prism-owner: operations\nALTER TABLE "supplier_ops"."quotes" ADD COLUMN "x" TEXT;',
        }),
      ],
      futurePolicy,
    );

    assert.match(result.errors.join('\n'), /prism-owner operations does not match/);
  });
});

describe('Prisma migration discovery', () => {
  it('requires each direct migration directory to contain migration.sql', () => {
    const root = mkdtempSync(join(tmpdir(), 'prism-migrations-'));
    temporaryRoots.push(root);
    mkdirSync(join(root, '20260911123000_commercial_valid'));

    assert.throws(
      () => discoverMigrations(root),
      /missing migration\.sql/,
    );
  });

  it('rejects an AlphaCI-style nested owner directory instead of silently discovering it', () => {
    const root = mkdtempSync(join(tmpdir(), 'prism-migrations-'));
    temporaryRoots.push(root);
    mkdirSync(join(root, 'commercial', '20260911123000_commercial_valid'), {
      recursive: true,
    });
    writeFileSync(
      join(root, 'commercial', '20260911123000_commercial_valid', 'migration.sql'),
      'SELECT 1;',
    );

    assert.throws(
      () => discoverMigrations(root),
      /missing migration\.sql/,
    );
  });

  it('allows Prisma migration_lock.toml at the migration root', () => {
    const root = mkdtempSync(join(tmpdir(), 'prism-migrations-'));
    temporaryRoots.push(root);
    mkdirSync(join(root, '20260911123000_commercial_valid'));
    writeFileSync(
      join(root, '20260911123000_commercial_valid', 'migration.sql'),
      'SELECT 1;',
    );
    writeFileSync(join(root, 'migration_lock.toml'), 'provider = "postgresql"\n');

    assert.equal(discoverMigrations(root).length, 1);
  });
});
