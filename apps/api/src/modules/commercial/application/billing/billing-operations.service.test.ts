import { describe, expect, it, vi } from 'vitest';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import { approveBillingSourceSchema } from '@prism/types';
import { BillingOperationsService, renderBillingPdf } from './billing-operations.service';

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
  const billingSource = {
    id: 'bsrc_sample', eventId: 'evt_sample', sourceLabel: 'Signed conforme', status: 'pending',
    totalAmount: 100000, approvedBy: null, approvalNotes: '', createdAt: new Date(), updatedAt: new Date(),
    sourceType: 'conforme', sourceDocumentId: null, lineItems: [], paymentSchedule: [], paymentMethods: [],
  };
  const prisma: any = {
    opsEvent: {
      findUnique: vi.fn(async () => ({ id: 'evt_sample' })),
      findMany: vi.fn(async () => [{ id: 'evt_sample', eventName: 'Sample Event' }]),
    },
    opsPaymentMilestone: {
      findUnique: vi.fn(async () => milestone),
      findMany: vi.fn(async () => [milestone]),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(milestone, data)),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (milestone.status === 'paid' || milestone.status === 'at_risk' || milestone.remainingBalance <= 0) return { count: 0 };
        Object.assign(milestone, data);
        return { count: 1 };
      }),
    },
    opsPaymentRecord: {
      findMany: vi.fn(async () => history),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const record = { ...existingRecord, ...data, recordedAt: new Date('2026-06-21T00:00:00.000Z') };
        history.push(record as typeof existingRecord);
        return record;
      }),
    },
    opsBillingSource: {
      findUnique: vi.fn(async () => billingSource),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(billingSource, data)),
    },
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
  };
  const audit = { write: vi.fn() };
  const notifications = { write: vi.fn() };
  const service = new BillingOperationsService(prisma, audit as any, notifications as any, new WorkflowCommandService());
  return { service, prisma, audit, history, milestone };
}

function createBillingStatementService(priorNumbers: string[], conflictingSequenceNumber?: number) {
  const event = {
    id: 'evt_billing_sequence',
    inquiryId: 'inq_billing_sequence',
    eventName: 'Sequence Test Event',
    clientName: 'Sequence Client',
    eventDate: new Date('2026-08-01T00:00:00.000Z'),
  };
  const source = {
    id: 'bsrc_billing_sequence',
    eventId: event.id,
    sourceLabel: 'Approved source',
    status: 'approved',
    totalAmount: 100000,
    lineItems: [],
    paymentSchedule: [{ label: 'Full payment', percentage: 100 }],
    paymentMethods: [],
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };
  const statements = priorNumbers.map((number, index) => ({ id: `stmt_${index}`, number }));
  const sequenceRows: Array<{ next_number: number }> = [];
  const queryRaw = vi.fn(async (parts: TemplateStringsArray) => {
    const query = parts.join(' ');
    if (query.includes('pg_advisory_xact_lock')) return [];
    if (query.includes('MAX(substring')) {
      const maxSequence = statements.reduce((max, statement) => Math.max(max, Number(statement.number.slice(-4))), 0);
      return [{ next_number: maxSequence + 1 }];
    }
    return sequenceRows;
  });
  const executeRaw = vi.fn(async (parts: TemplateStringsArray) => {
    const query = parts.join(' ');
    if (query.includes('INSERT INTO')) {
      const maxSequence = statements.reduce((max, statement) => Math.max(max, Number(statement.number.slice(-4))), 0);
      sequenceRows.push({ next_number: conflictingSequenceNumber ?? maxSequence + 1 });
      return conflictingSequenceNumber === undefined ? 1 : 0;
    }
    if (query.includes('UPDATE')) {
      sequenceRows[0].next_number += 1;
    }
    return 1;
  });
  const prisma: any = {
    opsEvent: { findUnique: vi.fn(async () => event) },
    opsInquiry: { findUnique: vi.fn(async () => ({ clientName: event.clientName, email: '' })) },
    opsBillingSource: { findUnique: vi.fn(async () => source) },
    opsBillingStatement: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => ({ ...data, generatedAt: new Date('2026-08-01T01:00:00.000Z') })),
    },
    opsDocument: { create: vi.fn(async ({ data }: { data: Record<string, any> }) => ({ ...data })) },
    opsPaymentMilestone: { createMany: vi.fn(async () => ({ count: 1 })) },
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
  };
  const audit = { write: vi.fn() };
  const notifications = { write: vi.fn() };
  const service = new BillingOperationsService(prisma, audit as any, notifications as any, new WorkflowCommandService());
  return { service, prisma, statements };
}

