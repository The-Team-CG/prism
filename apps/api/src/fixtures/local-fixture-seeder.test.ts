import { describe, expect, it } from 'vitest';
import { LocalFixtureSeeder } from './local-fixture-seeder';

describe('LocalFixtureSeeder', () => {
  it('refuses data in any persisted model before making fixture writes', async () => {
    const calls: string[] = [];
    const writes: string[] = [];
    const prisma = new Proxy(
      {},
      {
        get(_target, table: string | symbol) {
          if (table === '$transaction') {
            return async () => {
              writes.push(String(table));
              throw new Error('Fixture write attempted');
            };
          }

          return new Proxy(
            {},
            {
              get(_model, operation: string | symbol) {
                return async () => {
                  const name = `${String(table)}.${String(operation)}`;
                  calls.push(name);
                  if (operation !== 'count') throw new Error(`Unexpected seed operation: ${name}`);
                  return table === 'opsGuestCheckIn' ? 1 : 0;
                };
              },
              has(_model, operation: string | symbol) {
                return operation === 'count';
              },
            },
          );
        },
      },
    );
    const seeder = new LocalFixtureSeeder(prisma as never, { audit: async () => ({}) } as never);

    await expect(seeder.seedFixtures()).rejects.toThrow('Fixture seeding requires an empty database.');
    expect(calls).toContain('opsGuestCheckIn.count');
    expect(calls.every((call) => call.endsWith('.count'))).toBe(true);
    expect(writes).toEqual([]);
  });

  it('fails closed before fixture writes when a model has no count delegate', async () => {
    const writes: string[] = [];
    const prisma = new Proxy(
      {},
      {
        get(_target, model: string | symbol) {
          if (model === '$transaction') {
            return async () => {
              writes.push(String(model));
              throw new Error('Fixture write attempted');
            };
          }
          if (model === 'opsPrivacyRequest') return {};
          return { count: async () => 0 };
        },
      },
    );
    const seeder = new LocalFixtureSeeder(prisma as never, { audit: async () => ({}) } as never);

    await expect(seeder.seedFixtures()).rejects.toThrow(
      'Fixture seeding could not verify model OpsPrivacyRequest.',
    );
    expect(writes).toEqual([]);
  });

  it.each([Number.NaN, -1, 1.5])('fails closed when a model returns invalid row count %s', async (invalidCount) => {
    const writes: string[] = [];
    const prisma = new Proxy(
      {},
      {
        get(_target, model: string | symbol) {
          if (model === '$transaction') {
            return async () => {
              writes.push(String(model));
              throw new Error('Fixture write attempted');
            };
          }
          return { count: async () => (model === 'floorPlan' ? invalidCount : 0) };
        },
      },
    );
    const seeder = new LocalFixtureSeeder(prisma as never, { audit: async () => ({}) } as never);

    await expect(seeder.seedFixtures()).rejects.toThrow(
      'Fixture seeding received an invalid row count for model FloorPlan.',
    );
    expect(writes).toEqual([]);
  });
});
