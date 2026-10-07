import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedLocalFixtures, SAMPLE_DISPOSABLE_DATABASE } from './seed-local-fixtures.mjs';

const args = ['--confirm-disposable-db', SAMPLE_DISPOSABLE_DATABASE];
const validEnv = {
  NODE_ENV: 'development',
  SUPABASE_DB_URL: `postgresql://postgres:local@127.0.0.1:5432/${SAMPLE_DISPOSABLE_DATABASE}`,
};

test('local fixture seed command', async (t) => {
  await t.test('requires exact disposable database confirmation before starting Nest', async () => {
    let created = false;
    await assert.rejects(
      () => seedLocalFixtures({ args: [], env: validEnv, createContext: async () => (created = true) }),
      /Confirm the target/,
    );
    assert.equal(created, false);
  });

  await t.test('refuses production and non-loopback database targets before starting Nest', async () => {
    let created = false;
    await assert.rejects(
      () => seedLocalFixtures({ args, env: { ...validEnv, NODE_ENV: 'production' }, createContext: async () => (created = true) }),
      /disabled in production/,
    );
    await assert.rejects(
      () => seedLocalFixtures({ args, env: { ...validEnv, SUPABASE_DB_URL: `postgresql://remote:secret@db.example.com/${SAMPLE_DISPOSABLE_DATABASE}` }, createContext: async () => (created = true) }),
      /loopback/,
    );
    assert.equal(created, false);
  });

  await t.test('uses the same runtime URL precedence as PrismaService', async () => {
    let created = false;
    await assert.rejects(
      () => seedLocalFixtures({
        args,
        env: {
          ...validEnv,
          DATABASE_URL: `postgresql://remote:secret@db.example.com/${SAMPLE_DISPOSABLE_DATABASE}`,
          SUPABASE_DB_URL: validEnv.SUPABASE_DB_URL,
        },
        createContext: async () => (created = true),
      }),
      /loopback/,
    );
    assert.equal(created, false);
  });

  await t.test('runs the seed through a Nest application context and closes it', async () => {
    let seeded = false;
    let closed = false;
    const result = await seedLocalFixtures({
      args,
      env: validEnv,
      createContext: async () => ({
        seedFixtures: async () => { seeded = true; },
        close: async () => { closed = true; },
      }),
    });
    assert.equal(result, true);
    assert.equal(seeded, true);
    assert.equal(closed, true);
  });

  await t.test('closes the database context when seeding fails', async () => {
    let closed = false;
    await assert.rejects(
      () => seedLocalFixtures({
        args,
        env: validEnv,
        createContext: async () => ({
          seedFixtures: async () => { throw new Error('Fixture seeding requires an empty database.'); },
          close: async () => { closed = true; },
        }),
      }),
      /empty database/,
    );
    assert.equal(closed, true);
  });
});
