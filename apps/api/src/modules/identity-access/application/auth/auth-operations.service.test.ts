import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { AuditWriteInput, ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AuthSessionService, EventSessionGuard } from '@prism/kernel/event-session';
import { AuthOperationsService } from './auth-operations.service';

function createApprovalService(options: { requestUpdateFails?: boolean; auditFails?: boolean } = {}) {
  const state = {
    request: {
      id: 'approval_1',
      userId: 'user_client_1',
      name: 'Ana Reyes',
      email: 'ana@example.test',
      role: 'client',
      organization: 'Ana Events',
      status: 'pending',
      requestedAt: new Date('2026-08-01T00:00:00.000Z'),
      privacyConsentAccepted: true,
      privacyNoticeVersion: '2026-05-01',
      marketingConsentAccepted: false,
    },
    user: {
      id: 'user_client_1',
      name: 'Ana Reyes',
      email: 'ana@example.test',
      password: 'hashed-password',
      role: 'client',
      organization: 'Ana Events',
      approvalStatus: 'pending',
      sessionVersion: 0,
      lockedUntil: null,
      permanentLockout: false,
      failedLoginCount: 0,
    },
  };
  const opsApprovalRequest = {
    findUnique: vi.fn(async () => ({ ...state.request })),
    update: vi.fn(async ({ data }: { data: { status: string } }) => {
      if (options.requestUpdateFails) throw new Error('approval request update failed');
      Object.assign(state.request, data);
      return { ...state.request };
    }),
  };
  const opsUser = {
    findUnique: vi.fn(async () => ({ ...state.user })),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const { sessionVersion, ...userChanges } = data;
      Object.assign(state.user, userChanges);
      if (typeof sessionVersion === 'object' && sessionVersion !== null && 'increment' in sessionVersion) {
        state.user.sessionVersion += Number(sessionVersion.increment);
      } else if (typeof sessionVersion === 'number') {
        state.user.sessionVersion = sessionVersion;
      }
      return { ...state.user };
    }),
  };
  const authAudit = {
    write: vi.fn(async (_input: AuditWriteInput, _context?: unknown) => {
      if (options.auditFails) throw new Error('approval audit failed');
    }),
  };
  const transaction = { opsApprovalRequest, opsUser };
  const prisma = {
    ...transaction,
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => {
      const previousRequest = { ...state.request };
      const previousUser = { ...state.user };
      try {
        return await callback(transaction);
      } catch (error) {
        Object.assign(state.request, previousRequest);
        Object.assign(state.user, previousUser);
        throw error;
      }
    }),
  };
  const service = new AuthOperationsService(prisma as any, authAudit as any, {} as any, {} as any, {} as any);
  return { service, prisma, authAudit, state };
}

