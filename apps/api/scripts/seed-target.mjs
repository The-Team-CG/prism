import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { selectDatabaseConnection } from './db-connection-config.mjs';

export function loadSeedEnvironment(file) {
  if (!file) throw new Error('Supply --env-file (or PRISM_ENV_FILE). No implicit .env is loaded.');
  // Only the selected file supplies database settings; inherited URLs cannot redirect the command.
  return parseEnv(readFileSync(file, 'utf8'));
}

export function describeSeedTarget(env) {
  const database = selectDatabaseConnection({ purpose: 'runtime', env });
  const url = new URL(database.connectionString);
  const name = decodeURIComponent(url.pathname.slice(1));
  const identity = [database.hostname, database.port, name, decodeURIComponent(url.username)].join('/');
  return { database, name, fingerprint: createHash('sha256').update(identity).digest('hex').slice(0, 20) };
}

export function assertSeedTarget(env, target) {
  if (env.NODE_ENV?.trim().toLowerCase() === 'production') throw new Error('Seeding is disabled in production.');
  if (target.database.port === '6543') throw new Error('Use the port-5432 session pooler or a direct connection for transactional seeding.');
  if (env.PRISM_SEED_ENV === 'local' && target.database.isLoopback) return;
  if (env.PRISM_SEED_ENV !== 'uat') throw new Error('Select PRISM_SEED_ENV=local (loopback only) or uat.');
  if (env.PRISM_SEED_TARGET !== target.fingerprint) throw new Error('UAT target mismatch. Review --show-target and pin PRISM_SEED_TARGET in the selected private env file.');
}

export function scenarioAnchor(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) throw new Error('Supply --scenario-date YYYY-MM-DD for portal-uat (Asia/Manila).');
  const utc = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(utc.valueOf()) || utc.toISOString().slice(0, 10) !== value) throw new Error('Invalid scenario date.');
  return `${value}T00:00:00+08:00`;
}
