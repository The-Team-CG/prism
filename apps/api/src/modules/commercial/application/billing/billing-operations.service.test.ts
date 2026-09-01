import { describe, expect, it, vi } from 'vitest';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import { BillingOperationsService } from './billing-operations.service';

function createPaymentService() {
  const milestone = {
    id: 'pay_downpayment',
    eventId: 'evt_sample',
    label: 'Downpayment',
    percentage: 50,
    amount: 100000,
    amountPaid: 25000,
    remainingBalance: 75000,
    dueDate: new Date('2026-07-01T00:00:00.000Z'),
    status: 'partially_paid',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
  };
  const existingRecord = {
    id: 'payrec_existing',
    eventId: 'evt_sample',
    milestoneId: 'pay_downpayment',
    amountReceived: 25000,
    paymentDate: new Date('2026-06-20T00:00:00.000Z'),
    paymentMethod: 'Bank Transfer',
    referenceNumber: 'BNK-123',
    recordedAt: new Date('2026-06-20T01:00:00.000Z'),
  };
  const history = [existingRecord];
  const prisma: any = {
    opsEvent: { findUnique: vi.fn(async () => ({ id: 'evt_sample' })) },
    opsPaymentMilestone: {
      findUnique: vi.fn(async () => milestone),
      findMany: vi.fn(async () => [milestone]),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(milestone, data)),
    },
    opsPaymentRecord: {
      findMany: vi.fn(async () => history),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const record = { ...existingRecord, ...data, recordedAt: new Date('2026-06-21T00:00:00.000Z') };
        history.push(record as typeof existingRecord);
        return record;
      }),
    },
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
  };
  const audit = { write: vi.fn() };
  const notifications = { write: vi.fn() };
  const service = new BillingOperationsService(prisma, audit as any, notifications as any, new WorkflowCommandService());
  return { service, prisma, audit, history };
}

describe('BillingOperationsService', () => {
  it('does not duplicate a retried payment record with the same reference number', async () => {
    const { service, prisma, audit, history } = createPaymentService();

    const result = await service.recordPayment(
      'evt_sample',
      'pay_downpayment',
      {
        amountReceived: 25000,
        paymentDate: '2026-06-20',
        paymentMethod: 'Bank Transfer',
        referenceNumber: 'BNK-123',
      },
      { name: 'PMCM Admin', role: 'pmcm-admin', email: 'admin@pmcm.test', correlationId: 'corr_finance_1' },
    );

    expect(prisma.opsPaymentRecord.create).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
    expect(history).toHaveLength(1);
    expect(result.amountPaid).toBe(25000);
    expect(result.remainingBalance).toBe(75000);
    expect(result.history).toHaveLength(1);
  });
  it('records and audits a payment when the reference number is new', async () => {
    const { service, prisma, audit, history } = createPaymentService();

    const result = await service.recordPayment(
      'evt_sample',
      'pay_downpayment',
      {
        amountReceived: 25000,
        paymentDate: '2026-06-21',
        paymentMethod: 'Bank Transfer',
        referenceNumber: 'BNK-456',
      },
      { name: 'PMCM Admin', role: 'pmcm-admin', email: 'admin@pmcm.test', correlationId: 'corr_finance_1' },
    );

    expect(prisma.opsPaymentRecord.create).toHaveBeenCalledTimes(1);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_sample',
        actor: 'PMCM Admin',
        action: 'Recorded Bank Transfer payment for Downpayment',
        actorRole: 'pmcm-admin',
        actorEmail: 'admin@pmcm.test',
        metadata: expect.objectContaining({ correlationId: 'corr_finance_1', referenceNumber: 'BNK-456' }),
      }),
      undefined,
    );
    expect(history).toHaveLength(2);
    expect(result.amountPaid).toBe(50000);
    expect(result.remainingBalance).toBe(50000);
  });
  it('serves payment status through the payment status reader contract', async () => {
    const { service, prisma } = createPaymentService();

    const result = await service.getPaymentStatusForEvent('evt_sample');

    expect(prisma.opsEvent.findUnique).toHaveBeenCalledWith({ where: { id: 'evt_sample' } });
    expect(result).toMatchObject({
      eventId: 'evt_sample',
      counts: { paid: 0, pending: 1, atRisk: 0 },
      milestones: [
        {
          id: 'pay_downpayment',
          amountPaid: 25000,
          remainingBalance: 75000,
          history: [{ id: 'payrec_existing', referenceNumber: 'BNK-123' }],
        },
      ],
      paymentRecords: [{ id: 'payrec_existing', referenceNumber: 'BNK-123' }],
    });
  });
});