describe('AuthOperationsService', () => {
  it('rejects legacy approval requests that carry no explicit consent evidence', async () => {
    const service = Object.create(AuthOperationsService.prototype) as AuthOperationsService;

    await expect(service.requestApproval('ana@example.test')).rejects.toThrow(
      'Privacy consent is required before requesting account approval',
    );
  });

  it.each([
    { status: 'approved', method: 'approveApprovalRequest' as const, action: 'Approved account access for ana@example.test' },
    { status: 'declined', method: 'declineApprovalRequest' as const, action: 'Declined account access for ana@example.test' },
  ])('records the verified administrator when an account request is $status', async ({ method, action }) => {
    const { service, authAudit } = createApprovalService();
    const actor = {
      id: 'pmcm_user_1',
      role: OpsUserRole.PmcmAdmin,
      name: 'Anthony Torres',
      email: 'anthony@pmcm.test',
      explicit: true,
      verified: true,
    } satisfies ResolvedEventOpsActor;

    await service[method]('approval_1', actor);

    expect(authAudit.write.mock.calls[0]?.[0]).toMatchObject({
      actor: 'Anthony Torres',
      actorRole: OpsUserRole.PmcmAdmin,
      actorEmail: 'anthony@pmcm.test',
      action,
      metadata: { actorId: 'pmcm_user_1' },
    });
  });

  it('revokes an already-issued signed session when approval is declined', async () => {
    const { service, prisma, state } = createApprovalService();
    const authSessionService = new AuthSessionService(new ConfigService({
      PRISM_SESSION_SECRET: 'account-revocation-test-secret-123456',
    }));
    const oldSession = authSessionService.issueSession({
      id: state.user.id,
      name: state.user.name,
      email: state.user.email,
      role: 'client',
      organization: state.user.organization,
      approvalStatus: 'approved',
      sessionVersion: 0,
    });
    const actor = {
      id: 'pmcm_user_1', role: OpsUserRole.PmcmAdmin, name: 'Anthony Torres', email: 'anthony@pmcm.test',
      explicit: true, verified: true,
    } satisfies ResolvedEventOpsActor;

    await service.declineApprovalRequest('approval_1', actor);

    const guard = new EventSessionGuard(authSessionService, prisma as never);
    await expect(guard.canActivate({
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${oldSession.accessToken}` } }) }),
    } as never)).rejects.toThrow(/revoked|eligible/i);
    expect(state.user).toMatchObject({ approvalStatus: 'declined', sessionVersion: 1 });
    expect(state.request.status).toBe('declined');
  });

  it('replays the same completed decline without incrementing the session version or duplicating audit', async () => {
    const { service, authAudit, state } = createApprovalService();
    const actor = {
      id: 'pmcm_user_1', role: OpsUserRole.PmcmAdmin, name: 'Anthony Torres', email: 'anthony@pmcm.test',
      explicit: true, verified: true,
    } satisfies ResolvedEventOpsActor;

    await service.declineApprovalRequest('approval_1', actor);
    await service.declineApprovalRequest('approval_1', actor);

    expect(state.user.sessionVersion).toBe(1);
    expect(authAudit.write).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['request update', { requestUpdateFails: true }, 'approval request update failed'],
    ['audit write', { auditFails: true }, 'approval audit failed'],
  ])('rolls back the account epoch and request state when the %s fails', async (_label, options, message) => {
    const { service, state } = createApprovalService(options);
    const actor = {
      id: 'pmcm_user_1', role: OpsUserRole.PmcmAdmin, name: 'Anthony Torres', email: 'anthony@pmcm.test',
      explicit: true, verified: true,
    } satisfies ResolvedEventOpsActor;

    await expect(service.declineApprovalRequest('approval_1', actor)).rejects.toThrow(message);
    expect(state.user).toMatchObject({ approvalStatus: 'pending', sessionVersion: 0 });
    expect(state.request.status).toBe('pending');
  });

  it('rejects missing, unverified, or non-admin actors before changing account access', async () => {
    const { service, prisma, authAudit } = createApprovalService();
    const unverifiedAdmin: ResolvedEventOpsActor = {
      id: 'spoofed_admin', role: OpsUserRole.PmcmAdmin, name: 'Spoofed Admin', explicit: true, verified: false,
    };
    const verifiedClient: ResolvedEventOpsActor = {
      id: 'client_1', role: OpsUserRole.Client, name: 'Ana Reyes', explicit: true, verified: true,
    };

    await expect(service.approveApprovalRequest('approval_1', undefined as unknown as ResolvedEventOpsActor))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.approveApprovalRequest('approval_1', unverifiedAdmin))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.declineApprovalRequest('approval_1', verifiedClient))
      .rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.opsApprovalRequest.findUnique).not.toHaveBeenCalled();
    expect(prisma.opsUser.update).not.toHaveBeenCalled();
    expect(authAudit.write).not.toHaveBeenCalled();
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
      verifyTwoFactorToken: vi.fn(() => ({ userId: user.id, email: user.email, role: 'pmcm-admin', purpose: 'challenge', sessionVersion: 0 })),
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
