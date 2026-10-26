import { randomBytes, scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AuthSecurityService } from './auth-security.service';
import * as passwordHash from './password-hash.cjs';

describe('AuthSecurityService password hashes', () => {
  it('stores its parameters in every hash and verifies only the matching password', async () => {
    const stored = await AuthSecurityService.hashPassword('correct horse battery');

    expect(stored).toMatch(/^scrypt\$N=16384,r=8,p=5\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(passwordHash.isCurrentScryptPasswordHash(stored)).toBe(true);
    expect(await AuthSecurityService.verifyPassword(stored, 'correct horse battery')).toBe(true);
    expect(await AuthSecurityService.verifyPassword(stored, 'correct horse batterY')).toBe(false);
    expect(AuthSecurityService.needsRehash(stored)).toBe(false);
  });

  it('asks for a rehash when a stored hash uses lower parameters than the current target', () => {
    const salt = randomBytes(16).toString('hex');
    const lowerParams = { N: 16384, r: 8, p: 1 };
    const stored = passwordHash.formatScryptPasswordHash({
      params: lowerParams,
      salt,
      derivedHex: scryptSync('pw', salt, 64, lowerParams).toString('hex'),
    });

    expect(AuthSecurityService.needsRehash(stored)).toBe(true);
  });

  it('fails verification for a value that is not in the hash format', async () => {
    expect(await AuthSecurityService.verifyPassword('plain-text-value', 'plain-text-value')).toBe(false);
    expect(await AuthSecurityService.verifyPassword('scrypt$N=3,r=8,p=1$' + 'a'.repeat(32) + '$' + 'b'.repeat(128), 'x')).toBe(false);
  });
});