describe('BillingOperationsService', () => {
  it('marks upcoming balances at risk and audits only the first successful transition', async () => {
    const { service, prisma, audit, milestone } = createPaymentService();
    milestone.label = 'Balance';
    prisma.opsPaymentMilestone.findMany.mockImplementation(async () => [{ ...milestone, status: 'partially_paid' }]);

    await service.runPaymentRiskSweep();
    await service.runPaymentRiskSweep();

    expect(milestone.status).toBe('at_risk');
    expect(prisma.opsPaymentMilestone.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.opsPaymentMilestone.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'pay_downpayment',
        eventId: 'evt_sample',
        status: { notIn: ['paid', 'at_risk'] },
        remainingBalance: { gt: 0 },
      }),
    }));
    expect(audit.write).toHaveBeenCalledTimes(1);
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'evt_sample',
      action: 'Payment at risk for Sample Event',
      affectedId: 'pay_downpayment',
      affectedLabel: 'Balance',
    }), undefined);
  });

  it('renders a structurally parseable PDF with real newline bytes and matching xref offsets', () => {
    const pdf = renderBillingPdf({ number: 'BS-2026-0001', sourceLabel: 'Approved proposal', totalAmount: 100000 });
    const text = pdf.toString('utf8');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(pdf.includes(0x0a)).toBe(true);
    expect(text.includes('\\n')).toBe(false);
    const startxref = Number(text.match(/startxref\n(\d+)\n%%EOF/)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    expect(text.match(/xref\n0 6\n0000000000 65535 f \n(?:\d{10} 00000 n \n){5}/)).not.toBeNull();
  });

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

  it('attributes billing approval to the verified actor after parsing the request body', async () => {
    const { service, audit, prisma } = createPaymentService();
    const input = approveBillingSourceSchema.parse({ approvedBy: 'Spoofed approver', approvalNotes: 'Checked' });

    await service.approveBillingSource(
      'evt_sample',
      'bsrc_sample',
      input,
      { name: 'Maxine', role: 'pmcm-admin', email: 'maxine@pmcm.test', correlationId: 'corr_approval_1' },
    );

    expect(prisma.opsBillingSource.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ approvedBy: 'Maxine' }),
    }));
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ actor: 'Maxine' }), undefined);
  });

  it.each([
    { name: 'no prior statements for the year', priorNumbers: [], expectedNumber: 'BS-2026-0001' },
    { name: 'exactly one prior statement', priorNumbers: ['BS-2026-0001'], expectedNumber: 'BS-2026-0002' },
    { name: 'several prior statements with a gap', priorNumbers: ['BS-2026-0001', 'BS-2026-0003'], expectedNumber: 'BS-2026-0004' },
  ])('allocates the next number with $name', async ({ priorNumbers, expectedNumber }) => {
    const { service, prisma } = createBillingStatementService(priorNumbers);

    const result = await service.generateBillingStatement(
      'evt_billing_sequence',
      'bsrc_billing_sequence',
      { name: 'PMCM Admin', role: 'pmcm-admin', email: 'admin@pmcm.test' },
    );

    expect(result.number).toBe(expectedNumber);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('uses the stored sequence without rescanning prior statements on subsequent issues', async () => {
    const { service, prisma } = createBillingStatementService(['BS-2026-0001']);

    const first = await service.generateBillingStatement(
      'evt_billing_sequence',
      'bsrc_billing_sequence',
      { name: 'PMCM Admin', role: 'pmcm-admin', email: 'admin@pmcm.test' },
    );
    const second = await service.generateBillingStatement(
      'evt_billing_sequence',
      'bsrc_billing_sequence',
      { name: 'PMCM Admin', role: 'pmcm-admin', email: 'admin@pmcm.test' },
    );

    expect(first.number).toBe('BS-2026-0002');
    expect(second.number).toBe('BS-2026-0003');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(6);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('uses a sequence row initialized concurrently by an older server', async () => {
    const { service, prisma } = createBillingStatementService(['BS-2026-0001'], 3);

    const result = await service.generateBillingStatement(
      'evt_billing_sequence',
      'bsrc_billing_sequence',
      { name: 'PMCM Admin', role: 'pmcm-admin', email: 'admin@pmcm.test' },
    );

    expect(result.number).toBe('BS-2026-0003');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
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
