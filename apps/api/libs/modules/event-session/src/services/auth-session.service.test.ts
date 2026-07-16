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
});
