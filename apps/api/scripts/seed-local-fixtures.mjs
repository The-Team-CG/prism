import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectDatabaseConnection } from './db-connection-config.mjs';

export const SAMPLE_DISPOSABLE_DATABASE = 'prism_sample_disposable';

function confirmDisposableDatabase(args) {
  if (
    args.length !== 2 ||
    args[0] !== '--confirm-disposable-db' ||
    args[1] !== SAMPLE_DISPOSABLE_DATABASE
  ) {
    throw new Error(`Confirm the target with --confirm-disposable-db ${SAMPLE_DISPOSABLE_DATABASE}.`);
  }
}

function assertDisposableLocalDatabase(env) {
  if (env.NODE_ENV?.trim().toLowerCase() === 'production') {
    throw new Error('Fixture seeding is disabled in production.');
  }

  let connection;
  try {
    connection = selectDatabaseConnection({ purpose: 'runtime', env });
  } catch (error) {
    if (error?.code === 'DATABASE_URL_MISSING') {
      throw new Error('Set the API runtime database URL to a loopback prism_sample_disposable database.');
    }
    throw new Error('Fixture seeding requires the effective runtime URL to be a loopback prism_sample_disposable PostgreSQL database.');
  }

  let databaseName;
  try {
    const databaseUrl = new URL(connection.connectionString);
    databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ''));
  } catch {
    throw new Error('Fixture seeding requires the effective runtime URL to be a loopback prism_sample_disposable PostgreSQL database.');
  }
  if (!connection.isLoopback || databaseName !== SAMPLE_DISPOSABLE_DATABASE) {
    throw new Error('Set the API runtime database URL to a loopback prism_sample_disposable database.');
  }
}

async function createSeedContext() {
  const [{ NestFactory }, fixturesModule, seederModule] = await Promise.all([
    import('@nestjs/core'),
    import('../dist/apps/api/src/fixtures/local-fixtures.module.js'),
    import('../dist/apps/api/src/fixtures/local-fixture-seeder.js'),
  ]);
  const LocalFixturesModule = fixturesModule.LocalFixturesModule ?? fixturesModule.default?.LocalFixturesModule;
  const LocalFixtureSeeder = seederModule.LocalFixtureSeeder ?? seederModule.default?.LocalFixtureSeeder;
  const context = await NestFactory.createApplicationContext(LocalFixturesModule, { logger: false });

  return {
    seedFixtures: () => context.get(LocalFixtureSeeder).seedFixtures(),
    close: () => context.close(),
  };
}

export async function seedLocalFixtures({
  args = process.argv.slice(2),
  env = process.env,
  createContext = createSeedContext,
} = {}) {
  confirmDisposableDatabase(args);
  assertDisposableLocalDatabase(env);

  const context = await createContext();
  try {
    await context.seedFixtures();
    return true;
  } finally {
    await context.close();
  }
}

async function main() {
  await seedLocalFixtures();
  console.log(`Local fixtures seeded in ${SAMPLE_DISPOSABLE_DATABASE}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : '';
    console.error(
      message.startsWith('Fixture seeding') || message.startsWith('Confirm the target')
        ? message
        : 'Fixture seeding failed. Verify the local database settings, migrations, and empty database state.',
    );
    process.exitCode = 1;
  });
}
