// Clears local 2FA/TOTP enrolment and lockout state for a seeded local test account.
//
// Why this exists: if a seeded local test account has unusable TOTP state (lost
// authenticator, clock skew, or half-finished enrolment), login may be impossible.
// This acknowledgement-gated local database tool can clear that account state.
//
// Usage:
//   PRISM_API_2FA_RESET_I_UNDERSTAND=1 npm run db:reset:2fa
//   PRISM_API_2FA_RESET_I_UNDERSTAND=1 npm run db:reset:2fa -- --email=other@pmcm.test
//   ... -- --all-fixtures   (every *@pmcm.test / *.test account)

import process from 'node:process';
import { Pool } from 'pg';

const DEFAULT_EMAIL = 'mys@pmcm.test';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run: NODE_ENV=production. This script is for local development only.');
  process.exit(1);
}

function parseArgs(argv) {
  const args = { email: DEFAULT_EMAIL, allFixtures: false };
  for (const arg of argv) {
    if (arg === '--all-fixtures') {
      args.allFixtures = true;
      continue;
    }
    const match = /^--email=(.+)$/.exec(arg);
    if (match) {
      args.email = match[1].trim();
      continue;
    }
    console.error(`Unknown argument: ${arg}`);
    console.error('Usage: reset-local-fixture-2fa.mjs [--email=<address>] [--all-fixtures]');
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

// Guard against pointing this at a shared database. Only seeded test-domain
// accounts are ever eligible, so a stray run cannot clear a real user's 2FA.
const FIXTURE_EMAIL_PATTERN = /(@pmcm\.test|\.test)$/i;
if (!args.allFixtures && !FIXTURE_EMAIL_PATTERN.test(args.email)) {
  console.error(`Refusing to reset 2FA for "${args.email}": not an eligible local fixture account.`);
  console.error('Only seeded test-account addresses ending in @pmcm.test or .test are eligible.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString(),
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

try {
  const where = args.allFixtures ? `email ilike '%@pmcm.test' or email ilike '%.test'` : 'email = $1';
  const params = args.allFixtures ? [] : [args.email];

  const before = await pool.query(
    `select email, role, two_factor_secret is not null as has_2fa,
            failed_login_count, lockout_count, locked_until, permanent_lockout
       from identity.users
      where ${where}
      order by email`,
    params,
  );

  if (before.rowCount === 0) {
    console.error(args.allFixtures ? 'No seeded test accounts found.' : `No user found with email "${args.email}".`);
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
  console.log('\nYou can now log in with the seeded test password and re-enrol 2FA from scratch.');
} catch (error) {
  console.error('Failed to reset sample 2FA state.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await pool.end();
}
