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

    expect(service.acceptedStep('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', null, 59_000)).toBe(1);
    expect(service.acceptedStep('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287083', null, 59_000)).toBeNull();
  });

  it('refuses a code from a step already accepted, or an earlier one, while it is still inside the window', () => {
    const service = createService();

    expect(service.acceptedStep('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 0, 59_000)).toBe(1);
    expect(service.acceptedStep('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 1, 59_000)).toBeNull();
    expect(service.acceptedStep('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 2, 59_000)).toBeNull();
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
