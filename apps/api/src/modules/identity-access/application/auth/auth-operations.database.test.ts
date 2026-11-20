import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuditService, SecurityOperationsService } from '@prism/contexts/platform-ops';
import { PrismaService } from '@prism/kernel/database';
import { AuthSessionService, EventSessionGuard } from '@prism/kernel/event-session';
import { AuthSecurityService } from './auth-security.service';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { AuthAuditPort } from '../../contracts/auth-audit.port';
import { AuthAuditAdapter } from '../../infrastructure/auth/auth-audit.adapter';
import { AuthOperationsService } from './auth-operations.service';
import { OwnSessionsService } from './own-sessions.service';
import { OwnTwoFactorService } from './own-two-factor.service';
import { PRISM_PRIVACY_NOTICE_VERSION } from '@prism/types';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const enabled = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));
if (databaseUrl && !enabled) throw new Error('P0 account-revocation tests require 127.0.0.1:55437/prism_p0');

describe.skipIf(!enabled)('account approval PostgreSQL integrity', () => {
  const prefix = `p0_approval_${randomUUID()}`;
  const userId = `${prefix}_user`;
  const requestId = `${prefix}_request`;
  const failureUserId = `${prefix}_failure_user`;
  const failureRequestId = `${prefix}_failure_request`;
  const challengeUserId = `${prefix}_challenge_user`;
  const challengeEmail = `${prefix}_challenge@example.test`;
  const devicesUserId = `${prefix}_devices_user`;
  const twoStepUserId = `${prefix}_two_step_user`;
  const twoStepEmail = `${prefix}_two_step@example.test`;
  const devicesEmail = `${prefix}_devices@example.test`;
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
    sessions = new AuthSessionService(new ConfigService({ PRISM_SESSION_SECRET: secret, PRISM_SESSION_TTL_SECONDS: '28800' }));
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
      id: challengeUserId,
      name: 'P0 Two Factor Fixture',
      email: challengeEmail,
      password: await AuthSecurityService.hashPassword('P0-two-factor-password-long-enough'),
      role: 'pmcm-admin',
      organization: prefix,
      approvalStatus: 'approved',
      twoFactorSecret: 'p0-test-totp-secret',
      sessionVersion: 0,
    } });
    await prisma.opsUser.create({ data: {
      id: devicesUserId,
      name: 'P0 Devices Fixture',
      email: devicesEmail,
      password: await AuthSecurityService.hashPassword('P0-devices-password-long-enough'),
      role: 'supplier',
      organization: prefix,
      approvalStatus: 'approved',
      privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
      sessionVersion: 0,
    } });
    await prisma.opsUser.create({ data: {
      id: twoStepUserId,
      name: 'P0 Two Step Fixture',
      email: twoStepEmail,
      password: await AuthSecurityService.hashPassword('P0-two-step-password-long-enough'),
      role: 'supplier',
      organization: prefix,
      approvalStatus: 'approved',
      privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
      sessionVersion: 0,
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
    await prisma.opsUser.deleteMany({ where: { id: { in: [userId, failureUserId, challengeUserId, devicesUserId, twoStepUserId] } } });
    await prisma.$disconnect();
  }, 30_000);

  it('revokes a signed session and makes repeated decline idempotent', async () => {
    const deviceId = `${prefix}_device`;
    await prisma.opsUserSession.create({ data: { id: deviceId, userId: userId, device: 'Test browser', sessionVersion: 0, expiresAt: new Date(Date.now() + 3_600_000) } });
    const oldSession = sessions.issueSession({
      id: userId,
      name: 'P0 Revocation Fixture',
      email: `${prefix}@example.test`,
      role: 'client',
      organization: prefix,
      approvalStatus: 'approved',
      sessionVersion: 0,
    }, new Date(), deviceId);
    const guard = new EventSessionGuard(sessions, prisma, new Reflector());

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

  it('stores one active challenge, consumes it once under concurrent success, and carries invalid-code counts across challenges', async () => {
    const auditPort: AuthAuditPort = {
      write: async () => undefined,
      recordAuthenticationAudit: async () => undefined,
      recordLoginHistory: async () => undefined,
      handleFailedLogin: async () => undefined,
      handleForbiddenAccess: async () => undefined,
      listLoginHistory: async () => [],
    };
    const totp = {
      decryptSecret: (encrypted: string) => encrypted,
      acceptedStep: vi.fn(() => 1 as number | null),
      generateSecret: () => 'p0-generated-secret',
      encryptSecret: (secret: string) => secret,
      otpauthUri: () => 'otpauth://totp/p0',
    };
    const challengeOperations = new AuthOperationsService(
      prisma,
      auditPort,
      { markPortalInvitationOpenedByEmail: async () => undefined } as never,
      sessions,
      totp as never,
    );

    const firstLogin = await challengeOperations.login(challengeEmail, 'P0-two-factor-password-long-enough');
    if (!('kind' in firstLogin) || firstLogin.kind !== 'two_factor_required') throw new Error('Expected a two-factor challenge');
    const firstClaims = sessions.verifyTwoFactorToken(firstLogin.token);
    const storedChallenge = await prisma.opsUser.findUniqueOrThrow({ where: { id: challengeUserId } });
    expect(storedChallenge.twoFactorChallengeHash).toBeTruthy();
    expect(storedChallenge.twoFactorChallengeHash).not.toBe(firstClaims.challengeId);
    expect(storedChallenge.twoFactorChallengeExpiresAt).toBeInstanceOf(Date);
    expect(storedChallenge.twoFactorChallengeAttempts).toBe(0);
    expect(storedChallenge.twoFactorChallengeConsumedAt).toBeNull();

    const simultaneous = await Promise.allSettled([
      challengeOperations.verifyTwoFactor(firstLogin.token, '123456'),
      challengeOperations.verifyTwoFactor(firstLogin.token, '123456'),
    ]);
    expect(simultaneous.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(simultaneous.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(challengeOperations.verifyTwoFactor(firstLogin.token, '123456')).rejects.toThrow(/used|invalid/i);
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: challengeUserId } })).resolves.toMatchObject({
      twoFactorChallengeConsumedAt: expect.any(Date),
      twoFactorChallengeAttempts: 0,
    });

    const secondLogin = await challengeOperations.login(challengeEmail, 'P0-two-factor-password-long-enough');
    if (!('kind' in secondLogin) || secondLogin.kind !== 'two_factor_required') throw new Error('Expected a second two-factor challenge');
    totp.acceptedStep.mockReturnValue(null);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(challengeOperations.verifyTwoFactor(secondLogin.token, '000000')).rejects.toThrow('Invalid two-factor code');
    }
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: challengeUserId } })).resolves.toMatchObject({
      twoFactorChallengeAttempts: 4,
      lockoutCount: 0,
      failedLoginCount: 4,
      permanentLockout: false,
      lockedUntil: null,
    });

    const thirdLogin = await challengeOperations.login(challengeEmail, 'P0-two-factor-password-long-enough');
    if (!('kind' in thirdLogin) || thirdLogin.kind !== 'two_factor_required') throw new Error('Expected a third two-factor challenge');
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: challengeUserId } })).resolves.toMatchObject({
      twoFactorChallengeAttempts: 0,
      failedLoginCount: 4,
    });
    await expect(challengeOperations.verifyTwoFactor(thirdLogin.token, '000000')).rejects.toThrow('Invalid two-factor code');
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: challengeUserId } })).resolves.toMatchObject({
      twoFactorChallengeAttempts: 1,
      lockoutCount: 1,
      failedLoginCount: 0,
      permanentLockout: false,
      lockedUntil: expect.any(Date),
    });
    await expect(challengeOperations.verifyTwoFactor(thirdLogin.token, '123456')).rejects.toThrow(/invalid|eligible/i);
  });

  it('lists each signed-in browser; signing one out, or signing out on one, ends that browser only, and everywhere else ends the rest', async () => {
    const quietAudit: AuthAuditPort = {
      write: async () => undefined,
      recordAuthenticationAudit: async () => undefined,
      recordLoginHistory: async () => undefined,
      handleFailedLogin: async () => undefined,
      handleForbiddenAccess: async () => undefined,
      listLoginHistory: async () => [],
    };
    const signIn = new AuthOperationsService(prisma, quietAudit, {} as never, sessions, {} as never);
    const devices = new OwnSessionsService(prisma, quietAudit);
    const guard = new EventSessionGuard(sessions, prisma, new Reflector());
    const tokenFor = async (userAgent: string) => {
      const session = await signIn.login(devicesEmail, 'P0-devices-password-long-enough', userAgent);
      if (!('accessToken' in session)) throw new Error('Expected a session');
      return session.accessToken;
    };
    const request = (token: string) => ({ headers: { authorization: `Bearer ${token}` } }) as Record<string, unknown>;
    const allowed = (token: string) => guard.canActivate({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request(token) }),
    } as never);

    const laptop = await tokenFor('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36');
    const phone = await tokenFor('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1');
    const tablet = await tokenFor('Mozilla/5.0 (Linux; Android 15) Firefox/133.0');
    const onLaptop = sessions.verifyAccessToken(laptop);

    const listed = await devices.list(onLaptop);
    expect(listed[0]).toMatchObject({ device: 'Chrome on Windows', current: true });
    expect(listed.filter((row) => row.current)).toHaveLength(1);
    expect(listed.map((row) => row.device).sort()).toEqual(['Chrome on Windows', 'Firefox on Android', 'Safari on iOS']);

    const phoneRow = listed.find((row) => row.device === 'Safari on iOS')!;
    await devices.signOut(onLaptop, phoneRow.id);
    await expect(allowed(phone)).rejects.toThrow(/signed out/i);
    await expect(allowed(laptop)).resolves.toBe(true);
    await expect(allowed(tablet)).resolves.toBe(true);
    await expect(devices.signOut(onLaptop, phoneRow.id)).rejects.toThrow(/already signed out/i);
    await expect(devices.signOut(onLaptop, onLaptop.sessionId!)).rejects.toThrow(/Use Sign out/);

    await expect(devices.signOutOthers(onLaptop)).resolves.toEqual({ signedOut: 1 });
    await expect(allowed(tablet)).rejects.toThrow(/signed out/i);
    await expect(allowed(laptop)).resolves.toBe(true);
    await expect(devices.list(onLaptop)).resolves.toEqual([expect.objectContaining({ device: 'Chrome on Windows', current: true })]);

    const newPhone = await tokenFor('Mozilla/5.0 (Linux; Android 15) Chrome/131.0 Mobile Safari/537.36');
    await signIn.logout(onLaptop);
    await expect(allowed(laptop)).rejects.toThrow(/signed out/i);
    await expect(allowed(newPhone)).resolves.toBe(true);
    await expect(signIn.logout(onLaptop)).rejects.toThrow(/already been revoked/i);
  });

  it('lets a supplier turn two-step sign-in on with a confirmed code, then asks for a code at sign-in until they turn it off', async () => {
    const quietAudit: AuthAuditPort = {
      write: async () => undefined,
      recordAuthenticationAudit: async () => undefined,
      recordLoginHistory: async () => undefined,
      handleFailedLogin: async () => undefined,
      handleForbiddenAccess: async () => undefined,
      listLoginHistory: async () => [],
    };
    // Codes are checked against the stored secret, so a code is right only for the secret it was made from. Each code
    // belongs to a time step, and a step at or before the last accepted one is refused, as the real service does.
    const steps: Record<string, number> = { '246810': 1, '246811': 2 };
    const totp = {
      generateSecret: () => 'APPSECRET',
      encryptSecret: (secret: string) => `enc:${secret}`,
      decryptSecret: (stored: string) => stored.replace(/^enc:/, ''),
      acceptedStep: (secret: string, code: string, lastAcceptedStep: number | null = null) => {
        const step = secret === 'APPSECRET' ? steps[code] : undefined;
        return step !== undefined && (lastAcceptedStep === null || step > lastAcceptedStep) ? step : null;
      },
      otpauthUri: (secret: string, email: string) => `otpauth://totp/PRISM:${email}?secret=${secret}`,
    };
    const signIn = new AuthOperationsService(prisma, quietAudit, {} as never, sessions, totp as never);
    const twoStep = new OwnTwoFactorService(prisma, quietAudit, signIn, totp as never);
    const password = 'P0-two-step-password-long-enough';
    const first = await signIn.login(twoStepEmail, password, 'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0');
    if (!('accessToken' in first)) throw new Error('Expected a session before two-step sign-in is on');
    const actor = sessions.verifyAccessToken(first.accessToken);

    await expect(twoStep.start(actor, 'not-the-password')).rejects.toThrow(/not right/i);
    await expect(twoStep.start(actor, password)).resolves.toEqual({ secret: 'APPSECRET', otpauthUri: expect.stringContaining(twoStepEmail) });
    await expect(twoStep.enable(actor, '000000')).rejects.toThrow(/code is not right/i);
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: twoStepUserId } })).resolves.toMatchObject({ twoFactorSecret: null, twoFactorPendingSecret: 'enc:APPSECRET' });
    await twoStep.enable(actor, '246810');
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: twoStepUserId } })).resolves.toMatchObject({ twoFactorSecret: 'enc:APPSECRET', twoFactorPendingSecret: null });
    await expect(twoStep.start(actor, password)).rejects.toThrow(/already on/i);

    const challenged = await signIn.login(twoStepEmail, password);
    expect(challenged).toMatchObject({ kind: 'two_factor_required' });
    if (!('token' in challenged)) throw new Error('Expected a two-step challenge');
    await expect(signIn.setupTwoFactor(challenged.token)).rejects.toThrow(/not available/i);
    await expect(signIn.verifyTwoFactor(challenged.token, '135790')).rejects.toThrow(/invalid two-factor code/i);
    // The code that turned two-step on was accepted once already, so it cannot complete a sign-in too.
    await expect(signIn.verifyTwoFactor(challenged.token, '246810')).rejects.toThrow(/invalid two-factor code/i);
    const second = await signIn.verifyTwoFactor(challenged.token, '246811', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1');
    expect(second).toMatchObject({ role: 'supplier', accessToken: expect.any(String) });

    await twoStep.disable(actor, password);
    await expect(signIn.login(twoStepEmail, password)).resolves.toMatchObject({ accessToken: expect.any(String) });
    await expect(twoStep.disable({ ...actor, role: 'pmcm-admin', actorRole: 'pmcm-admin' }, password)).rejects.toThrow(/required for PMCM staff/i);
  });

  it('rejects non-canonical and case-variant account emails in direct SQL', async () => {
    const candidate = {
      id: `${prefix}_variant`,
      name: 'Case variant fixture',
      email: `${prefix}@example.test`,
      password: 'test-only-hash',
      role: 'client',
      organization: prefix,
    };

    await expect(prisma.opsUser.create({ data: { ...candidate, email: `${prefix}@EXAMPLE.test` } }))
      .rejects.toThrow(/users_email_canonical_chk|check constraint/i);
    await expect(prisma.opsUser.create({ data: { ...candidate, email: ` ${prefix}@example.test ` } }))
      .rejects.toThrow(/users_email_canonical_chk|check constraint/i);
    await expect(prisma.opsUser.create({ data: candidate })).rejects.toThrow(/users_email_key|unique/i);
    await expect(prisma.opsApprovalRequest.create({ data: {
      id: `${prefix}_variant_request`,
      userId,
      name: candidate.name,
      email: `${prefix}@EXAMPLE.test`,
      role: 'client',
      organization: prefix,
    } })).rejects.toThrow(/approval_requests_email_canonical_chk|check constraint/i);
  });
});
