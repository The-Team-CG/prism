import { describe, expect, it, vi } from 'vitest';
import { AuthOperationsService } from './auth-operations.service';

describe('AuthOperationsService', () => {
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
      write: vi.fn(async () => undefined),
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
});
