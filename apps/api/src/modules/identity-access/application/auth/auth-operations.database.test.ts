import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { AuditService, SecurityOperationsService } from '@prism/contexts/platform-ops';
import { PrismaService } from '@prism/kernel/database';
import { AuthSessionService, EventSessionGuard } from '@prism/kernel/event-session';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { AuthAuditPort } from '../../contracts/auth-audit.port';
import { AuthAuditAdapter } from '../../infrastructure/auth/auth-audit.adapter';
import { AuthOperationsService } from './auth-operations.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const enabled = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));
if (databaseUrl && !enabled) throw new Error('P0 account-revocation tests require 127.0.0.1:55437/prism_p0');

describe.skipIf(!enabled)('account approval PostgreSQL integrity', () => {
  const prefix = `p0_approval_${randomUUID()}`;
  const userId = `${prefix}_user`;
  const requestId = `${prefix}_request`;
  const failureUserId = `${prefix}_failure_user`;
  const failureRequestId = `${prefix}_failure_request`;
  const secret = 'p0-account-approval-session-secret-long-enough';
  let prisma: PrismaService;
  let sessions: AuthSessionService;
  let operations: AuthOperationsService;
  let audit: AuditService;
  let actor: ResolvedEventOpsActor;

  beforeAll(async () => {
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) {
      process.env[variable] = databaseUrl;
    }
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();
    audit = new AuditService(prisma);
    sessions = new AuthSessionService(new ConfigService({ PRISM_SESSION_SECRET: secret }));
    const authAudit = new AuthAuditAdapter(audit, {} as SecurityOperationsService);
    operations = new AuthOperationsService(prisma, authAudit, {} as never, sessions, {} as never);
    actor = {
      id: `${prefix}_admin`,
      role: 'pmcm-admin',
      name: 'P0 Approval Admin',
      email: `${prefix}_admin@example.test`,
      explicit: true,
      verified: true,
    };

    await prisma.opsUser.create({ data: {
      id: userId,
      name: 'P0 Revocation Fixture',
      email: `${prefix}@example.test`,
      password: 'test-only-hash',
      role: 'client',
      organization: prefix,
      approvalStatus: 'approved',
      sessionVersion: 0,
    } });
    await prisma.opsApprovalRequest.create({ data: {
      id: requestId,
      userId,
      name: 'P0 Revocation Fixture',
      email: `${prefix}@example.test`,
      role: 'client',
      organization: prefix,
      status: 'pending',
      privacyConsentAccepted: true,
      privacyNoticeVersion: 'test',
      marketingConsentAccepted: false,
    } });
    await prisma.opsUser.create({ data: {
      id: failureUserId,
      name: 'P0 Audit Rollback Fixture',
      email: `${prefix}_failure@example.test`,
      password: 'test-only-hash',
      role: 'client',
      organization: prefix,
      approvalStatus: 'approved',
      sessionVersion: 0,
    } });
    await prisma.opsApprovalRequest.create({ data: {
      id: failureRequestId,
      userId: failureUserId,
      name: 'P0 Audit Rollback Fixture',
      email: `${prefix}_failure@example.test`,
      role: 'client',
      organization: prefix,
      status: 'pending',
      privacyConsentAccepted: true,
      privacyNoticeVersion: 'test',
      marketingConsentAccepted: false,
    } });
  }, 30_000);

  afterAll(async () => {
    if (!prisma) return;
    await prisma.opsApprovalRequest.deleteMany({ where: { userId: { in: [userId, failureUserId] } } });
    await prisma.opsUser.deleteMany({ where: { id: { in: [userId, failureUserId] } } });
    await prisma.$disconnect();
  }, 30_000);

  it('revokes a signed session and makes repeated decline idempotent', async () => {
    const oldSession = sessions.issueSession({
      id: userId,
      name: 'P0 Revocation Fixture',
      email: `${prefix}@example.test`,
      role: 'client',
      organization: prefix,
      approvalStatus: 'approved',
      sessionVersion: 0,
    });
    const guard = new EventSessionGuard(sessions, prisma);

    await operations.declineApprovalRequest(requestId, actor);

    await expect(guard.canActivate({
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${oldSession.accessToken}` } }) }),
    } as never)).rejects.toThrow(/revoked|eligible/i);
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: userId } })).resolves.toMatchObject({
      approvalStatus: 'declined',
      sessionVersion: 1,
    });
    await expect(prisma.opsApprovalRequest.findUniqueOrThrow({ where: { id: requestId } })).resolves.toMatchObject({
      status: 'declined',
    });

    await operations.declineApprovalRequest(requestId, actor);
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } })).resolves.toEqual({
      sessionVersion: 1,
    });
    await expect(prisma.opsAuditLog.count({ where: { affectedId: requestId, affectedType: 'approval_request' } })).resolves.toBe(1);
  });

  it('rolls back request, account epoch, and audit append when the audit adapter fails', async () => {
    const failingAudit: AuthAuditPort = {
      write: async (input, context) => {
        const { eventId, actor: auditActor, action, ...options } = input;
        await audit.audit(eventId, auditActor, action, options, context);
        throw new Error('forced audit failure after append');
      },
      recordAuthenticationAudit: async () => undefined,
      recordLoginHistory: async () => undefined,
      handleFailedLogin: async () => undefined,
      handleForbiddenAccess: async () => undefined,
      listLoginHistory: async () => [],
    };
    const failingOperations = new AuthOperationsService(prisma, failingAudit, {} as never, sessions, {} as never);

    await expect(failingOperations.declineApprovalRequest(failureRequestId, actor)).rejects.toThrow(
      'forced audit failure after append',
    );
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: failureUserId } })).resolves.toMatchObject({
      approvalStatus: 'approved',
      sessionVersion: 0,
    });
    await expect(prisma.opsApprovalRequest.findUniqueOrThrow({ where: { id: failureRequestId } })).resolves.toMatchObject({
      status: 'pending',
    });
    await expect(prisma.opsAuditLog.count({ where: { affectedId: failureRequestId, affectedType: 'approval_request' } })).resolves.toBe(0);
  });
});
