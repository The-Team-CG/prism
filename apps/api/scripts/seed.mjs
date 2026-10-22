import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { AuthSecurityService } from '../src/modules/identity-access/application/auth/auth-security.service.ts';
import { seedProfile } from './seed-data.mjs';
import { assertSeedTarget, describeSeedTarget, loadSeedEnvironment, scenarioAnchor } from './seed-target.mjs';

export function parseSeedOptions(args) {
  const { values } = parseArgs({ args, options: {
    profile: { type: 'string' }, 'env-file': { type: 'string' }, 'scenario-date': { type: 'string' },
    'dry-run': { type: 'boolean' }, verify: { type: 'boolean' }, 'show-target': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) return values;
  if (values['dry-run'] && values.verify) throw new Error('Choose --dry-run or --verify.');
  if (!values['show-target'] && !['accounts', 'portal-uat'].includes(values.profile)) throw new Error('Choose --profile accounts or portal-uat.');
  return values;
}

function passwordProvider(env) {
  return key => {
    const password = env[`PRISM_SEED_PASSWORD_${key}`];
    if (!password || password.length < 12) throw new Error(`Set PRISM_SEED_PASSWORD_${key} (at least 12 characters) in the private env file for missing accounts.`);
    return AuthSecurityService.hashPassword(password);
  };
}

export async function main(args = process.argv.slice(2)) {
  const options = parseSeedOptions(args);
  if (options.help) {
    console.log('db:seed -- --profile accounts|portal-uat --env-file <absolute-private-file> [--scenario-date YYYY-MM-DD] [--dry-run|--verify]\nUse --show-target to inspect/pin the configured target without connecting. See docs/runbooks/environments-and-fixtures.md.');
    return;
  }
  const env = loadSeedEnvironment(options['env-file'] ?? process.env.PRISM_ENV_FILE);
  const target = describeSeedTarget(env);
  console.log(`Target: ${target.database.target}/${target.name}; fingerprint=${target.fingerprint}; environment=${env.PRISM_SEED_ENV ?? 'unset'}`);
  if (options['show-target']) return;
  assertSeedTarget(env, target);
  const anchor = options.profile === 'portal-uat' ? scenarioAnchor(options['scenario-date']) : '2000-01-01T00:00:00+08:00';
  const mode = options.verify ? 'verify' : options['dry-run'] ? 'dry-run' : 'apply';
  const pool = new Pool({ connectionString: target.database.connectionString, ssl: target.database.ssl, max: 1, connectionTimeoutMillis: 10000 });
  try {
    const client = await pool.connect();
    try {
      const result = await seedProfile(client, { profile: options.profile, anchor, mode, passwordFor: passwordProvider(env) });
      console.log(JSON.stringify(result, null, 2));
      if (mode === 'verify' && result.missing.length) process.exitCode = 1;
    } finally { client.release(); }
  } finally { await pool.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // PostgreSQL errors may contain row/password/token values; print only a diagnostic code.
    console.error(error.code ? `Seed failed (${error.code}); check database schema, privileges, and fixture constraints.` : error.message);
    process.exitCode = 1;
  });
}
