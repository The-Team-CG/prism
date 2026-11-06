import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertBrowserDatabase, browserEnvironment, restoredNextFile } from './run.mjs';
import { assertPageCoverageComplete, validatedPageCoverageCases } from './page-coverage-report.mjs';
import { browserTimings } from './timings.mjs';
import { browserExecution, browserJobMatrix, browserTimingScope, portalEnvironment } from './execution.mjs';

test('production portals keep fixture URLs and API settings while enabling the real production server', () => {
  const env = browserEnvironment('postgresql://user@localhost/prism_browser_012345abcdef', '/tmp/test');
  const portals = portalEnvironment({ ...env, PRISM_VERCEL_SERVICES: '1', PRISM_DOCKER_STANDALONE: '1' }, 'production');
  assert.equal(portals.NODE_ENV, 'production');
  assert.equal(env.NODE_ENV, 'development', 'Fixture preparation and API retain their established environment.');
  assert.equal(portals.NEXT_PUBLIC_PRISM_API_BASE_URL, env.NEXT_PUBLIC_PRISM_API_BASE_URL);
  assert.equal(portals.PRISM_NEXT_DIST_DIR, '.next-acceptance');
  assert.equal(portals.PRISM_VERCEL_SERVICES, '');
  assert.equal(portals.PRISM_DOCKER_STANDALONE, '');
  assert.deepEqual(browserExecution(['--server=development', '--project=desktop', '--skip-build']),
    { server: 'development', playwrightArgs: ['--project=desktop'], buildApi: false });
  assert.throws(() => browserExecution(['--server=invalid']), /server mode/);
  assert.throws(() => browserExecution(['--server=production', '--skip-build']), /always builds/);
  assert.throws(() => browserExecution(['--server=production', '--server=development']), /one browser server/);
});

test('comparison jobs run complete desktop and mobile projects for each mode and sample', () => {
  const matrix = browserJobMatrix({ server: 'compare', repetitions: 5 }).include;
  assert.equal(matrix.length, 20);
  for (let sample = 1; sample <= 5; sample += 1) {
    for (const server of ['production', 'development']) {
      assert.deepEqual(matrix.filter(job => job.sample === sample && job.server === server).map(job => job.project).sort(), ['desktop', 'mobile']);
    }
  }
  assert.deepEqual(browserJobMatrix().include.map(job => job.project), ['desktop', 'mobile']);
  assert.equal(matrix[0].server, 'development');
  assert.equal(matrix[4].server, 'production');
  for (const input of [{ server: 'invalid' }, { repetitions: 0 }, { repetitions: 6 }, { repetitions: 1.5 }]) assert.throws(() => browserJobMatrix(input), /supported browser mode/);
});

test('timing samples distinguish complete project runs from filtered or combined local runs', () => {
  assert.deepEqual(browserTimingScope(['--project=desktop'], '3'), { project: 'desktop', sample: 3, completeSuite: true });
  assert.deepEqual(browserTimingScope(['--project', 'mobile']), { project: 'mobile', sample: 1, completeSuite: true });
  assert.equal(browserTimingScope(['--project=desktop', '--grep', 'one journey']).completeSuite, false);
  assert.equal(browserTimingScope(['--project=unknown']).completeSuite, false);
  assert.equal(browserTimingScope([]).project, 'all');
  assert.throws(() => browserTimingScope([], '0'), /Invalid browser comparison sample/);
});
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
