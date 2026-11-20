import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PRISM_PRIVACY_NOTICE_VERSION, type PrismVerifiedEventActor } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import { AuthSessionService, EventSessionGuard } from '@prism/kernel/event-session';
import type { AuthAuditPort } from '../modules/identity-access/contracts/auth-audit.port';
import { EmailChangeService } from '../modules/identity-access/application/auth/email-change.service';
import { LifecycleAccountEmailRelinkerService } from '../modules/event-lifecycle/application/onboarding/lifecycle-account-email-relinker.service';
import { CommercialAccountEmailRelinkerService } from '../modules/commercial/application/suppliers/commercial-account-email-relinker.service';
import { OperationsAccountEmailRelinkerService } from '../modules/operations/application/staffing/operations-account-email-relinker.service';
import { PlatformAccountEmailRelinkerService } from '../modules/platform-ops/application/trust/platform-account-email-relinker.service';
import { AccountEmailChangeService } from './account-email-change.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const enabled = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));
if (databaseUrl && !enabled) throw new Error('P0 account email change tests require 127.0.0.1:55437/prism_p0');

describe.skipIf(!enabled)('account email change across contexts (PostgreSQL)', () => {
  const prefix = `p0_email_${randomUUID().slice(0, 8)}`;
  const client = { id: `${prefix}_client`, email: `${prefix}_ana@example.test` };
  const supplier = { id: `${prefix}_supplier`, email: `${prefix}_ops@example.test` };
  const other = { id: `${prefix}_other`, email: `${prefix}_other@example.test` };
  const sent: Array<{ recipient: string; confirmUrl?: string; newEmail?: string }> = [];
  let prisma: PrismaService;
  let sessions: AuthSessionService;
  let emailChange: EmailChangeService;
  let confirmation: AccountEmailChangeService;

  const quietAudit: AuthAuditPort = {
    write: async () => undefined,
    recordAuthenticationAudit: async () => undefined,
    recordLoginHistory: async () => undefined,
    handleFailedLogin: async () => undefined,
    handleForbiddenAccess: async () => undefined,
    listLoginHistory: async () => [],
  };
  const passwords = {
    confirmPassword: async (_id: string, password: string) => {
      if (password !== 'right-password') throw new ForbiddenException('That password is not right.');
      return new Date();
    },
  };
  const actorFor = (user: { id: string; email: string }, role: 'client' | 'supplier'): PrismVerifiedEventActor => ({ sessionId: 'session_test',
    id: user.id, actorId: user.id, role, actorRole: role, email: user.email, actorEmail: user.email,
    name: 'P0 Email Fixture', actorName: 'P0 Email Fixture', sessionVersion: 0, expiresAt: '2099-01-01T00:00:00.000Z',
  });
  const lastOf = <T,>(items: T[], fromEnd: number): T | undefined => items[items.length - fromEnd];
  const latestToken = () => new URL(lastOf(sent.filter((mail) => mail.confirmUrl), 1)!.confirmUrl!).searchParams.get('token')!;

  beforeAll(async () => {
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) process.env[variable] = databaseUrl;
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();
    sessions = new AuthSessionService(new ConfigService({ PRISM_SESSION_SECRET: 'p0-email-change-session-secret-long-enough', PRISM_SESSION_TTL_SECONDS: '28800' }));
    const delivery = {
      sendConfirmation: async (input: { recipient: string; confirmUrl: string }) => { sent.push(input); },
      sendNotice: async (input: { recipient: string; newEmail: string }) => { sent.push(input); },
    };
    const portals = { client: 'http://client.test', supplier: 'http://supplier.test', event: 'http://event.test' };
    emailChange = new EmailChangeService(prisma, quietAudit, passwords, delivery, portals as never);
    confirmation = new AccountEmailChangeService(
      prisma,
      emailChange,
      new LifecycleAccountEmailRelinkerService(),
      new CommercialAccountEmailRelinkerService(),
      new OperationsAccountEmailRelinkerService(),
      new PlatformAccountEmailRelinkerService(),
    );
    const account = (user: { id: string; email: string }, role: string) => ({
      id: user.id, name: 'P0 Email Fixture', email: user.email, password: 'test-only-hash', role, organization: prefix,
      approvalStatus: 'approved', privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION, sessionVersion: 0,
    });
    await prisma.opsUser.createMany({ data: [account(client, 'client'), account(supplier, 'supplier'), account(other, 'client')] });
    await prisma.opsInquiry.create({ data: {
      id: `${prefix}_inquiry`, clientName: 'Ana', email: client.email.toUpperCase(), normalizedEmail: client.email,
      eventName: 'P0 Gala', eventDate: new Date('2027-02-14T00:00:00.000Z'), clientType: 'corporate',
    } });
    await prisma.opsNotificationChannelPreference.create({ data: { email: client.email } });
    await prisma.opsNotificationLog.create({ data: { id: `${prefix}_notice`, channel: 'in_app', recipient: client.email, message: 'Your proposal is ready' } });
    await prisma.opsNotificationDelivery.create({ data: { id: `${prefix}_delivery`, notificationId: `${prefix}_notice`, recipient: client.email } });
    await prisma.opsPrivacyRequest.create({ data: {
      id: `${prefix}_privacy`, subjectType: 'client', subjectEmail: client.email, requestType: 'access',
      createdBy: client.id, dueAt: new Date('2027-01-01T00:00:00.000Z'),
    } });
    await prisma.opsSupplierCategory.create({ data: { id: `${prefix}_category`, slug: `${prefix}-category`, name: 'P0 Category' } });
    await prisma.opsSupplier.create({ data: { id: `${prefix}_supplier_record`, categoryId: `${prefix}_category`, name: 'P0 Supplier', email: supplier.email } });
  }, 30_000);

  afterAll(async () => {
    if (!prisma) return;
    await prisma.opsSupplier.deleteMany({ where: { id: `${prefix}_supplier_record` } });
    await prisma.opsSupplierCategory.deleteMany({ where: { id: `${prefix}_category` } });
    await prisma.opsPrivacyRequest.deleteMany({ where: { id: `${prefix}_privacy` } });
    await prisma.opsNotificationChannelPreference.deleteMany({ where: { email: { startsWith: prefix } } });
    await prisma.opsNotificationDelivery.deleteMany({ where: { id: `${prefix}_delivery` } });
    await prisma.opsNotificationLog.deleteMany({ where: { id: `${prefix}_notice` } });
    await prisma.opsInquiry.deleteMany({ where: { id: `${prefix}_inquiry` } });
    await prisma.opsUser.deleteMany({ where: { id: { in: [client.id, supplier.id, other.id] } } });
    await prisma.$disconnect();
  }, 30_000);

  it('moves a client to the new address with their events, notification inbox and settings and privacy requests, and ends their sessions', async () => {
    const newEmail = `${prefix}_ana.new@example.test`;
    const deviceId = `${prefix}_device`;
    await prisma.opsUserSession.create({ data: { id: deviceId, userId: client.id, device: 'Test browser', sessionVersion: 0, expiresAt: new Date(Date.now() + 3_600_000) } });
    const oldSession = sessions.issueSession({ id: client.id, name: 'P0 Email Fixture', email: client.email, role: 'client', organization: prefix, approvalStatus: 'approved', sessionVersion: 0 }, new Date(), deviceId);
    await expect(emailChange.request(actorFor(client, 'client'), { newEmail, password: 'wrong' })).rejects.toThrow(/not right/);
    await expect(emailChange.request(actorFor(client, 'client'), { newEmail: client.email, password: 'right-password' })).rejects.toThrow(/already your sign-in email/);

    await expect(emailChange.request(actorFor(client, 'client'), { newEmail, password: 'right-password' })).resolves.toMatchObject({ email: newEmail });
    expect(lastOf(sent, 2)).toMatchObject({ recipient: newEmail, confirmUrl: expect.stringMatching(/^http:\/\/client\.test\/confirm-email\?token=/) });
    expect(lastOf(sent, 1)).toMatchObject({ recipient: client.email, newEmail });
    await expect(emailChange.pending(client.id)).resolves.toMatchObject({ email: newEmail });
    // Nothing moves until the link is opened.
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: client.id } })).resolves.toMatchObject({ email: client.email });

    const token = latestToken();
    await expect(confirmation.confirm(token)).resolves.toEqual({ email: newEmail });
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: client.id } })).resolves.toMatchObject({ email: newEmail, sessionVersion: 1 });
    await expect(prisma.opsInquiry.findUniqueOrThrow({ where: { id: `${prefix}_inquiry` } })).resolves.toMatchObject({ email: newEmail, normalizedEmail: newEmail });
    await expect(prisma.opsNotificationChannelPreference.findUnique({ where: { email: newEmail } })).resolves.not.toBeNull();
    await expect(prisma.opsNotificationChannelPreference.findUnique({ where: { email: client.email } })).resolves.toBeNull();
    await expect(prisma.opsNotificationDelivery.findUniqueOrThrow({ where: { id: `${prefix}_delivery` } })).resolves.toMatchObject({ recipient: newEmail });
    // The log keeps who each message was for at the time.
    await expect(prisma.opsNotificationLog.findUniqueOrThrow({ where: { id: `${prefix}_notice` } })).resolves.toMatchObject({ recipient: client.email });
    await expect(prisma.opsPrivacyRequest.findUniqueOrThrow({ where: { id: `${prefix}_privacy` } })).resolves.toMatchObject({ subjectEmail: newEmail });
    await expect(emailChange.pending(client.id)).resolves.toBeNull();

    const guard = new EventSessionGuard(sessions, prisma, new Reflector());
    await expect(guard.canActivate({
      getHandler: () => undefined, getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${oldSession.accessToken}` } }) }),
    } as never)).rejects.toThrow(/revoked|eligible/i);
    await expect(confirmation.confirm(token)).rejects.toThrow(/expired or was already used/);
  });

  it('moves a supplier record with its account, and changes nothing when the address was taken meanwhile or the request withdrawn', async () => {
    const supplierActor = actorFor(supplier, 'supplier');
    await emailChange.request(supplierActor, { newEmail: other.email, password: 'right-password' });
    await expect(confirmation.confirm(latestToken())).rejects.toThrow(/belongs to another account/);
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: supplier.id } })).resolves.toMatchObject({ email: supplier.email, sessionVersion: 0 });
    await expect(emailChange.pending(supplier.id)).resolves.toBeNull();

    await emailChange.request(supplierActor, { newEmail: `${prefix}_withdrawn@example.test`, password: 'right-password' });
    const withdrawn = latestToken();
    await emailChange.cancel(supplierActor);
    await expect(confirmation.confirm(withdrawn)).rejects.toThrow(/expired or was already used/);

    const newEmail = `${prefix}_ops.new@example.test`;
    await emailChange.request(supplierActor, { newEmail, password: 'right-password' });
    expect(lastOf(sent, 2)?.confirmUrl).toMatch(/^http:\/\/supplier\.test\/confirm-email\?token=/);
    await confirmation.confirm(latestToken());
    await expect(prisma.opsSupplier.findUniqueOrThrow({ where: { id: `${prefix}_supplier_record` } })).resolves.toMatchObject({ email: newEmail });
  });
});
