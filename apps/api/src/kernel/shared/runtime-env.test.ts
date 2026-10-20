import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateRuntimeEnv } from './runtime-env';

const sessionSecret = randomBytes(32).toString('hex');
const hostedDatabaseUrl = 'postgresql://postgres.project-ref:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres';

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

describe('validateRuntimeEnv', () => {
  it('accepts the environment start-prism generates into .local-dev/api.env', () => {
    const generated = generatedLocalDevEnv();

    expect(validateRuntimeEnv(generated)).toBe(generated);
  });

  it('accepts a deployment env with a database URL and session secret', () => {
    const env = { NODE_ENV: 'production', DATABASE_URL: hostedDatabaseUrl, PRISM_SESSION_SECRET: sessionSecret, PORT: '4000' };

    expect(validateRuntimeEnv(env)).toBe(env);
  });

  it.each([
    ['development', {}, ['PRISM_SESSION_SECRET', 'DATABASE_URL']],
    ['production', { DATABASE_URL: hostedDatabaseUrl, PRISM_SESSION_SECRET: 'short' }, ['PRISM_SESSION_SECRET']],
    [undefined, { PRISM_SESSION_SECRET: sessionSecret }, ['DATABASE_URL']],
    ['production', { DATABASE_URL: hostedDatabaseUrl, PRISM_SESSION_SECRET: sessionSecret, PORT: 'eighty' }, ['PORT']],
  ])('fails fast outside tests (NODE_ENV=%s) and names every missing or invalid variable', (nodeEnv, env, invalidKeys) => {
    const run = () => validateRuntimeEnv({ NODE_ENV: nodeEnv, ...env });

    expect(run).toThrow('prism-api environment is invalid:');
    for (const key of invalidKeys) expect(run).toThrow(`- ${key}:`);
  });

  it('never echoes configured secret or database credential values in the error', () => {
    let message = '';
    try {
      validateRuntimeEnv({ NODE_ENV: 'production', DATABASE_URL: hostedDatabaseUrl, PRISM_SESSION_SECRET: 'short-but-secret' });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('PRISM_SESSION_SECRET');
    expect(message).not.toMatch(/short-but-secret|password@/);
  });

  it('lets unit tests boot modules without database or secret configuration', () => {
    expect(validateRuntimeEnv({ NODE_ENV: 'test' })).toEqual({ NODE_ENV: 'test' });
  });
});
