import * as passwordHash from './password-hash.cjs';

/**
 * Operator password hashing. Stored values must be in the current scrypt format
 * (see password-hash.cjs); anything else fails verification.
 */
export class AuthSecurityService {
  static hashPassword(password: string): Promise<string> {
    return passwordHash.hashScryptPassword(password);
  }

  static verifyPassword(storedPassword: string, candidatePassword: string): Promise<boolean> {
    return passwordHash.verifyScryptPassword(storedPassword, candidatePassword);
  }

  static needsRehash(storedPassword: string): boolean {
    return !passwordHash.isCurrentScryptPasswordHash(storedPassword);
  }
}
