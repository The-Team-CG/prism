import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SECONDS = 5 * 60;

export interface ResendWebhookHeaders { id?: string; timestamp?: string; signature?: string }

/**
 * Resend signs webhooks with the Svix scheme: HMAC-SHA256 over `id.timestamp.body` using the base64
 * secret that follows `whsec_`, sent as space-separated `v1,<base64>` values (several during rotation).
 * A timestamp outside five minutes is refused, so a captured request cannot be replayed later.
 */
export function verifyResendWebhook(secret: string, rawBody: Buffer, headers: ResendWebhookHeaders, now = new Date()): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !secret.startsWith('whsec_')) return false;
  const sentAt = Number(timestamp);
  if (!Number.isInteger(sentAt) || Math.abs(Math.floor(now.getTime() / 1000) - sentAt) > TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.slice('whsec_'.length), 'base64');
  if (key.length === 0) return false;
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.`).update(rawBody).digest();
  return signature.split(' ').some((part) => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    const given = Buffer.from(value, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
