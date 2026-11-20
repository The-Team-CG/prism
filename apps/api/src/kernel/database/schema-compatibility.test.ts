import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import migrationLedger = require('./migration-ledger-compatibility.cjs');
import type { AppliedMigration, LocalMigration } from './migration-ledger-compatibility.cjs';

const localMigrations: LocalMigration[] = [
  { name: '20260901000000_platform-ops_baseline', checksum: 'a'.repeat(64) },
  { name: '20261001000000_commercial_quote_integrity', checksum: 'b'.repeat(64) },
];

const appliedMigrations: AppliedMigration[] = localMigrations.map((migration) => ({
  name: migration.name,
  checksum: migration.checksum,
  startedAt: new Date('2026-10-01T00:00:00Z'),
  finishedAt: new Date('2026-10-01T00:00:01Z'),
  rolledBackAt: null,
}));

const latestLocal = localMigrations[localMigrations.length - 1].name;

describe('assertLocalMigrationsApplied', () => {
  it('accepts the proven historical UAT version only for its pinned name and current SQL', () => {
    const name = '20261021104500_event-lifecycle_uat_portal_data';
    const sql = readFileSync(resolve(__dirname, '../../../prisma/migrations', name, 'migration.sql'));
    const applied = [{ ...appliedMigrations[0], name, checksum: 'b2007aec777f5189d66486d3dd3437dbdf902da49a536387c74ac825237803c2' }];
    const check = (bytes: Uint8Array, localName = name) => migrationLedger.assertLocalMigrationsApplied({
      localMigrations: [{ name: localName, checksum: migrationLedger.migrationChecksumVariants(bytes)[0], checksumVariants: migrationLedger.migrationChecksumVariants(bytes, localName) }],
      appliedMigrations: applied.map(row => ({ ...row, name: localName })),
    });
    expect(check(sql)).toBe(name);
    expect(() => check(Buffer.from(`${sql}\n-- edited`))).toThrow('checksum mismatch');
    expect(() => check(sql, 'unrelated')).toThrow('checksum mismatch');
  });

  it.each([
    {
      label: 'every shipped migration applied',
      applied: appliedMigrations,
      passes: true,
    },
    {
      label: 'an extra applied migration the API does not ship',
      applied: [...appliedMigrations, { ...appliedMigrations[0], name: '20990101000000_newer_release' }],
      passes: true,
    },
    {
      label: 'a shipped migration missing from the database',
      applied: appliedMigrations.slice(0, 1),
      message: '20261001000000_commercial_quote_integrity',
    },
    {
      label: 'an empty database',
      applied: [],
      message: localMigrations.map(({ name }) => name).join(', '),
    },
    {
      label: 'a changed checksum on a shipped migration',
      applied: [appliedMigrations[0], { ...appliedMigrations[1], checksum: 'c'.repeat(64) }],
      message: 'checksum mismatch: 20261001000000_commercial_quote_integrity',
    },
    {
      label: 'an unfinished row',
      applied: [appliedMigrations[0], { ...appliedMigrations[1], finishedAt: null }],
      message: 'unfinished or rolled back: 20261001000000_commercial_quote_integrity',
    },
    {
      label: 'a rolled-back row with no completed row for the migration',
      applied: [appliedMigrations[0], { ...appliedMigrations[1], finishedAt: null, rolledBackAt: new Date('2026-10-02T00:00:00Z') }],
      message: 'missing: 20261001000000_commercial_quote_integrity',
    },
  ])('$label', ({ applied, passes, message }) => {
    const run = () => migrationLedger.assertLocalMigrationsApplied({ localMigrations, appliedMigrations: applied });
    if (passes) {
      expect(run()).toBe(latestLocal);
      return;
    }
    expect(run).toThrow(message);
    expect(run).toThrow('db:migrate:deploy before starting the API');
  });

  it('accepts equivalent LF and CRLF migration checksums but rejects changed SQL', () => {
    const crlfChecksums = migrationLedger.migrationChecksumVariants(Buffer.from('SELECT 1;\r\n'));
    const lfChecksum = migrationLedger.migrationChecksumVariants(Buffer.from('SELECT 1;\n'))[0];
    const changedChecksum = migrationLedger.migrationChecksumVariants(Buffer.from('SELECT 2;\n'))[0];
    expect(crlfChecksums).toContain(lfChecksum);

    const migration = { name: localMigrations[0].name, checksum: crlfChecksums[0], checksumVariants: crlfChecksums };
    const check = (checksum: string) => migrationLedger.assertLocalMigrationsApplied({
      localMigrations: [migration],
      appliedMigrations: [{ ...appliedMigrations[0], checksum }],
    });
    expect(check(lfChecksum)).toBe(migration.name);
    expect(() => check(changedChecksum)).toThrow('checksum mismatch');
  });
});

describe('assertKnownMigrationPrefix', () => {
  it('accepts a known applied prefix and reports the remaining migrations', () => {
    expect(
      migrationLedger.assertKnownMigrationPrefix({
        localMigrations,
        appliedMigrations: appliedMigrations.slice(0, 1),
      }),
    ).toEqual({
      appliedHead: localMigrations[0].name,
      pendingMigrations: [localMigrations[1]],
    });
  });

  it('rejects an applied migration after a pending gap', () => {
    expect(() =>
      migrationLedger.assertKnownMigrationPrefix({
        localMigrations,
        appliedMigrations: [appliedMigrations[1]],
      }),
    ).toThrow('not a prefix');
  });
});
