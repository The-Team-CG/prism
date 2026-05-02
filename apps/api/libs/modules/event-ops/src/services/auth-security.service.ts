import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_PREFIX = 'scrypt';
const KEY_LENGTH = 64;

export class AuthSecurityService {
  static hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
    const derived = scryptSync(password, salt, KEY_LENGTH).toString('hex');
    return `${SCRYPT_PREFIX}$${salt}$${derived}`;
  }

  static isHashedPassword(value: string) {
    return value.startsWith(`${SCRYPT_PREFIX}$`);
  }

  static verifyPassword(storedPassword: string, candidatePassword: string) {
    if (!this.isHashedPassword(storedPassword)) {
      return storedPassword === candidatePassword;
    }

    const [, salt, expectedHex] = storedPassword.split('$');
    if (!salt || !expectedHex) return false;
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = scryptSync(candidatePassword, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
