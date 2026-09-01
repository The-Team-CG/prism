import { describe, expect, it } from 'vitest';
import { TotpService } from './totp.service';

function createService() {
  return new TotpService({
    get: (key: string) => (key === 'PRISM_SESSION_SECRET' ? 'test-session-secret-that-is-long-enough' : undefined),
  } as any);
}

describe('TotpService', () => {
  it('verifies the RFC 6238 SHA-1 vector using a six-digit code', () => {
    const service = createService();

    expect(service.verifyCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59_000)).toBe(true);
    expect(service.verifyCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287083', 59_000)).toBe(false);
  });

  it('generates encrypted secrets that can be recovered for verification', () => {
    const service = createService();
    const secret = service.generateSecret();
    const encrypted = service.encryptSecret(secret);

    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(encrypted).not.toContain(secret);
    expect(service.decryptSecret(encrypted)).toBe(secret);
  });
});
