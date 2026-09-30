import { describe, expect, it, vi } from 'vitest';
import { AuthOperationsService } from './auth-operations.service';

describe('AuthOperationsService', () => {
  it('rejects legacy approval requests that carry no explicit consent evidence', async () => {
    const service = Object.create(AuthOperationsService.prototype) as AuthOperationsService;

    await expect(service.requestApproval('ana@example.test')).rejects.toThrow(
      'Privacy consent is required before requesting account approval',
    );
  });

  it('does not grant a PMCM admin session after password verification alone', async () => {
    const user = {
      id: 'usr_pmcm',
      name: 'Ms. Mys',
      email: 'mys@pmcm.test',
      password: 'prism-admin',
      role: 'pmcm-admin',
      organization: 'PMCM Events',
      approvalStatus: 'approved',
      permanentLockout: false,
      lockedUntil: null,
      failedLoginCount: 0,
      lastLoginAt: null,
      twoFactorSecret: 'encrypted-secret',
    };
    const prisma = {
      opsUser: {
        findUnique: vi.fn(async () => user),
        update: vi.fn(async () => user),
      },
    };
    const auditService = {
      recordLoginHistory: vi.fn(async () => undefined),
      recordAuthenticationAudit: vi.fn(async () => undefined),
      handleFailedLogin: vi.fn(async () => undefined),
      handleForbiddenAccess: vi.fn(async () => undefined),
    };
    const inquiriesService = { markPortalInvitationOpenedByEmail: vi.fn(async () => undefined) };
    const authSessionService = {
      issueSession: vi.fn(() => ({ accessToken: 'should-not-be-issued' })),
      issueTwoFactorToken: vi.fn(() => 'two-factor-token'),
    };
    const totpService = {};
    const service = new AuthOperationsService(
      prisma as any,
      auditService as any,
      inquiriesService as any,
      authSessionService as any,
      totpService as any,
    );

    await expect(service.login('mys@pmcm.test', 'prism-admin')).resolves.toMatchObject({
      kind: 'two_factor_required',
    });
    expect(authSessionService.issueSession).not.toHaveBeenCalled();
  });

  it('still issues a session when the authentication audit chain needs integrity review', async () => {
    const user = {
      id: 'usr_client',
      name: 'Ana Reyes',
      email: 'ana@example.test',
      password: 'prism-client',
      role: 'client',
      organization: 'Ana Events',
      approvalStatus: 'approved',
      permanentLockout: false,
      lockedUntil: null,
      failedLoginCount: 0,
      lastLoginAt: null,
      twoFactorSecret: null,
      sessionVersion: 0,
    };
    const prisma = {
      opsUser: {
        findUnique: vi.fn(async () => user),
        update: vi.fn(async () => user),
      },
    };
    const authAudit = {
      recordLoginHistory: vi.fn(async () => undefined),
      recordAuthenticationAudit: vi.fn(async () => undefined),
      handleFailedLogin: vi.fn(async () => undefined),
      handleForbiddenAccess: vi.fn(async () => undefined),
    };
    const inquiriesService = { markPortalInvitationOpenedByEmail: vi.fn(async () => undefined) };
    const authSessionService = {
      issueSession: vi.fn(() => ({ accessToken: 'client-session' })),
      issueTwoFactorToken: vi.fn(),
    };
    const service = new AuthOperationsService(
      prisma as any,
      authAudit as any,
      inquiriesService as any,
      authSessionService as any,
      {} as any,
    );

    await expect(service.login('ana@example.test', 'prism-client')).resolves.toMatchObject({ accessToken: 'client-session' });
    expect(authAudit.recordAuthenticationAudit).toHaveBeenCalledWith(expect.objectContaining({
      actor: 'Ana Reyes',
      action: 'Signed in to client portal',
    }));
    expect(authSessionService.issueSession).toHaveBeenCalledTimes(1);
  });

  it('still completes a two-factor sign-in when the authentication audit chain needs integrity review', async () => {
    const user = {
      id: 'usr_pmcm',
      name: 'Ms. Mys',
      email: 'mys@pmcm.test',
      password: 'hashed-password',
      role: 'pmcm-admin',
      organization: 'PMCM Events',
      approvalStatus: 'approved',
      permanentLockout: false,
      lockedUntil: null,
      failedLoginCount: 0,
      lastLoginAt: null,
      twoFactorSecret: 'encrypted-secret',
      sessionVersion: 0,
    };
    const prisma = {
      opsUser: {
        findUnique: vi.fn(async () => user),
        update: vi.fn(async () => user),
      },
    };
    const authAudit = {
      recordLoginHistory: vi.fn(async () => undefined),
      recordAuthenticationAudit: vi.fn(async () => undefined),
      handleFailedLogin: vi.fn(async () => undefined),
      handleForbiddenAccess: vi.fn(async () => undefined),
    };
    const authSessionService = {
      verifyTwoFactorToken: vi.fn(() => ({ userId: user.id, email: user.email, role: 'pmcm-admin', purpose: 'challenge' })),
      issueSession: vi.fn(() => ({ accessToken: 'pmcm-session' })),
    };
    const totpService = {
      decryptSecret: vi.fn(() => 'totp-secret'),
      verifyCode: vi.fn(() => true),
    };
    const service = new AuthOperationsService(
      prisma as any,
      authAudit as any,
      {} as any,
      authSessionService as any,
      totpService as any,
    );

    await expect(service.verifyTwoFactor('two-factor-token', '123456')).resolves.toMatchObject({ accessToken: 'pmcm-session' });
    expect(authAudit.recordAuthenticationAudit).toHaveBeenCalledWith(expect.objectContaining({
      actor: 'Ms. Mys',
      action: 'Signed in to pmcm-admin portal',
    }));
    expect(authSessionService.issueSession).toHaveBeenCalledTimes(1);
  });

  it('does not issue a session when the authentication integrity incident cannot be recorded', async () => {
    const user = {
      id: 'usr_client',
      name: 'Ana Reyes',
      email: 'ana@example.test',
      password: 'prism-client',
      role: 'client',
      organization: 'Ana Events',
      approvalStatus: 'approved',
      permanentLockout: false,
      lockedUntil: null,
      failedLoginCount: 0,
      lastLoginAt: null,
      twoFactorSecret: null,
      sessionVersion: 0,
    };
    const prisma = {
      opsUser: {
        findUnique: vi.fn(async () => user),
        update: vi.fn(async () => user),
      },
    };
    const authAudit = {
      recordLoginHistory: vi.fn(async () => undefined),
      recordAuthenticationAudit: vi.fn(async () => { throw new Error('audit incident unavailable'); }),
      handleFailedLogin: vi.fn(async () => undefined),
      handleForbiddenAccess: vi.fn(async () => undefined),
    };
    const authSessionService = {
      issueSession: vi.fn(() => ({ accessToken: 'should-not-be-issued' })),
      issueTwoFactorToken: vi.fn(),
    };
    const service = new AuthOperationsService(
      prisma as any,
      authAudit as any,
      {} as any,
      authSessionService as any,
      {} as any,
    );

    await expect(service.login('ana@example.test', 'prism-client')).rejects.toThrow('audit incident unavailable');
    expect(authSessionService.issueSession).not.toHaveBeenCalled();
  });
});
