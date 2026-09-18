import process from 'node:process';
import { Pool } from 'pg';

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

// Keep this order aligned with prisma.config.ts: the explicit Prisma override
// must be the URL db:doctor validates before Prisma CLI uses it.
const prismaCandidates = [
  ['PRISMA_DATABASE_URL', process.env.PRISMA_DATABASE_URL],
  ['DIRECT_URL', process.env.DIRECT_URL],
  ['SUPABASE_DB_URL', process.env.SUPABASE_DB_URL],
  ['DATABASE_URL', process.env.DATABASE_URL],
];
const runtimeCandidates = [
  ['SUPABASE_DB_URL', process.env.SUPABASE_DB_URL],
  ['DATABASE_URL', process.env.DATABASE_URL],
  ['PRISMA_DATABASE_URL', process.env.PRISMA_DATABASE_URL],
  ['DIRECT_URL', process.env.DIRECT_URL],
].filter(([, value]) => Boolean(value?.trim()));

function isPoolerUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.hostname.includes('pooler.supabase.com') || parsed.port === '6543';
  } catch {
    return false;
  }
}

const selected =
  mode === 'runtime'
    ? runtimeCandidates.find(([, value]) => isPoolerUrl(value)) ?? runtimeCandidates[0]
    : prismaCandidates.find(([, value]) => Boolean(value?.trim()));

if (!selected) {
  console.error(
    'No Prisma database URL configured. Set PRISMA_DATABASE_URL, DIRECT_URL, SUPABASE_DB_URL, or DATABASE_URL in prism-api/.env.',
  );
  process.exit(1);
}

const [source, rawUrl] = selected;

let parsed;
try {
  parsed = new URL(rawUrl);
} catch {
  console.error(`The selected ${source} value is not a valid postgres URL.`);
  process.exit(1);
}

const redactedUser = decodeURIComponent(parsed.username || 'postgres');
const redactedTarget = `${parsed.protocol}//${redactedUser}:<redacted>@${parsed.host}${parsed.pathname}`;
const isPoolerHost = parsed.hostname.includes('pooler.supabase.com');
const isLikelyPoolerPort = parsed.port === '6543';
const isPooler = isPoolerHost || isLikelyPoolerPort;

if (isPooler) {
  const hint =
    'Prefer a direct host (db.<project-ref>.supabase.co:5432) via DIRECT_URL or PRISMA_DATABASE_URL for Prisma migrations and transaction-safe workflows.';

  if (mode === 'prisma' && process.env.ALLOW_POOLER_FOR_PRISMA !== '1') {
    console.error(
      `${source} appears to be a Supabase pooler/pgbouncer connection. ${hint} (To override for edge cases, set ALLOW_POOLER_FOR_PRISMA=1.)`,
    );
    process.exit(1);
  } else {
    console.warn(`${source} appears to be a Supabase pooler/pgbouncer connection. ${hint}`);
  }
}

const pool = new Pool({
  connectionString: rawUrl,
  ssl:
    process.env.DB_SSL === 'false'
      ? false
      : {
          rejectUnauthorized: false,
        },
  // PA-307. Kept in step with src/kernel/database/prisma.service.ts so the doctor
  // stays representative of runtime. connectionTimeoutMillis is strictly an
  // improvement here: today this script has no timeout and can hang indefinitely.
  max: 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 60_000,
});

try {
  await pool.query('select 1');
  console.log(`Prisma DB check passed using ${source} (mode=${mode}).`);
  console.log(`Target: ${redactedTarget}`);

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

  console.error(`Prisma DB check failed using ${source}.`);
  console.error(`Target: ${redactedTarget}`);

  if (message.toLowerCase().includes('password authentication failed')) {
    console.error(
      'The database password appears invalid. Regenerate the Supabase database password, URL-encode special characters, and update DB URLs in prism-api/.env.',
    );
  } else {
    console.error(message);
  }

  process.exit(1);
} finally {
  await pool.end();
}
