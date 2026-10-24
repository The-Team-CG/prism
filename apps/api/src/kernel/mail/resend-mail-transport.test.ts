import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResendMailTransport, RESEND_EMAILS_URL } from './resend-mail-transport';

const message = {
  idempotencyKey: 'not_123',
  to: 'ana@example.test',
  subject: 'Reset your P.R.I.S.M password',
  text: 'Open the link.',
  html: '<p>Open the link.</p>',
};

function stubFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function transport() {
  return new ResendMailTransport({ apiKey: 're_secret_key', from: 'P.R.I.S.M <no-reply@example.test>' });
}

describe('ResendMailTransport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the message with the bearer key, the idempotency key and the sender, and reports the provider id', async () => {
    const fetchMock = stubFetch(async () => Response.json({ id: 'email_abc' }, { status: 200 }));

    await expect(transport().send(message)).resolves.toEqual({ status: 'accepted', receipt: 'email_abc' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RESEND_EMAILS_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: 'Bearer re_secret_key',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'not_123',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'P.R.I.S.M <no-reply@example.test>',
      to: ['ana@example.test'],
      subject: 'Reset your P.R.I.S.M password',
      text: 'Open the link.',
      html: '<p>Open the link.</p>',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([408, 429, 500, 503])('treats HTTP %i as retryable', async (status) => {
    stubFetch(async () => new Response('{}', { status }));
    await expect(transport().send(message)).resolves.toEqual({ status: 'retryable_failure' });
  });

  it.each([400, 401, 403, 422])('treats HTTP %i as permanent', async (status) => {
    stubFetch(async () => new Response('{}', { status }));
    await expect(transport().send(message)).resolves.toEqual({ status: 'permanent_failure' });
  });

  it('treats a timeout or network error as retryable', async () => {
    stubFetch(async () => { throw new DOMException('The operation timed out.', 'TimeoutError'); });
    await expect(transport().send(message)).resolves.toEqual({ status: 'retryable_failure' });

    stubFetch(async () => { throw new TypeError('fetch failed'); });
    await expect(transport().send(message)).resolves.toEqual({ status: 'retryable_failure' });
  });

  it('does not report accepted when a 2xx response carries no provider id', async () => {
    stubFetch(async () => Response.json({}, { status: 200 }));
    await expect(transport().send(message)).resolves.toEqual({ status: 'retryable_failure' });
  });
});
