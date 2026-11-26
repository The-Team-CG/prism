import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import { PrismaService as PrismaServiceToken } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import { AuthSessionService, EventSessionGuard } from '@prism/kernel/event-session';
import { PRISM_PRIVACY_NOTICE_VERSION, paymentReceiptRoutes, paymentReceiptSchema, prismRoutePath, type PrismPaymentReceipt, type PrismUser } from '@prism/types';
import { PaymentReceiptService } from '../../application/billing/payment-receipt.service';
import { PaymentReceiptsController } from './payment-receipts.controller';

const sessionSecret = 'local-receipts-http-test-secret-with-sufficient-entropy';
const config = { get: (key: string) => (key === 'PRISM_SESSION_SECRET' ? sessionSecret : key === 'PRISM_SESSION_TTL_SECONDS' ? '28800' : undefined) };

const receipt: PrismPaymentReceipt = {
  id: 'prcp_1', amount: 5000, receivedDate: '2026-11-20', method: 'GCash', referenceNumber: 'GC-1', payerName: 'Ana Reyes',
  eventId: 'evt_1', notes: '', status: 'recorded', source: 'pmcm', intendedMilestoneId: null, intendedMilestoneLabel: null,
  legacy: false, evidenceObjectId: null, evidence: null, verifiedAt: null, verifiedBy: null, verificationNotes: null,
  rejectionReason: null, reversalReason: null, possibleDuplicateOfId: null, applied: 0, refunded: 0, unapplied: 5000,
  allocations: [], refunds: [], recordedBy: 'Finance', recordedAt: '2026-11-20T00:00:00.000Z',
};

const receipts = {
  listReceipts: vi.fn(async () => [receipt]),
  recordReceipt: vi.fn(async () => receipt),
  verify: vi.fn(async () => ({ ...receipt, status: 'verified' as const, verifiedBy: 'Finance', verificationNotes: 'Bank line 12' })),
};

const accounts = new Map([
  ['pmcm-user', { email: 'finance@pmcm.example.test', role: 'pmcm-admin' }],
  ['client-user', { email: 'ana@example.test', role: 'client' }],
]);
const prismaMock = {
  opsUser: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const account = accounts.get(where.id);
      return account ? { sessionVersion: 0, approvalStatus: 'approved', lockedUntil: null, permanentLockout: false, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION, ...account } : null;
    },
  },
  opsUserSession: {
    findUnique: async ({ where }: { where: { id: string } }) => ({ userId: where.id.slice('session_'.length), revokedAt: null, lastSeenAt: new Date() }),
  },
};
const auditWriter: AuditWriter = { write: async () => undefined };

@Module({
  controllers: [PaymentReceiptsController],
  providers: [
    EventAccessPolicyService,
    EventSessionGuard,
    AuthSessionService,
    { provide: PaymentReceiptService, useValue: receipts },
    { provide: ConfigService, useValue: config },
    { provide: PrismaServiceToken, useValue: prismaMock as unknown as PrismaService },
    { provide: AUDIT_WRITER, useValue: auditWriter },
  ],
})
class ReceiptsHttpTestModule {}

describe('payment receipt routes over HTTP', () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let baseUrl: string;
  let pmcmToken: string;
  let clientToken: string;

  beforeAll(async () => {
    const session = new AuthSessionService(config as unknown as ConfigService);
    const user = (id: string, email: string, role: PrismUser['role']): PrismUser => ({
      id, email, name: 'Finance Operator', role, organization: 'PMCM', approvalStatus: 'approved', sessionVersion: 0,
    });
    pmcmToken = session.issueSession(user('pmcm-user', 'finance@pmcm.example.test', 'pmcm-admin'), new Date(), 'session_pmcm-user').accessToken;
    clientToken = session.issueSession(user('client-user', 'ana@example.test', 'client'), new Date(), 'session_client-user').accessToken;
    app = await NestFactory.create(ReceiptsHttpTestModule, new ExpressAdapter(), { logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api`;
  });

  afterAll(async () => {
    await app.close();
  });

  const call = (method: string, path: string, token: string, body?: unknown) =>
    fetch(`${baseUrl}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  it('serves each contract at its path and status, and answers in the shape the contract promises', async () => {
    const list = await call('GET', `${paymentReceiptRoutes.list.path}?status=recorded`, pmcmToken);
    expect(list.status).toBe(200);
    expect(paymentReceiptSchema.array().parse(await list.json())).toHaveLength(1);
    expect(receipts.listReceipts).toHaveBeenCalledWith({ status: 'recorded' });

    const recorded = await call('POST', paymentReceiptRoutes.record.path, pmcmToken, { amount: 5000, receivedDate: '2026-11-20', method: 'GCash' });
    expect(recorded.status).toBe(201);

    const verified = await call('POST', prismRoutePath(paymentReceiptRoutes.verify, { receiptId: 'prcp_1' }), pmcmToken, { notes: 'Bank line 12' });
    expect(verified.status).toBe(200);
    expect(paymentReceiptSchema.parse(await verified.json())).toMatchObject({ status: 'verified' });
    expect(receipts.verify).toHaveBeenCalledWith('prcp_1', { notes: 'Bank line 12' }, expect.objectContaining({ id: 'pmcm-user' }));
  });

  it('validates the body and query with the contract schemas and still refuses other roles', async () => {
    const before = receipts.verify.mock.calls.length;
    expect((await call('POST', prismRoutePath(paymentReceiptRoutes.verify, { receiptId: 'prcp_1' }), pmcmToken, { notes: '' })).status).toBe(400);
    expect((await call('GET', `${paymentReceiptRoutes.list.path}?colour=red`, pmcmToken)).status).toBe(400);
    expect((await call('POST', prismRoutePath(paymentReceiptRoutes.verify, { receiptId: 'prcp_1' }), clientToken, { notes: 'Bank line 12' })).status).toBe(403);
    expect(receipts.verify.mock.calls.length).toBe(before);
  });
});
