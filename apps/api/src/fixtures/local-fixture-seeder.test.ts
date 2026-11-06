import { describe, expect, it } from 'vitest';
import { assertFixtureDatabaseIsFresh, LocalFixtureSeeder } from './local-fixture-seeder';

const migrationSeedCounts: Record<string, number> = {
  opsAuditChainLock: 1,
  opsRetentionPolicy: 8,
};

function createMigrationBaselinePrisma({
  countOverrides = {},
  auditRevision = 0,
  missingCountModel,
  invalidCountModel,
}: {
  countOverrides?: Record<string, number>;
  auditRevision?: number;
  missingCountModel?: string;
  invalidCountModel?: string;
} = {}) {
  const rowsByModel: Record<string, unknown[]> = {
    opsAuditChainLock: [{ id: 'global', revision: auditRevision, headId: null, headHash: null }],
  };
  const modelCounts = { ...migrationSeedCounts, ...countOverrides };
  const calls: string[] = [];
  const writes: string[] = [];
  const prisma = new Proxy({}, {
    get(_target, model: string | symbol) {
      if (model === '$transaction') {
        return async () => {
          writes.push(String(model));
          throw new Error('Fixture write attempted');
        };
      }
      return new Proxy({}, {
        get(_delegate, operation: string | symbol) {
          if (operation === 'count') {
            if (String(model) === missingCountModel) return undefined;
            return async () => {
              calls.push(`${String(model)}.count`);
              if (String(model) === invalidCountModel) return Number.NaN;
              return modelCounts[String(model)] ?? 0;
            };
          }
          if (operation === 'findMany') {
            return async () => {
              calls.push(`${String(model)}.findMany`);
              return rowsByModel[String(model)] ?? [];
            };
          }
          return undefined;
        },
        has(_delegate, operation: string | symbol) {
          return operation === 'count' && String(model) !== missingCountModel;
        },
      });
    },
  });
  return { prisma, calls, writes };
}

describe('LocalFixtureSeeder', () => {
  it('allows only the validated migration-owned baseline rows', async () => {
    const { prisma, calls, writes } = createMigrationBaselinePrisma();

    await expect(assertFixtureDatabaseIsFresh(prisma as never)).resolves.toBeUndefined();

    expect(calls).toContain('opsAuditChainLock.findMany');
    expect(writes).toEqual([]);
  });

  it('refuses unexpected rows before fixture writes', async () => {
    const { prisma, calls, writes } = createMigrationBaselinePrisma({
      countOverrides: { opsGuestCheckIn: 1 },
    });
    const seeder = new LocalFixtureSeeder(prisma as never, { audit: async () => ({}) } as never);

    await expect(seeder.seedFixtures()).rejects.toThrow('migration-owned baseline rows');
    expect(calls).toContain('opsGuestCheckIn.count');
    expect(calls.every((call) => call.endsWith('.count'))).toBe(true);
    expect(writes).toEqual([]);
  });

  it('refuses a changed retention policy count before fixture writes', async () => {
    const { prisma, writes } = createMigrationBaselinePrisma({
      countOverrides: { opsRetentionPolicy: 9 },
    });
    const seeder = new LocalFixtureSeeder(prisma as never, { audit: async () => ({}) } as never);

    await expect(seeder.seedFixtures()).rejects.toThrow('migration-owned baseline rows');
    expect(writes).toEqual([]);
  });

  it('fails closed when a model has no count delegate', async () => {
    const { prisma, writes } = createMigrationBaselinePrisma({ missingCountModel: 'opsPrivacyRequest' });
    const seeder = new LocalFixtureSeeder(prisma as never, { audit: async () => ({}) } as never);

    await expect(seeder.seedFixtures()).rejects.toThrow('could not verify model OpsPrivacyRequest');
    expect(writes).toEqual([]);
  });

  it('fails closed when a model returns an invalid row count', async () => {
    const { prisma, writes } = createMigrationBaselinePrisma({ invalidCountModel: 'opsRetentionPolicy' });
    const seeder = new LocalFixtureSeeder(prisma as never, { audit: async () => ({}) } as never);

    await expect(seeder.seedFixtures()).rejects.toThrow('invalid row count for model OpsRetentionPolicy');
    expect(writes).toEqual([]);
  });

  it('refuses a changed audit baseline before fixture writes', async () => {
    const { prisma, writes } = createMigrationBaselinePrisma({ auditRevision: 1 });
    const seeder = new LocalFixtureSeeder(prisma as never, { audit: async () => ({}) } as never);

    await expect(seeder.seedFixtures()).rejects.toThrow('migration-owned baseline rows');
    expect(writes).toEqual([]);
  });
});
