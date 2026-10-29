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

describe('assertExactMigrationCompatibility', () => {
  it('accepts the proven historical UAT version only for its pinned name and current SQL', () => {
    const name = '20261021104500_event-lifecycle_uat_portal_data';
    const sql = readFileSync(resolve(__dirname, '../../../prisma/migrations', name, 'migration.sql'));
    const applied = [{ ...appliedMigrations[0], name, checksum: 'b2007aec777f5189d66486d3dd3437dbdf902da49a536387c74ac825237803c2' }];
    const check = (bytes: Uint8Array, localName = name) => migrationLedger.assertExactMigrationCompatibility({
      localMigrations: [{ name: localName, checksum: migrationLedger.migrationChecksumVariants(bytes)[0], checksumVariants: migrationLedger.migrationChecksumVariants(bytes, localName) }],
      appliedMigrations: applied.map(row => ({ ...row, name: localName })),
      requiredHead: localName,
    });
    expect(check(sql)).toBe(name);
    expect(() => check(Buffer.from(`${sql}\n-- edited`))).toThrow('checksum mismatch');
    expect(() => check(sql, 'unrelated')).toThrow('checksum mismatch');
    expect(() => migrationLedger.assertExactMigrationCompatibility({
      localMigrations: [{ name, checksum: migrationLedger.migrationChecksumVariants(sql)[0], checksumVariants: migrationLedger.migrationChecksumVariants(sql, name) }],
      appliedMigrations: [{ ...applied[0], checksum: 'f'.repeat(64) }],
      requiredHead: name,
    })).toThrow('checksum mismatch');
  });

  it('accepts an exact, fully applied migration history at the required head', () => {
    expect(
      migrationLedger.assertExactMigrationCompatibility({
        localMigrations,
        appliedMigrations,
        requiredHead: localMigrations[localMigrations.length - 1].name,
      }),
    ).toBe(localMigrations[localMigrations.length - 1].name);
  });

  it.each([
    {
      label: 'a missing migration',
      applied: appliedMigrations.slice(0, 1),
      message: 'missing local Prisma migration',
    },
    {
      label: 'an unknown migration',
      applied: [...appliedMigrations, { ...appliedMigrations[0], name: '20990101000000_unknown' }],
      message: 'unknown Prisma migration',
    },
    {
      label: 'an unfinished migration',
      applied: [{ ...appliedMigrations[0], finishedAt: null }, appliedMigrations[1]],
      message: 'unfinished Prisma migrations',
    },
    {
      label: 'a changed migration checksum',
      applied: [{ ...appliedMigrations[0], checksum: 'c'.repeat(64) }, appliedMigrations[1]],
      message: 'checksum mismatch',
    },
  ])('rejects $label', ({ applied, message }) => {
    expect(() =>
      migrationLedger.assertExactMigrationCompatibility({
        localMigrations,
        appliedMigrations: applied,
        requiredHead: localMigrations[localMigrations.length - 1].name,
      }),
    ).toThrow(message);
  });

  it('rejects an expected head that differs from the local migration tip', () => {
    expect(() =>
      migrationLedger.assertExactMigrationCompatibility({ localMigrations, appliedMigrations, requiredHead: 'wrong-head' }),
    ).toThrow('does not match local head');
  });

  it('ignores migration rows explicitly marked rolled back', () => {
    const rolledBack = { ...appliedMigrations[0], finishedAt: null, rolledBackAt: new Date() };
    expect(
      migrationLedger.assertExactMigrationCompatibility({
        localMigrations,
        appliedMigrations: [rolledBack, ...appliedMigrations],
        requiredHead: localMigrations[localMigrations.length - 1].name,
      }),
    ).toBe(localMigrations[localMigrations.length - 1].name);
  });

  it('accepts equivalent LF and CRLF migration checksums but rejects changed SQL', () => {
    const crlfChecksums = migrationLedger.migrationChecksumVariants(Buffer.from('SELECT 1;\r\n'));
    const lfChecksum = migrationLedger.migrationChecksumVariants(Buffer.from('SELECT 1;\n'))[0];
    const changedChecksum = migrationLedger.migrationChecksumVariants(Buffer.from('SELECT 2;\n'))[0];
    expect(crlfChecksums).toContain(lfChecksum);

    const migration = { name: localMigrations[0].name, checksum: crlfChecksums[0], checksumVariants: crlfChecksums };
    const applied = [{ ...appliedMigrations[0], checksum: lfChecksum }];
    expect(
      migrationLedger.assertKnownMigrationPrefix({
        localMigrations: [migration],
        appliedMigrations: applied,
        requiredHead: migration.name,
      }).appliedHead,
    ).toBe(migration.name);

    expect(() =>
      migrationLedger.assertKnownMigrationPrefix({
        localMigrations: [migration],
        appliedMigrations: [{ ...applied[0], checksum: changedChecksum }],
        requiredHead: migration.name,
      }),
    ).toThrow('checksum mismatch');
  });

  it('accepts a known applied prefix and reports the remaining migrations', () => {
    expect(
      migrationLedger.assertKnownMigrationPrefix({
        localMigrations,
        appliedMigrations: appliedMigrations.slice(0, 1),
        requiredHead: localMigrations[localMigrations.length - 1].name,
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
        requiredHead: localMigrations[localMigrations.length - 1].name,
      }),
    ).toThrow('not a prefix');
  });
});
