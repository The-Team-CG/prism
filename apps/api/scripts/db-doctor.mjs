import process from 'node:process';
import { Pool } from 'pg';
import { selectDatabaseConnection } from './db-connection-config.mjs';
import { inspectMigrationHistory } from './db-migration-history.mjs';

/**
 * PA-309. Mirrors describeDatabaseError in src/kernel/database/prisma-error.ts.
 * Deliberately duplicated: that helper compiles to CommonJS under
 * "module": "commonjs", this is a native ESM .mjs, and bridging that split is the
 * module-system problem PA-308 is deferred on. Keep the two in step.
 */
function describeDatabaseError(error) {
  const message = error instanceof Error ? error.message : String(error);

  if (typeof error !== 'object' || error === null) return message;

  const parts = [message];
  if (typeof error.code === 'string' && error.code.length > 0) parts.push(`(code=${error.code})`);
  if (error.meta !== undefined && error.meta !== null) {
    let rendered;
    try {
      rendered = JSON.stringify(error.meta) ?? String(error.meta);
    } catch {
      rendered = String(error.meta);
    }
    parts.push(`meta=${rendered}`);
  }

  return parts.join(' ');
}

const args = process.argv.slice(2);
const modeArg = args.find((arg) => arg.startsWith('--mode='));
const mode = modeArg ? modeArg.slice('--mode='.length) : 'prisma';

if (mode !== 'prisma' && mode !== 'runtime') {
  console.error(`Unknown db-doctor mode: ${mode}. Expected --mode=prisma or --mode=runtime.`);
  process.exit(1);
}

let database;
try {
  database = selectDatabaseConnection({ purpose: mode === 'runtime' ? 'runtime' : 'migration' });
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Database connection configuration is invalid.');
  process.exit(1);
}

if (database.isPooler && database.port === '6543') {
  const hint =
    'Prefer a direct host (db.<project-ref>.supabase.co:5432) via DIRECT_URL or PRISMA_DATABASE_URL for Prisma migrations and transaction-safe workflows.';

  if (mode === 'prisma' && process.env.ALLOW_POOLER_FOR_PRISMA !== '1') {
    console.error(
      `${database.source} appears to be a Supabase pooler/pgbouncer connection. ${hint} (To override for edge cases, set ALLOW_POOLER_FOR_PRISMA=1.)`,
    );
    process.exit(1);
  } else {
    console.warn(`${database.source} appears to be a Supabase pooler/pgbouncer connection. ${hint}`);
  }
}

const pool = new Pool({
  connectionString: database.connectionString,
  ssl: database.ssl,
  // PA-307, values agreed with Anthony. Kept in step with
  // src/kernel/database/prisma.service.ts so the doctor stays representative of
  // runtime. max: 5 halves pg's default ceiling of 10. connectionTimeoutMillis is
  // strictly an improvement here: today this script has no timeout at all and can
  // hang indefinitely.
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 30_000,
});

try {
  await pool.query('select 1');
  console.log(`Prisma DB check passed using ${database.source} (mode=${mode}).`);
  console.log(`Target: ${database.target}`);

  if (args.includes('--migration-history')) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      const history = await inspectMigrationHistory(client);
      console.log(JSON.stringify(history, null, 2));
      if (history.issues.length) process.exitCode = 1;
    } finally {
      try { await client.query('ROLLBACK'); }
      finally { client.release(); }
    }
  }

  try {
    const version = await pool.query('show server_version');
    const serverVersion = version.rows?.[0]?.server_version;
    if (serverVersion) {
      console.log(`Postgres: ${serverVersion}`);
    }

    const reg = await pool.query("select to_regclass('public._prisma_migrations') as regclass");
    const regclass = reg.rows?.[0]?.regclass ?? null;
    if (regclass) {
      const count = await pool.query('select count(*)::int as count from public._prisma_migrations');
      const applied = count.rows?.[0]?.count;
      if (typeof applied === 'number') {
        console.log(`_prisma_migrations: present (${applied} rows)`);
      } else {
        console.log(`_prisma_migrations: present`);
      }
    } else {
      console.log('_prisma_migrations: not found (fresh DB or migrations not yet deployed)');
    }
  } catch (error) {
    const message = describeDatabaseError(error);
    console.warn(`DB metadata check skipped: ${message}`);
  }
} catch (error) {
  const message = describeDatabaseError(error);

  console.error(`Prisma DB check failed using ${database.source}.`);
  console.error(`Target: ${database.target}`);

  if (message.toLowerCase().includes('password authentication failed')) {
    console.error(
      'The database password appears invalid. Regenerate the Supabase database password, URL-encode special characters, and update DB URLs in prism-api/.env.',
    );
  } else {
    console.error(message);
  }

  process.exitCode = 1;
} finally {
  await pool.end();
}
