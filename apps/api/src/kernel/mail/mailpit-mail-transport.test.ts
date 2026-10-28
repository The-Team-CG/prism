import { afterEach, describe, expect, it, vi } from 'vitest';
import { MailpitMailTransport } from './mailpit-mail-transport';

const message = { idempotencyKey: 'local_123', to: 'ana@example.test', subject: 'Activate your account', text: 'Follow the link', html: '<p>Follow the link</p>' };
describe('MailpitMailTransport', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('captures the recipient, HTML, text and correlation key locally without provider authorization', async () => {
    const send = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ ID: 'captured-id' }));
    vi.stubGlobal('fetch', send);
    await expect(new MailpitMailTransport('http://127.0.0.1:54324').send(message)).resolves.toEqual({ status: 'accepted', receipt: 'mailpit:captured-id' });
    const [url, init] = send.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:54324/api/v1/send');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toMatchObject({ To: [{ Email: message.to }], Subject: message.subject, Text: message.text, HTML: message.html, Headers: { 'X-Prism-Idempotency-Key': message.idempotencyKey } });
  });
  it.each([408, 429, 500, 503])('keeps HTTP %i available for outbox retry', async status => {
    vi.stubGlobal('fetch', async () => new Response('', { status }));
    await expect(new MailpitMailTransport('http://localhost:54324').send(message)).resolves.toEqual({ status: 'retryable_failure' });
  });
  it('refuses malformed acceptance and preserves the retry when the inbox is unavailable', async () => {
    const transport = new MailpitMailTransport('http://localhost:54324');
    vi.stubGlobal('fetch', async () => Response.json({}));
    await expect(transport.send(message)).resolves.toEqual({ status: 'retryable_failure' });
    vi.stubGlobal('fetch', async () => { throw new TypeError('offline'); });
    await expect(transport.send(message)).resolves.toEqual({ status: 'retryable_failure' });
    vi.stubGlobal('fetch', async () => new Response('', { status: 400 }));
    await expect(transport.send(message)).resolves.toEqual({ status: 'permanent_failure' });
  });
});
