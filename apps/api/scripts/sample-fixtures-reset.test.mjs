import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEV_RESET_KEY_HEADER,
  SAMPLE_DISPOSABLE_DATABASE,
  resetSampleFixtures,
} from './sample-fixtures-reset.mjs';

const CONFIRMATION = ['--confirm-disposable-db', SAMPLE_DISPOSABLE_DATABASE];

describe('sample fixture reset command', () => {
  it('requires the exact disposable database confirmation before making a request', async () => {
    let requests = 0;

    await assert.rejects(
      resetSampleFixtures({
        args: ['--confirm-disposable-db', 'postgres'],
        env: { PRISM_DEV_RESET_KEY: 'secret' },
        fetchImpl: async () => {
          requests += 1;
          return new Response('{}');
        },
      }),
      /Confirm the target/,
    );

    assert.equal(requests, 0);
  });

  it('refuses non-loopback API URLs before making a request', async () => {
    let requests = 0;

    await assert.rejects(
      resetSampleFixtures({
        args: CONFIRMATION,
        env: { PRISM_API_URL: 'https://api.example.com', PRISM_DEV_RESET_KEY: 'secret' },
        fetchImpl: async () => {
          requests += 1;
          return new Response('{}');
        },
      }),
      /loopback/,
    );

    assert.equal(requests, 0);
  });

  it('requires the configured local reset key before making a request', async () => {
    let requests = 0;

    await assert.rejects(
      resetSampleFixtures({
        args: CONFIRMATION,
        env: { PRISM_API_URL: 'http://127.0.0.1:4000' },
        fetchImpl: async () => {
          requests += 1;
          return new Response('{}');
        },
      }),
      /PRISM_DEV_RESET_KEY/,
    );

    assert.equal(requests, 0);
  });

  it('sends the reset key only to a loopback API endpoint after confirmation', async () => {
    const requests = [];

    await resetSampleFixtures({
      args: CONFIRMATION,
      env: { PRISM_API_URL: 'http://localhost:4000/', PRISM_DEV_RESET_KEY: 'local-secret' },
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response('{}', { status: 200 });
      },
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'http://localhost:4000/api/sample/reset');
    assert.equal(requests[0].init.method, 'POST');
    assert.equal(requests[0].init.headers[DEV_RESET_KEY_HEADER], 'local-secret');
  });

  it('does not print or include an API error body in its failure message', async () => {
    await assert.rejects(
      resetSampleFixtures({
        args: CONFIRMATION,
        env: { PRISM_API_URL: 'http://localhost:4000', PRISM_DEV_RESET_KEY: 'secret' },
        fetchImpl: async () => new Response('sensitive database detail', { status: 403 }),
      }),
      (error) => {
        assert.match(error.message, /HTTP 403/);
        assert.doesNotMatch(error.message, /sensitive database detail/);
        return true;
      },
    );
  });
});
