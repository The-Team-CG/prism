import { describe, expect, it } from 'vitest';
import { assertFixtureDatabaseIsFresh, LocalFixtureSeeder } from './local-fixture-seeder';

const migrationFloorPlanIds = [
  'plan_tpl_builtin_blank',
  'plan_tpl_builtin_corporate_gala',
  'plan_tpl_builtin_wedding',
  'plan_tpl_builtin_conference',
  'plan_tpl_builtin_classroom',
  'plan_tpl_builtin_banquet',
  'plan_tpl_builtin_cocktail',
];
const migrationVenueTemplateIds = migrationFloorPlanIds.map((id) => id.replace('plan_', ''));

const migrationSeedCounts: Record<string, number> = {
  floorPlan: 7,
  floorPlanObject: 231,
  venueTemplate: 7,
  opsAuditChainLock: 1,
};

function createMigrationBaselinePrisma({
  countOverrides = {},
  auditRevision = 0,
  floorPlanOwnerId = 'owner-sample',
  replaceFirstFloorPlanId = false,
  missingCountModel,
  invalidCountModel,
}: {
  countOverrides?: Record<string, number>;
  auditRevision?: number;
  floorPlanOwnerId?: string;
  replaceFirstFloorPlanId?: boolean;
  missingCountModel?: string;
  invalidCountModel?: string;
} = {}) {
  const floorPlanIds = migrationFloorPlanIds.map((id, index) =>
    replaceFirstFloorPlanId && index === 0 ? 'unexpected-floor-plan' : id,
  );
  const floorPlans = floorPlanIds.map((id) => ({
    id,
    ownerId: floorPlanOwnerId,
    eventId: null,
  }));
  const rowsByModel: Record<string, unknown[]> = {
    floorPlan: floorPlans,
    floorPlanObject: Array.from({ length: 231 }, (_unused, index) => ({
      floorPlanId: floorPlanIds[index % floorPlanIds.length],
      objectId: `migration-object-${index}`,
    })),
    venueTemplate: floorPlanIds.map((floorPlanId, index) => ({
      id: migrationVenueTemplateIds[index],
      ownerId: 'owner-sample',
      floorPlanId,
    })),
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

    expect(calls).toContain('floorPlan.findMany');
    expect(calls).toContain('venueTemplate.findMany');
    expect(calls).toContain('floorPlanObject.findMany');
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

  it('refuses altered migration-owned rows before fixture writes', async () => {
    const { prisma, writes } = createMigrationBaselinePrisma({ floorPlanOwnerId: 'other-owner' });
    const seeder = new LocalFixtureSeeder(prisma as never, { audit: async () => ({}) } as never);

    await expect(seeder.seedFixtures()).rejects.toThrow('migration-owned baseline rows');
    expect(writes).toEqual([]);
  });

  it('refuses an unexpected migration baseline ID before fixture writes', async () => {
    const { prisma, writes } = createMigrationBaselinePrisma({ replaceFirstFloorPlanId: true });
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
    const { prisma, writes } = createMigrationBaselinePrisma({ invalidCountModel: 'floorPlan' });
    const seeder = new LocalFixtureSeeder(prisma as never, { audit: async () => ({}) } as never);

    await expect(seeder.seedFixtures()).rejects.toThrow('invalid row count for model FloorPlan');
    expect(writes).toEqual([]);
  });

  it('refuses a changed audit baseline before fixture writes', async () => {
    const { prisma, writes } = createMigrationBaselinePrisma({ auditRevision: 1 });
    const seeder = new LocalFixtureSeeder(prisma as never, { audit: async () => ({}) } as never);

    await expect(seeder.seedFixtures()).rejects.toThrow('migration-owned baseline rows');
    expect(writes).toEqual([]);
  });
});