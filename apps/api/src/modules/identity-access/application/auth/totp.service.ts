import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

function base32Encode(value: Buffer) {
  let bits = 0;
  let buffer = 0;
  let result = '';

  for (const byte of value) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  return result;
}

function base32Decode(value: string) {
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];

  for (const character of value.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid TOTP secret');
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function safeCodeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

@Injectable()
export class TotpService {
  constructor(private readonly configService: ConfigService) {}

  generateSecret() {
    return base32Encode(randomBytes(20));
  }

  verifyCode(secret: string, candidate: string, nowMs = Date.now()) {
    if (!/^\d{6}$/.test(candidate)) return false;
    const currentCounter = Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
    return [-1, 0, 1].some((offset) => safeCodeEqual(this.codeAt(secret, currentCounter + offset), candidate));
  }

  encryptSecret(secret: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.');
  }

  decryptSecret(value: string) {
    const [ivEncoded, tagEncoded, ciphertextEncoded] = value.split('.');
    if (!ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error('Invalid encrypted TOTP secret');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(ivEncoded, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  otpauthUri(secret: string, email: string) {
    const issuer = 'P.R.I.S.M';
    const label = encodeURIComponent(`${issuer}:${email}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
  }

  private codeAt(secret: string, counter: number) {
    if (counter < 0) return '';
    const key = base32Decode(secret);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', key).update(counterBuffer).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = ((digest[offset] & 0x7f) << 24)
      | ((digest[offset + 1] & 0xff) << 16)
      | ((digest[offset + 2] & 0xff) << 8)
      | (digest[offset + 3] & 0xff);
    return String(binary % 1_000_000).padStart(TOTP_DIGITS, '0');
  }

  private encryptionKey() {
    const configured = this.configService.get<string>('PRISM_SESSION_SECRET') ?? this.configService.get<string>('JWT_SECRET');
    if (!configured || configured.length < 32) {
      throw new Error('PRISM_SESSION_SECRET or JWT_SECRET must be configured with at least 32 characters');
    }
    return createHash('sha256').update(configured).digest();
  }
}
