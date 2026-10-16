import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';

const ENVELOPE_VERSION = 'v1';
const PAYLOAD_HASH_CONTEXT = Buffer.from('prism-guest-pass-notification-payload-hash-v1');
export const GUEST_PASS_MESSAGE_PLACEHOLDER = '[Guest pass delivery]';

export function parseGuestPassEncryptionKey(value: unknown): Buffer | undefined {
  if (typeof value !== 'string') return undefined;
  const encoded = value.trim();
  if (!encoded) return undefined;

  const key = decodeCanonicalBase64(encoded);
  return key?.length === 32 ? key : undefined;
}

export function encryptGuestPassPayload(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    ENVELOPE_VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

export function decryptGuestPassPayload(envelope: string, key: Buffer): string {
  const [version, encodedIv, encodedTag, encodedCiphertext, ...extra] = envelope.split('.');
  const iv = decodeCanonicalBase64(encodedIv ?? '');
  const authTag = decodeCanonicalBase64(encodedTag ?? '');
  const ciphertext = decodeCanonicalBase64(encodedCiphertext ?? '');
  if (version !== ENVELOPE_VERSION || extra.length > 0 || iv?.length !== 12 || authTag?.length !== 16 || !ciphertext) {
    throw new Error('Invalid guest pass delivery payload');
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Invalid guest pass delivery payload');
  }
}

export function guestPassPayloadHash(fields: readonly string[], key: Buffer): string {
  const derivedKey = Buffer.from(hkdfSync('sha256', key, Buffer.alloc(0), PAYLOAD_HASH_CONTEXT, 32));
  return createHmac('sha256', derivedKey).update(JSON.stringify(fields)).digest('hex');
}

function decodeCanonicalBase64(value: string): Buffer | undefined {
  if (!value || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return undefined;
  const decoded = Buffer.from(value, 'base64');
  return decoded.toString('base64') === value ? decoded : undefined;
}
