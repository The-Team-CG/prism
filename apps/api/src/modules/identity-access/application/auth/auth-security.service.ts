import * as passwordHash from './password-hash.cjs';

// Fixed hash, never a real credential. Checked when there is no stored password, so a missing password costs the same as a wrong one.
const NO_PASSWORD_HASH = 'scrypt$N=16384,r=8,p=5$30682f972917c5edd26dd7ffa09a889f$2c8426bd4d95f3db93469835fa24b81e8b7e90cfec405aee66d74dc8e6f97338c42462cb7ef67fab5417043759938bffeb348ea970c11ddc66219acb8d0afc03';

/**
 * Operator password hashing. Stored values must be in the current scrypt format
 * (see password-hash.cjs); anything else fails verification.
 */
export class AuthSecurityService {
  static hashPassword(password: string): Promise<string> {
    return passwordHash.hashScryptPassword(password);
  }

  /**
   * A null stored password means no credential exists yet (an invited account not yet activated, or an unknown email).
   * It never matches, and it runs the same hashing work as a real comparison.
   */
  static async verifyPassword(storedPassword: string | null, candidatePassword: string): Promise<boolean> {
    if (storedPassword === null) {
      await passwordHash.verifyScryptPassword(NO_PASSWORD_HASH, candidatePassword);
      return false;
    }
    return passwordHash.verifyScryptPassword(storedPassword, candidatePassword);
  }

  static needsRehash(storedPassword: string | null): boolean {
    return storedPassword !== null && !passwordHash.isCurrentScryptPasswordHash(storedPassword);
  }
}
