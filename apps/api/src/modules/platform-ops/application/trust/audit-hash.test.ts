import { describe, expect, it } from 'vitest';
import { hashCanonicalAuditPayload, hashLegacyAuditPayload, isAuditHashValid, toAuditHashPayload } from './audit-hash';

const auditRow = {
  id: 'aud_hash_test',
  eventId: null,
  actor: 'PMCM Admin',
  actorRole: 'pmcm-admin',
  actorEmail: null,
  action: 'Updated trust settings',
  actionType: 'update',
  category: 'access',
  affectedType: null,
  affectedId: null,
  affectedLabel: null,
  metadata: { zLast: { yNested: 2, aNested: 1 }, aFirst: true },
  ipAddress: 'unknown',
  device: 'test',
  severity: 'info',
  previousHash: null,
  createdAt: new Date('2026-10-04T00:00:00.000Z'),
};

describe('audit hash compatibility', () => {
  it('canonicalizes nested object keys while preserving array order', () => {
    const left = hashCanonicalAuditPayload({ metadata: { z: [{ b: 2, a: 1 }], a: true } });
    const reordered = hashCanonicalAuditPayload({ metadata: { a: true, z: [{ a: 1, b: 2 }] } });
    const differentArray = hashCanonicalAuditPayload({ metadata: { a: true, z: [{ a: 1, b: 2 }, 3] } });

    expect(left).toBe(reordered);
    expect(left).not.toBe(differentArray);
    expect(left).toMatch(/^[0-9a-f]{64}$/);
  });

  it('continues to validate legacy hashes where the original JSON order survives', () => {
    const payload = toAuditHashPayload({ ...auditRow, immutableHash: '' });
    const legacyRow = { ...auditRow, immutableHash: hashLegacyAuditPayload(payload) };

    expect(isAuditHashValid(legacyRow)).toBe(true);
    expect(isAuditHashValid({ ...legacyRow, action: 'Changed action' })).toBe(false);
  });

  it('validates canonical hashes after JSONB key ordering changes', () => {
    const persistedRow = {
      ...auditRow,
      metadata: { aFirst: true, zLast: { aNested: 1, yNested: 2 } },
      immutableHash: '',
    };
    const hash = hashCanonicalAuditPayload(toAuditHashPayload(persistedRow));

    expect(isAuditHashValid({ ...persistedRow, immutableHash: hash })).toBe(true);
  });
});
