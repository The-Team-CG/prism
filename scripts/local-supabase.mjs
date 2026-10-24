import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveLivePortSet, normalizeWorktreePath, corsOriginFor } from './prism-ports.mjs';
import { resolveDatabaseUrl } from '../apps/api/src/kernel/database/database-target.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const excludedServices = 'gotrue,realtime,storage-api,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor';

export function localProject({ worktreeRoot, ports, migrationBase = '' }) {
  const offset = ports.api - 4000;
  if (!Number.isInteger(offset) || offset < 0 || offset > 480 || offset % 10 !== 0) throw new Error('Invalid checkout port slot.');
  const identity = normalizeWorktreePath(worktreeRoot) + (migrationBase ? `\0${migrationBase}` : '');
  const id = `prism-${createHash('sha256').update(identity).digest('hex').slice(0, 12)}`;
  return { id, dbPort: 54322 + offset, apiPort: 54321 + offset, studioPort: 54323 + offset, shadowPort: 54320 + offset, smtpPort: 54324 + offset, poolerPort: 54329 + offset };
}

export function renderConfig(template, project) {
  return template.replace('project_id = "prism-local"', `project_id = "${project.id}"`)
    .replace('port = 54321', `port = ${project.apiPort}`)
    .replace('port = 54322', `port = ${project.dbPort}`)
    .replace('shadow_port = 54320', `shadow_port = ${project.shadowPort}`)
    .replace('port = 54323', `port = ${project.studioPort}`)
    .replace('port = 54324', `port = ${project.smtpPort}`)
    .replace('port = 54329', `port = ${project.poolerPort}`);
}

function cli(args, capture = false) {
  const shim = join(root, 'node_modules/supabase/dist/supabase.js');
  if (!existsSync(shim)) throw new Error('Install the pinned Supabase CLI with npm install first.');
  const result = spawnSync(process.execPath, [shim, ...args], { cwd: root, env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' }, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`Local Supabase command failed (${args[0]}). Check Docker and local service logs.`);
  return result.stdout;
}

export function developmentEnv(url, project, ports, sessionSecret) {
  const parsed = new URL(url);
  const env = {
    DATABASE_URL: parsed.href,
    // Empty compatibility names prevent dotenv or inherited shell config from restoring hosted values.
    SUPABASE_DB_URL: '', PRISMA_DATABASE_URL: '', DIRECT_URL: '', SHADOW_DATABASE_URL: '',
    PRISM_LOCAL_DEV: '1', PRISM_LOCAL_DATABASE_HOST: parsed.hostname, PRISM_LOCAL_DATABASE_PORT: String(project.dbPort),
    DB_SSL: 'false', DB_SSL_CA_FILE: '', ALLOW_POOLER_FOR_PRISMA: '', NODE_ENV: 'development',
    PRISMA_MIGRATIONS_PATH: '', PRISM_SCHEMA_COMPATIBILITY_MODE: 'exact', PRISM_SCHEMA_REQUIRED_HEAD: project.migrationHead || '',
    PORT: String(ports.api), CORS_ORIGIN: corsOriginFor(ports),
    NEXT_PUBLIC_API_URL: `http://localhost:${ports.api}`,
    NEXT_PUBLIC_PRISM_API_BASE_URL: `http://localhost:${ports.api}/api`,
    NEXT_PUBLIC_CLIENT_ORIGIN: `http://localhost:${ports.client}`,
    ...Object.fromEntries(['client', 'supplier', 'guest', 'event'].map((app) => [`NEXT_PUBLIC_${app.toUpperCase()}_PORTAL_URL`, `http://localhost:${ports[app]}`])),
    PRISM_SESSION_SECRET: sessionSecret, PRISM_TRUST_PROXY: 'false', AI_ROUTE_PROFILE: 'mock', AI_PROVIDER: 'mock', PARE_MODE: 'mock',
    PRISM_DISABLE_CONFORME_REMINDER_JOB: '1',
  };
  resolveDatabaseUrl(env, 'migration');
  return env;
}

function writeEnv(path, env) {
  writeFileSync(path, Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
}

export async function runLocalSupabase(command = 'start') {
  if (command === 'check') {
    if (process.env.PRISM_LOCAL_DEV !== '1') throw new Error('Local database environment was not loaded.');
    resolveDatabaseUrl(process.env, 'migration');
    return;
  }
  // Ignore user port overrides for infrastructure: use the persisted checkout slot.
  const checkout = resolveLivePortSet({ env: {}, cwd: root });
  const appPorts = resolveLivePortSet({ cwd: root }).ports;
  const migrations = readdirSync(join(root, 'apps/api/prisma/migrations'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (!migrations.length) throw new Error('No checked-in Prisma migrations found.');
  const project = { ...localProject({ ...checkout, migrationBase: migrations[0] }), migrationHead: migrations.at(-1) };
  const localRoot = join(root, '.local-dev');
  const workdir = join(localRoot, 'supabase');
  const configPath = join(workdir, 'supabase/config.toml');
  if (command === 'stop') {
    if (existsSync(configPath)) cli(['stop', '--workdir', workdir]);
    return;
  }
  const previous = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
  const previousId = previous.match(/^project_id = "([^"]+)"/m)?.[1];
  if (previousId && previousId !== project.id) {
    if (command !== 'start') throw new Error('Migration baseline changed. Run db:local:start to select its isolated database.');
    // Preserve the retired history's data as a CLI backup; never reset or adopt it.
    cli(['stop', '--workdir', workdir]);
  }
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, renderConfig(readFileSync(join(root, 'supabase/config.toml'), 'utf8'), project));
  if (command === 'start') cli(['start', '--workdir', workdir, '--exclude', excludedServices]);
  const status = JSON.parse(cli(['status', '--workdir', workdir, '--output', 'json'], true));
  const databaseUrl = status.DB_URL;
  const secretFile = join(localRoot, `session-secret-${project.id}`);
  if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'), { mode: 0o600 });
  const env = developmentEnv(databaseUrl, project, appPorts, readFileSync(secretFile, 'utf8').trim());
  const hostEnvFile = join(localRoot, 'api.env');
  writeEnv(hostEnvFile, env);
  const dockerUrl = new URL(databaseUrl);
  dockerUrl.hostname = 'host.docker.internal';
  writeEnv(join(localRoot, 'docker.env'), developmentEnv(dockerUrl.href, project, appPorts, env.PRISM_SESSION_SECRET));
  writeFileSync(join(localRoot, 'database.json'), JSON.stringify({ projectId: project.id, dbPort: project.dbPort, studioUrl: `http://127.0.0.1:${project.studioPort}`, hostEnvFile }, null, 2));
  if (command === 'start') {
    const childEnv = { ...process.env, ...env, PRISM_ENV_FILE: hostEnvFile };
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: resolveDatabaseUrl(childEnv), ssl: false, connectionTimeoutMillis: 10000 });
    try { await pool.query('select 1'); } finally { await pool.end(); }
    const migrated = spawnSync(process.execPath, [join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { cwd: join(root, 'apps/api'), env: childEnv, stdio: 'inherit' });
    if (migrated.error || migrated.status !== 0) throw new Error('Local migrations failed. Prism apps were not started.');
  }
  console.log(`Local Supabase ready: ${project.id}; database 127.0.0.1:${project.dbPort}; Studio http://127.0.0.1:${project.studioPort}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2] || 'start';
  if (!['start', 'status', 'stop', 'check'].includes(command)) throw new Error('Use start, status, stop or check.');
  runLocalSupabase(command).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
