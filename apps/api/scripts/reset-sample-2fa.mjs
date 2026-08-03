// Clears local 2FA/TOTP enrolment and lockout state for a sample account.
//
// Why this exists: POST /sample/reset sits behind EventSessionGuard and requires
// a PmcmAdmin session. If a developer's local sample account has 2FA enrolled and
// the TOTP state is unusable (lost authenticator, clock skew, half-finished
// enrolment), logging in is impossible - so the endpoint that would fix it returns
// 401, and the account is permanently wedged. This script reaches the database
// directly and needs no HTTP session, breaking that deadlock.
//
// Usage:
//   PRISM_API_2FA_RESET_I_UNDERSTAND=1 npm run db:reset:2fa
//   PRISM_API_2FA_RESET_I_UNDERSTAND=1 npm run db:reset:2fa -- --email=other@pmcm.test
//   ... -- --all-sample   (every *@pmcm.test / *.test account)

import process from 'node:process';
import { Pool } from 'pg';

const DEFAULT_EMAIL = 'mys@pmcm.test';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run: NODE_ENV=production. This script is for local development only.');
  process.exit(1);
}

function parseArgs(argv) {
  const args = { email: DEFAULT_EMAIL, allSample: false };
  for (const arg of argv) {
    if (arg === '--all-sample') {
      args.allSample = true;
      continue;
    }
    const match = /^--email=(.+)$/.exec(arg);
    if (match) {
      args.email = match[1].trim();
      continue;
    }
    console.error(`Unknown argument: ${arg}`);
    console.error('Usage: reset-sample-2fa.mjs [--email=<address>] [--all-sample]');
    process.exit(2);
  }
  return args;
}

function connectionString() {
  const candidates = [process.env.SUPABASE_DB_URL, process.env.DATABASE_URL, process.env.PRISMA_DATABASE_URL, process.env.DIRECT_URL];
  const value = candidates.map((item) => item?.trim()).find(Boolean);
  if (!value) {
    console.error('No database URL configured. Set SUPABASE_DB_URL, DATABASE_URL, PRISMA_DATABASE_URL, or DIRECT_URL.');
    process.exit(1);
  }
  return value;
}

const args = parseArgs(process.argv.slice(2));

// Guard against pointing this at a shared database. Only sample/test-domain
// accounts are ever eligible, so a stray run cannot clear a real user's 2FA.
const SAMPLE_EMAIL_PATTERN = /(@pmcm\.test|\.test)$/i;
if (!args.allSample && !SAMPLE_EMAIL_PATTERN.test(args.email)) {
  console.error(`Refusing to reset 2FA for "${args.email}": not a sample account.`);
  console.error('Only addresses ending in @pmcm.test or .test are eligible.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString(),
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

try {
  const where = args.allSample ? `email ilike '%@pmcm.test' or email ilike '%.test'` : 'email = $1';
  const params = args.allSample ? [] : [args.email];

  const before = await pool.query(
    `select email, role, two_factor_secret is not null as has_2fa,
            failed_login_count, lockout_count, locked_until, permanent_lockout
       from identity.users
      where ${where}
      order by email`,
    params,
  );

  if (before.rowCount === 0) {
    console.error(args.allSample ? 'No sample accounts found.' : `No user found with email "${args.email}".`);
    process.exit(1);
  }

  const result = await pool.query(
    `update identity.users
        set two_factor_secret  = null,
            failed_login_count = 0,
            lockout_count      = 0,
            locked_until       = null,
            permanent_lockout  = false
      where ${where}
      returning email`,
    params,
  );

  console.log(`Reset 2FA and lockout state for ${result.rowCount} account(s):`);
  for (const row of before.rows) {
    const flags = [
      row.has_2fa ? '2FA cleared' : '2FA was not set',
      row.permanent_lockout ? 'permanent lockout lifted' : null,
      row.locked_until ? `lockout until ${new Date(row.locked_until).toISOString()} lifted` : null,
      row.failed_login_count > 0 ? `${row.failed_login_count} failed login(s) cleared` : null,
    ].filter(Boolean);
    console.log(`  - ${row.email} (${row.role}): ${flags.join(', ')}`);
  }
  console.log('\nYou can now log in with the sample password and re-enrol 2FA from scratch.');
} catch (error) {
  console.error('Failed to reset sample 2FA state.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await pool.end();
}
