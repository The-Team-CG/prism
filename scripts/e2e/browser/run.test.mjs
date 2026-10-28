import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertBrowserDatabase, browserEnvironment } from './run.mjs';
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
