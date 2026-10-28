import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, createWriteStream, copyFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { spawn, spawnSync } from 'node:child_process';
import { Pool } from 'pg';
import { startMailpit, stopMailpit } from '../../local-mailpit.mjs';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
export const browserPorts = { api: 4300, client: 3301, supplier: 3302, guest: 3303, event: 3304, mailpit: 58025 };
export function assertBrowserDatabase(value) {
  const url = new URL(value);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Browser acceptance requires an explicit loopback PostgreSQL server.');
  if (url.search || url.hash) throw new Error('Browser database URLs cannot contain query overrides or fragments.');
  return url;
}
export function browserEnvironment(databaseUrl, directory) {
  const url = assertBrowserDatabase(databaseUrl);
  if (!/^\/prism_browser_[a-f0-9]{12}$/.test(url.pathname)) throw new Error('Browser acceptance requires its own newly created prism_browser database.');
  const env = {
    DATABASE_URL: url.href, DIRECT_URL: '', SUPABASE_DB_URL: '', PRISMA_DATABASE_URL: '', SHADOW_DATABASE_URL: '', DB_SSL: 'false', DB_SSL_CA_FILE: '',
    PRISM_LOCAL_DEV: '', PRISMA_MIGRATIONS_PATH: '', PRISM_SCHEMA_COMPATIBILITY_MODE: 'exact',
    PRISM_SCHEMA_REQUIRED_HEAD: readdirSync(join(root, 'apps/api/prisma/migrations')).filter(n => /^\d+_/.test(n)).sort().at(-1),
    NODE_ENV: 'development', PORT: String(browserPorts.api), PRISM_SESSION_SECRET: randomBytes(32).toString('hex'), PRISM_SESSION_TTL_SECONDS: '28800',
    PRISM_TRUST_PROXY: 'true', PRISM_SEED_ENV: 'local', PRISM_MAIL_TRANSPORT: 'mailpit', PRISM_MAILPIT_URL: `http://127.0.0.1:${browserPorts.mailpit}`, RESEND_API_KEY: '',
    PRISM_STORAGE_PROVIDER: 'local', PRISM_STORAGE_LOCAL_DIRECTORY: join(directory, 'storage'), PRISM_DISABLE_CONFORME_REMINDER_JOB: 'true',
    AI_PROVIDER: 'mock', AI_ROUTE_PROFILE: 'mock', PARE_MODE: 'mock', NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_API_URL: `http://127.0.0.1:${browserPorts.api}`, NEXT_PUBLIC_PRISM_API_BASE_URL: `http://127.0.0.1:${browserPorts.api}/api`,
    NEXT_PUBLIC_CLIENT_ORIGIN: `http://127.0.0.1:${browserPorts.client}`, PRISM_NEXT_DIST_DIR: '.next-acceptance',
    CORS_ORIGIN: ['client', 'supplier', 'guest', 'event'].map(app => `http://127.0.0.1:${browserPorts[app]}`).join(','),
    E2E_API_URL: `http://127.0.0.1:${browserPorts.api}/api`, E2E_SECRETS_FILE: join(directory, 'mfa.json'), BROWSER_RUN_DIRECTORY: directory,
  };
  for (const app of ['client', 'supplier', 'guest', 'event']) {
    env[`NEXT_PUBLIC_${app.toUpperCase()}_PORTAL_URL`] = `http://127.0.0.1:${browserPorts[app]}`;
    if (app !== 'guest') env[`PRISM_${app.toUpperCase()}_PORTAL_URL`] = env[`NEXT_PUBLIC_${app.toUpperCase()}_PORTAL_URL`];
  }
  for (const role of ['ADMIN', 'CLIENT', 'COORDINATOR', 'SUPPLIER']) env[`PRISM_SEED_PASSWORD_${role}`] = randomBytes(24).toString('hex');
  return env;
}
async function requireFreePort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Browser test port ${port} is busy; existing processes were preserved.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
async function awaitReady(url, children) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (children.some(child => child.exitCode !== null)) throw new Error('A browser test server exited. Inspect the private run logs.');
    if (await fetch(url, { signal: AbortSignal.timeout(2500) }).then(r => r.ok).catch(() => false)) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Browser test server did not become ready (${new URL(url).origin}).`);
}
export async function main(args = process.argv.slice(2)) {
  for (const port of Object.values(browserPorts)) await requireFreePort(port);
  const selected = process.env.BROWSER_DATABASE_URL || parseEnv(readFileSync(process.env.PRISM_ENV_FILE || join(root, '.local-dev/api.env'), 'utf8')).DATABASE_URL;
  const serverUrl = assertBrowserDatabase(selected);
  const id = randomUUID().replaceAll('-', '').slice(0, 12);
  const dbName = `prism_browser_${id}`;
  const directory = join(root, '.local-dev/browser', id);
  const mailName = `prism-mailpit-browser-${id}`;
  const owner = new Pool({ connectionString: serverUrl.href, ssl: false, connectionTimeoutMillis: 10000 });
  const children = [];
  const nextFiles = ['client', 'supplier', 'guest', 'event'].flatMap(app => ['next-env.d.ts', 'tsconfig.json'].map(file => {
    const path = join(root, `apps/${app}`, file);
    return { path, file, original: readFileSync(path, 'utf8') };
  }));
  let created = false;
  let mailStarted = false;
  function stopChild(child) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  const interrupt = () => { process.exitCode = 130; children.forEach(stopChild); };
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  function launch(script, argv, cwd, env, logName) {
    const log = createWriteStream(join(directory, `${logName}.log`), { mode: 0o600 });
    const child = spawn(process.execPath, [script, ...argv], { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(log); child.stderr.pipe(log);
    child.once('error', () => { process.exitCode = 1; });
    children.push(child);
    return child;
  }
  async function run(script, argv, cwd, env, logName) {
    const child = launch(script, argv, cwd, env, logName);
    const code = await new Promise(resolve => child.once('exit', resolve));
    children.splice(children.indexOf(child), 1);
    if (code !== 0) throw new Error(`${logName} failed. Inspect ${join(directory, `${logName}.log`)} (private).`);
  }
  try {
    await owner.query(`CREATE DATABASE "${dbName}"`); created = true;
    mkdirSync(directory, { recursive: true });
    const target = new URL(serverUrl); target.pathname = `/${dbName}`;
    const values = browserEnvironment(target.href, directory);
    const envFile = join(directory, 'api.env');
    writeFileSync(envFile, Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
    const env = { ...process.env, ...values, PRISM_ENV_FILE: envFile };
    await startMailpit({ name: mailName, port: browserPorts.mailpit }); mailStarted = true;
    console.log(`Browser acceptance: disposable ${dbName}; test inbox ${values.PRISM_MAILPIT_URL}`);
    const apiDir = join(root, 'apps/api');
    await run(join(root, 'node_modules/prisma/build/index.js'), ['migrate', 'deploy'], apiDir, env, 'migrate');
    for (const profile of ['accounts', 'portal-uat']) await run(join(apiDir, 'scripts/seed.mjs'), ['--profile', profile, '--scenario-date', new Date().toISOString().slice(0, 10), '--env-file', envFile], apiDir, env, `seed-${profile}`);
    if (!args.includes('--skip-build')) await run(join(root, 'node_modules/@nestjs/cli/bin/nest.js'), ['build', 'api', '--path', 'tsconfig.e2e.json'], apiDir, env, 'build-api');
    for (const asset of ['kernel/database/db-connection-config.cjs', 'kernel/database/migration-ledger-compatibility.cjs', 'modules/identity-access/application/auth/password-hash.cjs']) {
      const destination = join(apiDir, '.e2e-dist/apps/api/src', asset);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(apiDir, 'src', asset), destination);
    }
    launch(join(apiDir, 'scripts/run-with-env.mjs'), ['.e2e-dist/apps/api/src/main.js'], apiDir, env, 'api');
    await awaitReady(`${values.NEXT_PUBLIC_API_URL}/health`, children);
    await run(join(root, 'scripts/e2e/browser/prepare-fixtures.mjs'), [], root, env, 'prepare-fixtures');
    for (const app of ['client', 'supplier', 'guest', 'event']) launch(join(root, 'node_modules/next/dist/bin/next'), ['dev', '--hostname', '127.0.0.1', '--port', String(browserPorts[app])], join(root, `apps/${app}`), env, app);
    await Promise.all(['client', 'supplier', 'guest', 'event'].map(app => awaitReady(`http://127.0.0.1:${browserPorts[app]}/${app === 'guest' ? 'open' : 'sign-in'}`, children)));
    const testArgs = args.filter(arg => arg !== '--skip-build');
    const child = launch(join(root, 'node_modules/@playwright/test/cli.js'), ['test', '--config', 'scripts/e2e/browser/playwright.config.mjs', ...testArgs], root, env, 'playwright');
    child.stdout.on('data', data => process.stdout.write(data)); child.stderr.on('data', data => process.stderr.write(data));
    const code = await new Promise(resolve => child.once('exit', resolve));
    process.exitCode = code === 0 ? 0 : 1;
    console.log(`Private browser report: ${directory}`);
  } finally {
    children.reverse().forEach(stopChild);
    if (mailStarted) stopMailpit(mailName, { remove: true });
    if (created) {
      await owner.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [dbName]);
      await owner.query(`DROP DATABASE "${dbName}"`);
    }
    await owner.end();
    for (const { path, file, original } of nextFiles) {
      const current = readFileSync(path, 'utf8');
      if (file === 'tsconfig.json') {
        const parsed = JSON.parse(current);
        parsed.include = parsed.include?.filter(value => !value.startsWith('.next-acceptance/'));
        if (JSON.stringify(parsed) === JSON.stringify(JSON.parse(original))) writeFileSync(path, original);
      } else if (current.includes('./.next-acceptance/') && current.replaceAll('./.next-acceptance/dev/', './.next/').replaceAll('./.next-acceptance/', './.next/') === original) writeFileSync(path, original);
    }
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
