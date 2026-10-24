import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AuthSessionService } from './auth-session.service';

const SESSION_SECRET = 'auth-session-test-secret-at-least-32-chars';
const SESSION_CONFIG: Record<string, string | undefined> = {
  PRISM_SESSION_SECRET: SESSION_SECRET,
  PRISM_SESSION_TTL_SECONDS: '28800',
};

function createService(config: Record<string, string | undefined> = SESSION_CONFIG) {
  return new AuthSessionService({
    get: (key: string) => config[key],
  } as never);
}

const pmcmSession = {
  id: 'user_pmcm',
  name: 'Ms. Mys',
  email: 'mys@pmcm.test',
  role: 'pmcm-admin',
  organization: 'PMCM',
  approvalStatus: 'approved',
} as const;

describe('AuthSessionService', () => {
  it('issues and verifies signed session tokens', () => {
    const service = createService();
    const session = service.issueSession({ ...pmcmSession });

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
    const session = service.issueSession({ ...pmcmSession });

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

  it('applies the general lifetime, with a per-role override when one is configured', () => {
    const issuedAt = new Date('2026-10-25T00:00:00.000Z');
    const service = createService({ ...SESSION_CONFIG, PRISM_SESSION_TTL_SECONDS_CLIENT: '600' });

    const client = service.issueSession({ ...pmcmSession, role: 'client' }, issuedAt);
    const admin = service.issueSession({ ...pmcmSession }, issuedAt);

    expect(Date.parse(client.expiresAt) - issuedAt.getTime()).toBe(600_000);
    expect(Date.parse(admin.expiresAt) - issuedAt.getTime()).toBe(28_800_000);
  });

  it.each([
    ['a missing session secret', { PRISM_SESSION_TTL_SECONDS: '28800', JWT_SECRET: SESSION_SECRET }, /PRISM_SESSION_SECRET must be configured/],
    ['a session secret that is too short', { PRISM_SESSION_SECRET: 'too-short', PRISM_SESSION_TTL_SECONDS: '28800' }, /PRISM_SESSION_SECRET must be configured/],
    ['a missing lifetime', { PRISM_SESSION_SECRET: SESSION_SECRET }, /PRISM_SESSION_TTL_SECONDS must be set/],
    ['a non-positive lifetime', { PRISM_SESSION_SECRET: SESSION_SECRET, PRISM_SESSION_TTL_SECONDS: '0' }, /PRISM_SESSION_TTL_SECONDS must be set/],
  ])('refuses to issue a session with %s instead of substituting a default', (_label, config, message) => {
    const service = createService(config);

    expect(() => service.issueSession({ ...pmcmSession })).toThrow(message);
  });
});
