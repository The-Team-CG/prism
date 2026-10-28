import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertBrowserDatabase, browserEnvironment, restoredNextFile } from './run.mjs';
test('browser setup refuses hosted and normal databases before preparing a test runtime', () => {
  assert.throws(() => assertBrowserDatabase('postgresql://user@hosted.example/postgres'), /loopback/);
  assert.throws(() => assertBrowserDatabase('postgresql://user@localhost/postgres?host=hosted.example'), /query overrides/);
  assert.throws(() => browserEnvironment('postgresql://user@localhost/postgres', '/tmp/test'), /newly created/);
  const env = browserEnvironment('postgresql://user@localhost/prism_browser_012345abcdef', '/tmp/test');
  assert.equal(env.PRISM_MAIL_TRANSPORT, 'mailpit');
  assert.equal(env.RESEND_API_KEY, '');
  assert.equal(env.DIRECT_URL, '');
  assert.equal(env.PORT, '4300');
  assert.equal(env.NEXT_PUBLIC_CLIENT_PORTAL_URL, 'http://127.0.0.1:3301');
});

test('acceptance runs restore only the portal file rewrites made by next dev', () => {
  const env = 'import "./.next/dev/types/routes.d.ts"; import "./.next/dev/types/root-params.d.ts";';
  assert.equal(restoredNextFile('next-env.d.ts', env, env.replaceAll('./.next/', './.next-acceptance/')), env);
  assert.equal(restoredNextFile('next-env.d.ts', env, env), null);
  const buildEnv = env.replaceAll('./.next/dev/', './.next/');
  assert.equal(restoredNextFile('next-env.d.ts', buildEnv, env.replaceAll('./.next/', './.next-acceptance/')), buildEnv);
  assert.equal(restoredNextFile('next-env.d.ts', env, `${env}// developer edit`), null);
  const tsconfig = JSON.stringify({ compilerOptions: {}, include: ['**/*.ts', '.next/dev/types/**/*.ts'] }, null, 2);
  const rewritten = JSON.stringify({ compilerOptions: {}, include: ['**/*.ts', '.next/dev/types/**/*.ts', '.next-acceptance/dev/types/**/*.ts'] });
  assert.equal(restoredNextFile('tsconfig.json', tsconfig, rewritten), tsconfig);
  assert.equal(restoredNextFile('tsconfig.json', tsconfig, JSON.stringify({ compilerOptions: { strict: true }, include: ['**/*.ts'] })), null);
});
