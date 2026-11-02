import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertBrowserDatabase, browserEnvironment, restoredNextFile } from './run.mjs';
import { assertPageCoverageComplete, validatedPageCoverageCases } from './page-coverage-report.mjs';
import { browserTimings } from './timings.mjs';
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

test('route coverage rejects missing templates and unresolved parameters without dropping overlapping routes', () => {
  const home = { template: '/dashboard', path: '/dashboard', state: 'ready' };
  const detail = { template: '/dashboard/[section]', path: '/dashboard', state: 'ready' };
  assert.deepEqual(validatedPageCoverageCases([home.template, detail.template], [home, home, detail]), [home, detail]);
  assert.throws(() => validatedPageCoverageCases(['/dashboard', '/new-page'], [home]), /Uncovered page templates: \/new-page/);
  assert.throws(() => validatedPageCoverageCases(['/events/[eventId]/[unknown]'], [{ template: '/events/[eventId]/[unknown]', path: '/events/evt_test/[unknown]' }]), /Unresolved route/);
});

test('completed page coverage requires a passing record for each expected route', () => {
  const cases = [{ template: '/one', path: '/one' }, { template: '/two/[id]', path: '/two/first' }, { template: '/two/[id]', path: '/two/second' }];
  const records = cases.map(item => ({ ...item, result: 'passed' }));
  assert.doesNotThrow(() => assertPageCoverageComplete(cases, records));
  assert.throws(() => assertPageCoverageComplete(cases, records.slice(0, 2)), /did not pass 1 expected routes/);
  assert.throws(() => assertPageCoverageComplete(cases, [records[0], { ...records[1], result: 'failed' }, records[2]]), /did not pass 1 expected routes/);
});

test('phase timing records success and failure while preserving results and keeping exception details private', async () => {
  const ticks = [10, 23, 40, 65];
  const messages = [];
  const timings = browserTimings({ now: () => ticks.shift(), log: value => messages.push(value) });
  assert.equal(await timings.measure('migrate', async () => 'done'), 'done');
  const secretError = new Error('private credential value');
  await assert.rejects(timings.measure('seed', async () => { throw secretError; }), error => error === secretError);
  assert.deepEqual(timings.phases, [{ phase: 'migrate', durationMs: 13, status: 'passed' }, { phase: 'seed', durationMs: 25, status: 'failed' }]);
  assert.deepEqual(messages, ['Browser timing migrate: 13ms (passed)', 'Browser timing seed: 25ms (failed)']);
});
