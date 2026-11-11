import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyResendWebhook } from './resend-webhook-signature';

const key = Buffer.from('a-test-signing-key-of-some-length');
const secret = `whsec_${key.toString('base64')}`;
const now = new Date('2026-11-11T10:00:00.000Z');
const body = Buffer.from('{"type":"email.delivered","data":{"email_id":"abc"}}');
const sign = (id: string, timestamp: string, payload = body, signingKey = key) =>
  `v1,${createHmac('sha256', signingKey).update(`${id}.${timestamp}.`).update(payload).digest('base64')}`;
const stamp = String(Math.floor(now.getTime() / 1000));

describe('verifyResendWebhook', () => {
  it('accepts a correctly signed, fresh request, including during secret rotation', () => {
    expect(verifyResendWebhook(secret, body, { id: 'msg_1', timestamp: stamp, signature: sign('msg_1', stamp) }, now)).toBe(true);
    expect(verifyResendWebhook(secret, body, { id: 'msg_1', timestamp: stamp, signature: `v1,${Buffer.from('old').toString('base64')} ${sign('msg_1', stamp)}` }, now)).toBe(true);
  });

  it('refuses a changed body, another id, the wrong key, a stale or malformed timestamp, and missing headers', () => {
    const good = sign('msg_1', stamp);
    expect(verifyResendWebhook(secret, Buffer.from('{"type":"email.bounced","data":{"email_id":"abc"}}'), { id: 'msg_1', timestamp: stamp, signature: good }, now)).toBe(false);
    expect(verifyResendWebhook(secret, body, { id: 'msg_2', timestamp: stamp, signature: good }, now)).toBe(false);
    expect(verifyResendWebhook(secret, body, { id: 'msg_1', timestamp: stamp, signature: sign('msg_1', stamp, body, Buffer.from('another-key')) }, now)).toBe(false);
    const old = String(Number(stamp) - 6 * 60);
    expect(verifyResendWebhook(secret, body, { id: 'msg_1', timestamp: old, signature: sign('msg_1', old) }, now)).toBe(false);
    expect(verifyResendWebhook(secret, body, { id: 'msg_1', timestamp: 'later', signature: good }, now)).toBe(false);
    expect(verifyResendWebhook(secret, body, { id: 'msg_1', timestamp: stamp }, now)).toBe(false);
    expect(verifyResendWebhook('not-a-secret', body, { id: 'msg_1', timestamp: stamp, signature: good }, now)).toBe(false);
  });
});
