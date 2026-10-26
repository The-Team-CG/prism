import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateRuntimeEnv } from './runtime-env';

const sessionSecret = randomBytes(32).toString('hex');
const hostedDatabaseUrl = 'postgresql://postgres.project-ref:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
const mailAndPortals = {
  PRISM_MAIL_TRANSPORT: 'resend',
  RESEND_API_KEY: 're_test_only_key',
  PRISM_MAIL_FROM: 'P.R.I.S.M <no-reply@example.test>',
  PRISM_CLIENT_PORTAL_URL: 'https://client.example.test',
  PRISM_SUPPLIER_PORTAL_URL: 'https://supplier.example.test',
  PRISM_EVENT_PORTAL_URL: 'https://event.example.test',
};
const deployment = {
  NODE_ENV: 'production',
  DATABASE_URL: hostedDatabaseUrl,
  PRISM_SESSION_SECRET: sessionSecret,
  PRISM_SESSION_TTL_SECONDS: '28800',
  PORT: '4000',
  ...mailAndPortals,
};

/** Runs the real start-prism env generator in Node, as `scripts/local-supabase.test.mjs` does. */
function generatedLocalDevEnv(): Record<string, string> {
  const script = [
    "import('./scripts/local-supabase.mjs').then(({ developmentEnv }) => {",
    "  const env = developmentEnv('postgresql://postgres:postgres@127.0.0.1:54322/postgres', { dbPort: 54322, migrationHead: '' },",
    "    { api: 4000, client: 3001, supplier: 3002, guest: 3003, event: 3004 }, process.env.SESSION_SECRET);",
    "  process.stdout.write(JSON.stringify(env));",
    "});",
  ].join('\n');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: resolve(__dirname, '../../../../..'),
    env: { ...process.env, SESSION_SECRET: sessionSecret },
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout) as Record<string, string>;
}

function without(env: Record<string, string>, ...keys: string[]) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !keys.includes(key)));
}

describe('validateRuntimeEnv', () => {
  it('accepts the environment start-prism generates into .local-dev/api.env', () => {
    const generated = generatedLocalDevEnv();

    expect(validateRuntimeEnv(generated)).toBe(generated);
    expect(generated).toMatchObject({
      PRISM_MAIL_TRANSPORT: 'log',
      PRISM_CLIENT_PORTAL_URL: 'http://localhost:3001',
      PRISM_EVENT_PORTAL_URL: 'http://localhost:3004',
    });
  });

  it('accepts a deployment env with a database URL, session settings, mail and the four portal origins', () => {
    expect(validateRuntimeEnv(deployment)).toBe(deployment);
  });

  it.each([
    ['development', {}, ['PRISM_SESSION_SECRET', 'PRISM_SESSION_TTL_SECONDS', 'DATABASE_URL']],
    ['production', { DATABASE_URL: hostedDatabaseUrl, PRISM_SESSION_SECRET: 'short', PRISM_SESSION_TTL_SECONDS: '28800' }, ['PRISM_SESSION_SECRET']],
    ['production', { DATABASE_URL: hostedDatabaseUrl, JWT_SECRET: sessionSecret, PRISM_SESSION_TTL_SECONDS: '28800' }, ['PRISM_SESSION_SECRET']],
    ['production', { DATABASE_URL: hostedDatabaseUrl, PRISM_SESSION_SECRET: sessionSecret }, ['PRISM_SESSION_TTL_SECONDS']],
    ['production', { DATABASE_URL: hostedDatabaseUrl, PRISM_SESSION_SECRET: sessionSecret, PRISM_SESSION_TTL_SECONDS: '0' }, ['PRISM_SESSION_TTL_SECONDS']],
    ['production', { DATABASE_URL: hostedDatabaseUrl, PRISM_SESSION_SECRET: sessionSecret, PRISM_SESSION_TTL_SECONDS: '28800', PRISM_SESSION_TTL_SECONDS_CLIENT: 'soon' }, ['PRISM_SESSION_TTL_SECONDS_CLIENT']],
    [undefined, { PRISM_SESSION_SECRET: sessionSecret, PRISM_SESSION_TTL_SECONDS: '28800' }, ['DATABASE_URL']],
    ['production', { DATABASE_URL: hostedDatabaseUrl, PRISM_SESSION_SECRET: sessionSecret, PRISM_SESSION_TTL_SECONDS: '28800', PORT: 'eighty' }, ['PORT']],
  ])('fails fast outside tests (NODE_ENV=%s) and names every missing or invalid variable', (nodeEnv, env, invalidKeys) => {
    const run = () => validateRuntimeEnv({ NODE_ENV: nodeEnv, ...env });

    expect(run).toThrow('prism-api environment is invalid:');
    for (const key of invalidKeys) expect(run).toThrow(`- ${key}:`);
  });

  it.each([
    ['PRISM_MAIL_TRANSPORT', without(deployment, 'PRISM_MAIL_TRANSPORT')],
    ['PRISM_MAIL_TRANSPORT', { ...deployment, PRISM_MAIL_TRANSPORT: 'smtp' }],
    ['RESEND_API_KEY', without(deployment, 'RESEND_API_KEY')],
    ['PRISM_MAIL_FROM', without(deployment, 'PRISM_MAIL_FROM')],
    ['PRISM_MAIL_FROM', { ...deployment, PRISM_MAIL_FROM: 'not-an-address' }],
    ['PRISM_MAIL_TRANSPORT', { ...deployment, PRISM_MAIL_TRANSPORT: 'log' }],
    ['PRISM_CLIENT_PORTAL_URL', without(deployment, 'PRISM_CLIENT_PORTAL_URL')],
    ['PRISM_SUPPLIER_PORTAL_URL', without(deployment, 'PRISM_SUPPLIER_PORTAL_URL')],
    ['PRISM_EVENT_PORTAL_URL', without(deployment, 'PRISM_EVENT_PORTAL_URL')],
    ['PRISM_CLIENT_PORTAL_URL', { ...deployment, PRISM_CLIENT_PORTAL_URL: 'http://client.example.test' }],
    ['PRISM_EVENT_PORTAL_URL', { ...deployment, PRISM_EVENT_PORTAL_URL: 'https://user:secret@event.example.test' }],
  ])('names %s when the mail or portal configuration is wrong in production', (key, env) => {
    expect(() => validateRuntimeEnv(env)).toThrow(`- ${key}:`);
  });

  it('refuses the log mail transport under NODE_ENV=production even with every other variable set', () => {
    expect(() => validateRuntimeEnv({ ...without(deployment, 'RESEND_API_KEY', 'PRISM_MAIL_FROM'), PRISM_MAIL_TRANSPORT: 'log' }))
      .toThrow('PRISM_MAIL_TRANSPORT: log writes mail to the API log');
  });

  it('never echoes configured secret or database credential values in the error', () => {
    let message = '';
    try {
      validateRuntimeEnv({ NODE_ENV: 'production', DATABASE_URL: hostedDatabaseUrl, PRISM_SESSION_SECRET: 'short-but-secret', RESEND_API_KEY: '' });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('PRISM_SESSION_SECRET');
    expect(message).not.toMatch(/short-but-secret|password@/);
  });

  it('lets unit tests boot modules without database, secret, mail or portal configuration', () => {
    expect(validateRuntimeEnv({ NODE_ENV: 'test' })).toEqual({ NODE_ENV: 'test' });
  });
});
