import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SAMPLE_DISPOSABLE_DATABASE = 'prism_sample_disposable';
const RUNTIME_DATABASE_URL_ENV_NAMES = ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL'];

function isLoopbackHost(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === 'localhost' || normalized === '::1') return true;

  const octets = normalized.split('.').map(Number);
  return octets.length === 4 && octets[0] === 127 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255);
}

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

  const connectionString = RUNTIME_DATABASE_URL_ENV_NAMES
    .map((name) => env[name]?.trim())
    .find((value) => Boolean(value));
  if (!connectionString) {
    throw new Error('Set the API runtime database URL to a loopback prism_sample_disposable database.');
  }

  try {
    const database = new URL(connectionString);
    const databaseName = decodeURIComponent(database.pathname.replace(/^\/+/, ''));
    if (
      !['postgres:', 'postgresql:'].includes(database.protocol) ||
      !isLoopbackHost(database.hostname) ||
      databaseName !== SAMPLE_DISPOSABLE_DATABASE
    ) {
      throw new Error();
    }
  } catch {
    throw new Error('Fixture seeding requires the effective runtime URL to be a loopback prism_sample_disposable PostgreSQL database.');
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