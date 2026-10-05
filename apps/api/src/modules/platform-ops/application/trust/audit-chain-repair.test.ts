import { describe, expect, it } from 'vitest';
import { hashLegacyAuditPayload, toAuditHashPayload } from './audit-hash';
import { computeAuditSourceSha256, planAuditChainRehash, validateAuditChainLock, verifyCanonicalAuditChain } from './audit-chain-repair';
import type { AuditChainLockSnapshot } from './audit-chain-repair';
import type { AuditHashRow } from './audit-hash';

function auditRow(overrides: Partial<AuditHashRow> = {}): AuditHashRow {
  return {
    id: 'aud_repair_root',
    eventId: null,
    actor: 'PMCM Admin',
    actorRole: 'pmcm-admin',
    actorEmail: null,
    action: 'Recorded audit evidence',
    actionType: 'general',
    category: 'events',
    affectedType: null,
    affectedId: null,
    affectedLabel: null,
    metadata: {},
    ipAddress: 'unknown',
    device: 'P.R.I.S.M',
    severity: 'info',
    immutableHash: '',
    previousHash: null,
    createdAt: new Date('2026-10-04T00:00:00.000Z'),
    ...overrides,
  };
}

function legacyAuditRow(overrides: Partial<AuditHashRow> = {}): AuditHashRow {
  const row = auditRow(overrides);
  return { ...row, immutableHash: hashLegacyAuditPayload(toAuditHashPayload(row)) };
}

describe('audit chain repair planning', () => {
  it('rebuilds a JSONB-reordered chain from historical links and preserves audit content', () => {
    const rootBeforeStorage = legacyAuditRow({
      id: 'aud_repair_root',
      metadata: { zLast: { yNested: 2, aNested: 1 }, aFirst: true },
    });
    const tailBeforeStorage = legacyAuditRow({
      id: 'aud_repair_tail',
      previousHash: rootBeforeStorage.immutableHash,
      createdAt: new Date('2026-10-04T00:00:00.000Z'),
      metadata: { zLast: 4, aFirst: 3 },
    });
    const storedRows = [
      { ...tailBeforeStorage, metadata: { aFirst: 3, zLast: 4 } },
      { ...rootBeforeStorage, metadata: { aFirst: true, zLast: { aNested: 1, yNested: 2 } } },
    ];

    const plan = planAuditChainRehash(storedRows);

    expect(plan.ordered.map((row) => row.id)).toEqual(['aud_repair_root', 'aud_repair_tail']);
    expect(plan.invalidHashCount).toBe(2);
    expect(plan.plannedRows[0].previousHash).toBeNull();
    expect(plan.plannedRows[1].previousHash).toBe(plan.plannedRows[0].immutableHash);
    expect(plan.plannedRows.map(({ immutableHash: _hash, previousHash: _previous, ...row }) => row))
      .toEqual(plan.ordered.map(({ immutableHash: _hash, previousHash: _previous, ...row }) => row));
    expect(verifyCanonicalAuditChain(plan.plannedRows)).toBe(true);
  });

  it('refuses multiple roots instead of choosing which audit history to rewrite', () => {
    const first = legacyAuditRow({ id: 'aud_root_one' });
    const second = legacyAuditRow({ id: 'aud_root_two' });

    expect(() => planAuditChainRehash([first, second])).toThrow('not a single chain');
  });

  it('binds the dry-run digest to the target, lock head, and audit contents', () => {
    const row = auditRow({ immutableHash: 'a'.repeat(64), metadata: { z: 2, a: true } });
    const lock: AuditChainLockSnapshot = {
      id: 'global',
      revision: 7,
      headId: row.id,
      headHash: row.immutableHash,
    };
    const reorderedRow = { ...row, metadata: { a: true, z: 2 } };

    const firstDigest = computeAuditSourceSha256({ database: 'prism_preprod', host: 'db.preprod.test' }, [row], lock);
    const sameJsonDigest = computeAuditSourceSha256({ database: 'prism_preprod', host: 'db.preprod.test' }, [reorderedRow], lock);
    const otherDatabaseDigest = computeAuditSourceSha256({ database: 'prism_staging', host: 'db.staging.test' }, [row], lock);

    expect(firstDigest).toBe(sameJsonDigest);
    expect(firstDigest).not.toBe(otherDatabaseDigest);
  });

  it('refuses empty historical hashes rather than inventing evidence for them', () => {
    const emptyHashRow = auditRow({ immutableHash: '' });

    expect(() => planAuditChainRehash([emptyHashRow])).toThrow('missing or malformed audit hash');
  });

  it('refuses a lock head that does not match the linked chain tail', () => {
    const row = legacyAuditRow({ id: 'aud_locked_tail' });
    const plan = planAuditChainRehash([row]);

    expect(() => validateAuditChainLock({
      id: 'global',
      revision: 3,
      headId: 'aud_stale_tail',
      headHash: row.immutableHash,
    }, plan)).toThrow('lock head does not match');
    expect(() => validateAuditChainLock({
      id: 'global',
      revision: 0,
      headId: null,
      headHash: null,
    }, plan)).not.toThrow();
  });
});
