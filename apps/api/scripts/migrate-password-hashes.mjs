// One-off rewrite of operator password values into the single current hash format
// (see src/modules/identity-access/application/auth/password-hash.cjs).
//
// Run once before deploying the API that verifies only this format:
//   npm --workspace prism-api run db:migrate:password-hashes -- --dry-run
//   npm --workspace prism-api run db:migrate:password-hashes
//
// - Node-default scrypt hashes (N=16384, r=8, p=1) are rewritten with those explicit parameters.
//   Their salt and derived key are unchanged, so no password is re-derived here.
// - Plaintext values are hashed with the current parameters.
// - Values already in the current format are skipped, so re-running is a no-op.
// - Any value that starts with "scrypt$" but matches neither format aborts the run with no writes.
// Only counts are printed; no password value is ever logged.

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { selectDatabaseConnection } from './db-connection-config.mjs';
import passwordHash from '../src/modules/identity-access/application/auth/password-hash.cjs';

const LEGACY_PARAMS = Object.freeze({ N: 16384, r: 8, p: 1 });
const LEGACY_PATTERN = /^scrypt\$([0-9a-f]{32})\$([0-9a-f]{128})$/i;
const SCRYPT_PREFIX = 'scrypt$';

export function planPasswordRewrite(stored) {
  if (typeof stored !== 'string') return { kind: 'malformed' };
  if (passwordHash.parseScryptPasswordHash(stored)) return { kind: 'skip' };
  if (LEGACY_PATTERN.test(stored)) return { kind: 'legacy' };
  if (stored.startsWith(SCRYPT_PREFIX)) return { kind: 'malformed' };
  return { kind: 'plaintext' };
}

export async function rewritePasswordValue(stored, kind) {
  if (kind === 'legacy') {
    const [, salt, derivedHex] = LEGACY_PATTERN.exec(stored);
    return passwordHash.formatScryptPasswordHash({ params: LEGACY_PARAMS, salt, derivedHex });
  }
  if (kind === 'plaintext') return passwordHash.hashScryptPassword(stored);
  throw new Error(`No rewrite exists for kind ${kind}`);
}

function parseArguments(argv) {
  const unknown = argv.filter((arg) => arg !== '--dry-run');
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown[0]}. Usage: migrate-password-hashes.mjs [--dry-run]`);
  return { dryRun: argv.includes('--dry-run') };
}

function countKinds(rows) {
  const counts = { total: rows.length, skip: 0, legacy: 0, plaintext: 0, malformed: 0 };
  for (const row of rows) counts[row.kind] += 1;
  return counts;
}

export async function migratePasswordHashes({ dryRun, connectionString, ssl }) {
  const pool = new Pool({ connectionString, ssl });
  try {
    const { rows } = await pool.query('select id, password from identity_access.users order by id');
    const planned = rows.map((row) => ({ id: row.id, password: row.password, kind: planPasswordRewrite(row.password).kind }));
    const counts = countKinds(planned);
    console.log(`Password values: ${JSON.stringify(counts)}`);

    if (counts.malformed > 0) {
      throw new Error(`${counts.malformed} stored value(s) start with "scrypt$" but match neither format; nothing was written. Investigate before retrying.`);
    }
    const pending = planned.filter((row) => row.kind === 'legacy' || row.kind === 'plaintext');
    if (dryRun) {
      console.log(`Dry run: ${pending.length} value(s) would be rewritten; nothing was written.`);
      return counts;
    }
    if (pending.length === 0) {
      console.log('Nothing to rewrite.');
      return counts;
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const row of pending) {
        const next = await rewritePasswordValue(row.password, row.kind);
        // Compare-and-set on the value read above, so a concurrent password change aborts the run.
        const result = await client.query(
          'update identity_access.users set password = $1 where id = $2 and password = $3',
          [next, row.id, row.password],
        );
        if (result.rowCount !== 1) throw new Error('A password value changed during the rewrite; nothing was committed. Re-run the script.');
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    console.log(`Rewrote ${pending.length} value(s) into the current password hash format.`);
    return counts;
  } finally {
    await pool.end();
  }
}

const SCRIPT_PATH = fileURLToPath(import.meta.url);
// run-with-env.mjs imports this file with a relative argv[1], so resolve before comparing.
if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    const { dryRun } = parseArguments(process.argv.slice(2));
    const database = selectDatabaseConnection({ purpose: 'runtime' });
    await migratePasswordHashes({ dryRun, connectionString: database.connectionString, ssl: database.ssl });
  } catch (error) {
    console.error(`Password hash migration failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
