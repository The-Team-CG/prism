import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AuthSessionService } from './auth-session.service';

function createService(overrides: Record<string, string | undefined> = {}) {
  return new AuthSessionService({
    get: (key: string) => overrides[key] ?? ({ PRISM_SESSION_SECRET: 'test-secret' } as Record<string, string>)[key],
  } as any);
}

describe('AuthSessionService', () => {
  it('issues and verifies signed session tokens', () => {
    const service = createService();
    const session = service.issueSession({
      id: 'user_pmcm',
      name: 'Ms. Mys',
      email: 'mys@pmcm.test',
      role: 'pmcm-admin',
      organization: 'PMCM',
      approvalStatus: 'approved',
    });

    expect(session).toMatchObject({
      id: 'user_pmcm',
      accessToken: expect.any(String),
      expiresAt: expect.any(String),
      signedInAt: expect.any(String),
      tokenType: 'Bearer',
    });
    expect(service.verifyAccessToken(session.accessToken)).toMatchObject({
      actorId: 'user_pmcm',
      actorRole: 'pmcm-admin',
      actorEmail: 'mys@pmcm.test',
      actorName: 'Ms. Mys',
    });
  });

  it('rejects tampered session tokens', () => {
    const service = createService();
    const session = service.issueSession({
      id: 'user_pmcm',
      name: 'Ms. Mys',
      email: 'mys@pmcm.test',
      role: 'pmcm-admin',
      organization: 'PMCM',
      approvalStatus: 'approved',
    });

    expect(() => service.verifyAccessToken(`${session.accessToken}x`)).toThrow(UnauthorizedException);
  });

  it('issues scoped, short-lived PMCM Admin two-factor tokens', () => {
    const service = createService();
    const token = service.issueTwoFactorToken(
      { userId: 'user_pmcm', email: 'mys@pmcm.test', role: 'pmcm-admin', challengeId: 'c'.repeat(43), sessionVersion: 7 },
      'challenge',
    );

    expect(service.verifyTwoFactorToken(token)).toEqual({
      userId: 'user_pmcm',
      email: 'mys@pmcm.test',
      role: 'pmcm-admin',
      purpose: 'challenge',
      challengeId: 'c'.repeat(43),
      sessionVersion: 7,
    });
  });

  it.each(['development', 'staging', 'production', undefined])(
    'refuses to sign sessions without a configured secret outside unit tests (NODE_ENV=%s)',
    (nodeEnv) => {
      const previousNodeEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      try {
        const service = createService({ NODE_ENV: nodeEnv, PRISM_SESSION_SECRET: 'too-short' });
        expect(() =>
          service.issueSession({
            id: 'user_pmcm',
            name: 'Ms. Mys',
            email: 'mys@pmcm.test',
            role: 'pmcm-admin',
            organization: 'PMCM',
            approvalStatus: 'approved',
          }),
        ).toThrow('PRISM_SESSION_SECRET or JWT_SECRET must be configured with at least 32 characters');
      } finally {
        process.env.NODE_ENV = previousNodeEnv;
      }
    },
  );
});
