import { describe, expect, it } from 'vitest';
import { LocalFixtureSeeder } from './local-fixture-seeder';

describe('LocalFixtureSeeder', () => {
  it('refuses a partially populated database before making fixture writes', async () => {
    const calls: string[] = [];
    const prisma = new Proxy(
      {},
      {
        get(_target, table: string | symbol) {
          return new Proxy(
            {},
            {
              get(_model, operation: string | symbol) {
                return async () => {
                  const name = `${String(table)}.${String(operation)}`;
                  calls.push(name);
                  if (operation !== 'count') throw new Error(`Unexpected seed operation: ${name}`);
                  return table === 'opsAuditLog' ? 1 : 0;
                };
              },
            },
          );
        },
      },
    );
    const seeder = new LocalFixtureSeeder(prisma as never, { audit: async () => ({}) } as never);

    await expect(seeder.seedFixtures()).rejects.toThrow('Fixture seeding requires an empty database.');
    expect(calls).toContain('opsAuditLog.count');
    expect(calls.every((call) => call.endsWith('.count'))).toBe(true);
  });
});
