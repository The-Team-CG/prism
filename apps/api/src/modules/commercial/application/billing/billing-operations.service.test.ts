import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import { approveBillingSourceSchema } from '@prism/types';
import { BillingOperationsService, renderBillingPdf } from './billing-operations.service';
import { PaymentOperationsService } from './payment-operations.service';
import { mapClientBillingDispute } from './billing-operations.mappers';
import type { BillingActor } from '../../contracts/billing-operations.types';
import type { StorageObjectService } from '@prism/contexts/platform-ops';
import type { PrismVerifiedEventActor } from '@prism/types';

const billingActor: BillingActor = { id: 'user_finance_1', name: 'Finance Operator', role: 'pmcm-admin', email: 'admin@pmcm.test', correlationId: 'corr_finance_1' };
const verifiedBillingActor: PrismVerifiedEventActor = {
  id: 'user_finance_1', actorId: 'user_finance_1', role: 'pmcm-admin', actorRole: 'pmcm-admin',
  email: 'admin@pmcm.test', actorEmail: 'admin@pmcm.test', name: 'Finance Operator', actorName: 'Finance Operator',
  expiresAt: '2026-10-04T12:00:00.000Z',
};

function createWorkflowCommandService(prisma: any) {
  const transactionRunner = {
    run: (work: (context: any) => Promise<unknown>, command: { correlationId?: string; actorId?: string } = {}) =>
      prisma.$transaction((tx: any) => work({
        prisma: tx,
        correlationId: command.correlationId ?? 'corr_test',
        actorId: command.actorId,
      })),
  };
  return new WorkflowCommandService(transactionRunner as never);
}

function createPaymentService() {
  const milestone = {
    id: 'pay_downpayment',
    eventId: 'evt_sample',
    label: 'Downpayment',
    percentage: 50,
    amount: 100000,
    amountPaid: 25000,
    creditApplied: 0,
    supersededAt: null,
    statementId: null,
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
    opsProposalVersion: { findFirst: vi.fn(async (): Promise<Record<string, unknown> | null> => null) },
    opsAuditLog: { findFirst: vi.fn(async (): Promise<Record<string, unknown> | null> => null) },
    opsBillingSource: {
      findMany: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
      findUnique: vi.fn(async () => billingSource),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...billingSource, ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(billingSource, data)),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (billingSource.status === 'approved') return { count: 0 };
        Object.assign(billingSource, data);
        return { count: 1 };
      }),
    },
    $queryRaw: vi.fn(async () => [{ id: milestone.id, event_id: milestone.eventId }]),
    $executeRaw: vi.fn(async () => 1),
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
  };
  const audit = { write: vi.fn() };
  const notifications = { write: vi.fn() };
  const documentVault = {
    registerDocument: vi.fn(async ({ eventId, documentKind, fileName, status }: any) => ({
      id: 'doc_billing_statement', eventId, kind: documentKind, fileName, status,
    })),
    findEligibleReference: vi.fn(),
  };
  const service = new BillingOperationsService(prisma, audit as any, notifications as any, createWorkflowCommandService(prisma), documentVault as any);
  const paymentService = new PaymentOperationsService(prisma, audit as any, notifications as any, new WorkflowCommandService());
  return { service, paymentService, prisma, audit, notifications, history, milestone, documentVault };
}

function createBillingStatementService(priorNumbers: string[], conflictingSequenceNumber?: number, storageObjectService?: StorageObjectService) {
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
  const otherSource = { ...source, id: 'bsrc_billing_sequence_other' };
  const issued: Array<Record<string, any>> = [];
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
    opsInquiry: { findUnique: vi.fn(async () => ({ clientName: event.clientName, email: 'client@example.test' })) },
    opsBillingSource: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === otherSource.id ? otherSource : source)) },
    opsBillingStatement: {
      findUnique: vi.fn(async ({ where }: { where: { idempotencyKey?: string } }) => issued.find((statement) => where.idempotencyKey && statement.idempotencyKey === where.idempotencyKey) ?? null),
      findFirst: vi.fn(async ({ where }: { where: { sourceId: string } }) => issued.find((statement) => statement.sourceId === where.sourceId) ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        const row = { ...data, generatedAt: new Date('2026-08-01T01:00:00.000Z') };
        issued.push(row);
        return row;
      }),
    },
    opsDocument: { create: vi.fn(async ({ data }: { data: Record<string, any> }) => ({ ...data })) },
    opsPaymentMilestone: { createMany: vi.fn(async () => ({ count: 1 })) },
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
  };
  const audit = { write: vi.fn() };
  const notifications = { write: vi.fn() };
  const documentVault = {
    registerDocument: vi.fn(async ({ eventId, documentKind, fileName, status }: any) => ({
      id: 'doc_billing_statement', eventId, kind: documentKind, fileName, status,
    })),
    findEligibleReference: vi.fn(),
  };
  const service = new BillingOperationsService(prisma, audit as any, notifications as any, createWorkflowCommandService(prisma), documentVault as any, storageObjectService);
  return { service, prisma, statements, documentVault, otherSourceId: otherSource.id, notifications, issued };
}

describe('BillingOperationsService', () => {
  it('keeps a superseded statement closed and treats sending an already sent statement as a replay', async () => {
    const { service, prisma } = createBillingStatementService([]);
    const statement = await service.generateBillingStatement('evt_billing_sequence', 'bsrc_billing_sequence', billingActor, verifiedBillingActor);
    const row = { ...statement, generatedAt: new Date('2026-08-01T00:00:00Z'), eventDate: new Date('2026-08-01T00:00:00Z'), sentAt: new Date('2026-08-02T00:00:00Z'), status: 'superseded' };
    prisma.opsBillingStatement.findUnique.mockResolvedValue(row);
    prisma.opsBillingStatement.update = vi.fn();
    await expect(service.sendBillingStatement('evt_billing_sequence', row.id, billingActor)).rejects.toThrow('superseded');
    expect(prisma.opsBillingStatement.update).not.toHaveBeenCalled();
    row.status = 'sent';
    const replay = await service.sendBillingStatement('evt_billing_sequence', row.id, billingActor);
    expect(replay.sentAt).toBe('2026-08-02T00:00:00.000Z');
    expect(prisma.opsBillingStatement.update).not.toHaveBeenCalled();
  });

  it('rejects cross-event or ineligible billing evidence before creating a source', async () => {
    const { service, prisma, documentVault } = createPaymentService();
    documentVault.findEligibleReference.mockRejectedValueOnce(new Error('Eligible document not found for this event'));

    await expect(service.createBillingSource('evt_sample', {
      sourceLabel: 'Proposal evidence',
      sourceDocumentId: 'doc_wrong_event',
      lineItems: [{ label: 'Package', amount: 100000 }],
    }, billingActor)).rejects.toThrow('Eligible document not found');

    expect(documentVault.findEligibleReference).toHaveBeenCalledWith({
      eventId: 'evt_sample', purpose: 'billing_source_evidence', documentId: 'doc_wrong_event',
    });
    expect(prisma.opsBillingSource.create).not.toHaveBeenCalled();
  });

  it('accepts an eligible same-event proposal reference for a billing source', async () => {
    const { service, prisma, documentVault } = createPaymentService();
    documentVault.findEligibleReference.mockResolvedValue({
      id: 'doc_proposal', eventId: 'evt_sample', kind: 'proposal', status: 'issued', fileName: 'proposal.pdf',
    } as never);

    await service.createBillingSource('evt_sample', {
      sourceLabel: 'Approved proposal',
      sourceDocumentId: 'doc_proposal',
      lineItems: [{ label: 'Package', amount: 100000 }],
    }, billingActor);

    expect(prisma.opsBillingSource.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventId: 'evt_sample', sourceDocumentId: 'doc_proposal' }),
    }));
    expect(documentVault.findEligibleReference).toHaveBeenCalledTimes(2);
  });

  describe('billing source evidence and approval rules', () => {
    const proposalDocument = (fileName: string) => ({ id: 'doc_proposal', eventId: 'evt_sample', kind: 'proposal', status: 'issued', fileName });
    const sourceBody = (overrides: Record<string, unknown> = {}) => ({
      sourceLabel: 'Approved proposal', sourceDocumentId: 'doc_proposal', lineItems: [{ label: 'Package', amount: 500000 }], ...overrides,
    });
    const proposalVersion = (status: string, totalAmount = 500000) => ({ status, totalAmount });
    const auditedMetadata = (audit: { write: { mock: { calls: unknown[][] } } }) => (audit.write.mock.calls[0][0] as { metadata: Record<string, unknown> }).metadata;

    it('refuses a source that cites a superseded proposal version unless PMCM gives a reason, and audits the reason', async () => {
      const { service, prisma, documentVault, audit } = createPaymentService();
      documentVault.findEligibleReference.mockResolvedValue(proposalDocument('Proposal v1 - Summit.pdf') as never);
      prisma.opsProposalVersion.findFirst.mockResolvedValue(proposalVersion('superseded'));

      const refused = service.createBillingSource('evt_sample', sourceBody(), billingActor);
      await expect(refused).rejects.toBeInstanceOf(BadRequestException);
      await expect(refused).rejects.toThrow(/Proposal v1 has been superseded/);
      expect(prisma.opsBillingSource.create).not.toHaveBeenCalled();

      await service.createBillingSource('evt_sample', sourceBody({ evidenceOverrideReason: 'Client signed v1 terms' }), billingActor);
      expect(prisma.opsBillingSource.create).toHaveBeenCalledTimes(1);
      expect(auditedMetadata(audit)).toMatchObject({ evidenceOverrideReason: 'Client signed v1 terms', citedProposalVersion: 1 });
    });

    it('refuses a source total that differs from the cited proposal unless PMCM gives a reason, and audits the reason', async () => {
      const { service, prisma, documentVault, audit } = createPaymentService();
      documentVault.findEligibleReference.mockResolvedValue(proposalDocument('Proposal v2 - Summit.pdf') as never);
      prisma.opsProposalVersion.findFirst.mockResolvedValue(proposalVersion('issued'));

      await expect(service.createBillingSource('evt_sample', sourceBody({ lineItems: [{ label: 'Package', amount: 999000 }] }), billingActor))
        .rejects.toThrow(/999000 does not match the Proposal v2 total 500000/);
      expect(prisma.opsBillingSource.create).not.toHaveBeenCalled();

      await service.createBillingSource('evt_sample', sourceBody({ lineItems: [{ label: 'Package', amount: 450000 }], totalOverrideReason: 'Negotiated discount' }), billingActor);
      expect(prisma.opsBillingSource.create).toHaveBeenCalledTimes(1);
      expect(auditedMetadata(audit)).toMatchObject({ totalOverrideReason: 'Negotiated discount', totalAmount: 450000, actorId: billingActor.id });
    });

    it('accepts a source that matches the latest issued proposal without any override', async () => {
      const { service, prisma, documentVault } = createPaymentService();
      documentVault.findEligibleReference.mockResolvedValue(proposalDocument('Proposal v2 - Summit.pdf') as never);
      prisma.opsProposalVersion.findFirst.mockResolvedValue(proposalVersion('issued'));

      await service.createBillingSource('evt_sample', sourceBody(), billingActor);
      expect(prisma.opsBillingSource.create).toHaveBeenCalledTimes(1);
    });

    it('does not re-judge a keyed retry of an existing source against newer proposals', async () => {
      const { service, prisma, documentVault } = createPaymentService();
      documentVault.findEligibleReference.mockResolvedValue(proposalDocument('Proposal v1 - Summit.pdf') as never);
      prisma.opsProposalVersion.findFirst.mockResolvedValue(proposalVersion('superseded'));
      const body = sourceBody({ idempotencyKey: 'source-key', evidenceOverrideReason: 'Client signed v1 terms' });
      prisma.opsBillingSource.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      await service.createBillingSource('evt_sample', body, billingActor);
      const stored = await prisma.opsBillingSource.create.mock.results[0].value;
      prisma.opsBillingSource.findUnique.mockResolvedValue({ ...stored, payloadHash: null });

      await expect(service.createBillingSource('evt_sample', body, billingActor)).resolves.toBeDefined();
      expect(prisma.opsProposalVersion.findFirst).toHaveBeenCalledTimes(1);
    });

    it('requires a different PMCM admin to approve a source created with a total override', async () => {
      const { service, prisma, audit } = createPaymentService();
      prisma.opsAuditLog.findFirst.mockResolvedValue({ metadata: { actorId: billingActor.id, totalOverrideReason: 'Negotiated discount' } });

      await expect(service.approveBillingSource('evt_sample', 'bsrc_sample', {}, billingActor)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.opsBillingSource.updateMany).not.toHaveBeenCalled();

      const approved = await service.approveBillingSource('evt_sample', 'bsrc_sample', {}, { id: 'user_other', name: 'Other Admin', role: 'pmcm-admin', email: 'other@pmcm.test' });
      expect(approved.status).toBe('approved');
      expect(audit.write).toHaveBeenCalledTimes(1);
    });

    it('lets the creator approve a source that needed no total override', async () => {
      const { service, prisma } = createPaymentService();
      prisma.opsAuditLog.findFirst.mockResolvedValue({ metadata: { actorId: billingActor.id, totalAmount: 100000 } });
      await expect(service.approveBillingSource('evt_sample', 'bsrc_sample', {}, billingActor)).resolves.toMatchObject({ status: 'approved' });
    });

    it('refuses approval that would take approved sources above the latest issued proposal total', async () => {
      const { service, prisma } = createPaymentService();
      prisma.opsProposalVersion.findFirst.mockResolvedValue({ versionNumber: 2, totalAmount: 500000 });
      prisma.opsBillingSource.findMany.mockResolvedValue([{ totalAmount: 450000, billingStatements: [{ status: 'sent' }] }]);

      const refused = service.approveBillingSource('evt_sample', 'bsrc_sample', {}, billingActor);
      await expect(refused).rejects.toBeInstanceOf(BadRequestException);
      await expect(refused).rejects.toThrow(/550000.*Proposal v2 total of 500000.*additional billing/);
      expect(prisma.opsBillingSource.updateMany).not.toHaveBeenCalled();
    });

    it('takes the per-event approval lock before reading approved totals and approving, so simultaneous approvals cannot both fit', async () => {
      const { service, prisma } = createPaymentService();
      prisma.opsProposalVersion.findFirst.mockResolvedValue({ versionNumber: 2, totalAmount: 500000 });

      await service.approveBillingSource('evt_sample', 'bsrc_sample', {}, billingActor);

      const lock = prisma.$executeRaw.mock.invocationCallOrder[0];
      expect(String(prisma.$executeRaw.mock.calls[0][0])).toContain('pg_advisory_xact_lock');
      expect(lock).toBeLessThan(prisma.opsBillingSource.findMany.mock.invocationCallOrder[0]);
      expect(prisma.opsBillingSource.findMany.mock.invocationCallOrder[0]).toBeLessThan(prisma.opsBillingSource.updateMany.mock.invocationCallOrder[0]);
    });

    it('approves within the cap and ignores a source whose statements were all replaced by a correction', async () => {
      const { service, prisma } = createPaymentService();
      prisma.opsProposalVersion.findFirst.mockResolvedValue({ versionNumber: 2, totalAmount: 100000 });
      prisma.opsBillingSource.findMany.mockResolvedValue([{ totalAmount: 90000, billingStatements: [{ status: 'superseded' }] }]);

      await expect(service.approveBillingSource('evt_sample', 'bsrc_sample', {}, billingActor)).resolves.toMatchObject({ status: 'approved' });
    });

    it('does not cap approval when the event has no issued proposal', async () => {
      const { service, prisma } = createPaymentService();
      prisma.opsBillingSource.findMany.mockResolvedValue([{ totalAmount: 900000, billingStatements: [] }]);
      await expect(service.approveBillingSource('evt_sample', 'bsrc_sample', {}, billingActor)).resolves.toMatchObject({ status: 'approved' });
    });
  });

  it('tells the client nothing at generate time and queues the milestone notices when PMCM sends the statement', async () => {
    const { service, prisma, notifications, issued } = createBillingStatementService([]);
    await service.generateBillingStatement('evt_billing_sequence', 'bsrc_billing_sequence', billingActor, verifiedBillingActor);
    expect(notifications.write).not.toHaveBeenCalled();

    const row = issued[0];
    prisma.opsBillingStatement.findUnique.mockResolvedValue({ ...row, sentAt: null } as never);
    prisma.opsBillingStatement.update = vi.fn(async () => ({ ...row, status: 'sent', sentAt: new Date('2026-08-02T00:00:00.000Z') }));
    await service.sendBillingStatement('evt_billing_sequence', row.id, billingActor);

    const keys = notifications.write.mock.calls.map((call) => (call[0] as { idempotencyKey: string }).idempotencyKey);
    expect(keys).toEqual([`billing-send:${row.id}:email`, `billing-send:${row.id}:viber`, `billing-reminder:${row.id}:0`]);
  });

  it('answers a second statement for the same source with a billing conflict while a keyed retry still replays', async () => {
    const { service } = createBillingStatementService([]);
    const generate = (key?: string) => service.generateBillingStatement('evt_billing_sequence', 'bsrc_billing_sequence', billingActor, verifiedBillingActor, key);

    const first = await generate('statement-key');
    const replay = await generate('statement-key');
    expect(replay.id).toBe(first.id);

    for (const key of [undefined, 'another-key']) {
      const duplicate = generate(key);
      await expect(duplicate).rejects.toBeInstanceOf(ConflictException);
      await expect(duplicate).rejects.toThrow('A billing statement already exists for this source.');
    }
  });

  it('rejects a payment mutation without a verified actor before database access', async () => {
    const { paymentService, prisma } = createPaymentService();

    await expect(paymentService.markPayment('evt_sample', 'pay_downpayment', 'paid', undefined as unknown as BillingActor))
      .rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.opsEvent.findUnique).not.toHaveBeenCalled();
    expect(prisma.opsPaymentMilestone.findUnique).not.toHaveBeenCalled();
    expect(prisma.opsPaymentMilestone.update).not.toHaveBeenCalled();
  });
  it('marks upcoming balances at risk and audits only the first successful transition', async () => {
    const { paymentService, prisma, audit, notifications, milestone } = createPaymentService();
    milestone.label = 'Balance';
    prisma.opsPaymentMilestone.findMany.mockImplementation(async () => [{ ...milestone, status: 'partially_paid' }]);

    await paymentService.runPaymentRiskSweep();
    await paymentService.runPaymentRiskSweep();

    expect(milestone.status).toBe('at_risk');
    // The reminder is queue-only and enqueued once, with the same transition that makes the audit row.
    const atRiskReminders = notifications.write.mock.calls.filter((call) =>
      (call[0] as { idempotencyKey?: string }).idempotencyKey === 'payment-risk-reminder:pay_downpayment');
    expect(atRiskReminders).toHaveLength(1);
    expect(atRiskReminders[0]).toEqual([expect.objectContaining({
      eventId: 'evt_sample',
      recipient: 'Client',
    }), undefined]);
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

  it('queues one overdue reminder per unpaid milestone with a stable idempotency key', async () => {
    const { paymentService, prisma, notifications, milestone } = createPaymentService();
    milestone.label = 'Downpayment';
    milestone.status = 'partially_paid';
    milestone.remainingBalance = 75000;

    await paymentService.runPaymentRiskSweep();
    await paymentService.runPaymentRiskSweep();

    const overdueQuery = prisma.opsPaymentMilestone.findMany.mock.calls
      .map(([args]: [{ where: Record<string, unknown> }]) => args.where)
      .find((where: Record<string, unknown>) => 'dueDate' in where);
    expect(overdueQuery).toEqual(expect.objectContaining({
      dueDate: { lt: expect.any(Date) },
      remainingBalance: { gt: 0 },
      status: { not: 'paid' },
    }));
    const overdueWrites = notifications.write.mock.calls.map((call) => call[0] as Record<string, unknown>);
    expect(overdueWrites).toHaveLength(2);
    for (const input of overdueWrites) {
      expect(input).toMatchObject({ eventId: 'evt_sample', recipient: 'Client', idempotencyKey: 'payment-overdue-reminder:pay_downpayment' });
    }
  });

  it('projects client billing disputes without PMCM reasons, resolver notes, or actor names', () => {
    const projected = mapClientBillingDispute({
      id: 'dispute_1', eventId: 'evt_sample', statementId: 'stmt_1', milestoneId: null, amount: 2000,
      reason: 'Internal: client was over-billed on venue hire', status: 'open', raisedBy: 'Francis',
      resolvedBy: null, resolutionNotes: 'Internal note', createdAt: new Date('2026-08-03T00:00:00.000Z'), resolvedAt: null,
    } as never);
    expect(projected).toEqual({
      id: 'dispute_1', eventId: 'evt_sample', statementId: 'stmt_1', milestoneId: null, amount: 2000,
      status: 'open', createdAt: '2026-08-03T00:00:00.000Z', resolvedAt: null,
    });
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
    const { paymentService, prisma, audit, history } = createPaymentService();

    const result = await paymentService.recordPayment(
      'evt_sample',
      'pay_downpayment',
      {
        amountReceived: 25000,
        paymentDate: '2026-06-20',
        paymentMethod: 'Bank Transfer',
        referenceNumber: 'BNK-123',
      },
      billingActor,
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

    const approved = await service.approveBillingSource(
      'evt_sample',
      'bsrc_sample',
      input,
      { id: 'user_maxine', name: 'Maxine', role: 'pmcm-admin', email: 'maxine@pmcm.test', correlationId: 'corr_approval_1' },
    );

    expect(approved.approvedBy).toBe('Maxine');
    await expect(service.approveBillingSource('evt_sample', 'bsrc_sample', {}, billingActor)).rejects.toThrow('already approved');
    expect((await prisma.opsBillingSource.findUnique()).approvedBy).toBe('Maxine');
    expect(audit.write).toHaveBeenCalledTimes(1);
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({
      actor: 'Maxine',
      metadata: expect.objectContaining({ actorId: 'user_maxine', correlationId: 'corr_approval_1' }),
    }), undefined);
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
      billingActor,
      verifiedBillingActor,
    );

    expect(result.number).toBe(expectedNumber);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('attributes billing statement files to the verified actor identity', async () => {
    const storageObjectService = {
      requestUpload: vi.fn(async () => ({
        status: 'ready',
        object: { id: 'obj_billing_statement', lifecycleState: 'requested', providerObjectKey: 'billing-statement.pdf', checksumSha256: 'checksum' },
      })),
      confirmUpload: vi.fn(async () => ({ lifecycleState: 'stored', providerObjectKey: 'billing-statement.pdf' })),
    } as unknown as StorageObjectService;
    const { service } = createBillingStatementService([], undefined, storageObjectService);

    await service.generateBillingStatement('evt_billing_sequence', 'bsrc_billing_sequence', billingActor, verifiedBillingActor);

    expect(storageObjectService.requestUpload).toHaveBeenCalledWith(expect.objectContaining({
      actor: expect.objectContaining({ id: billingActor.id, name: billingActor.name }),
    }));
    expect(storageObjectService.confirmUpload).toHaveBeenCalledWith(expect.objectContaining({
      actor: expect.objectContaining({ id: billingActor.id, name: billingActor.name }),
    }));
  });

  it('uses the stored sequence without rescanning prior statements on subsequent issues', async () => {
    const { service, prisma, otherSourceId } = createBillingStatementService(['BS-2026-0001']);

    const first = await service.generateBillingStatement(
      'evt_billing_sequence',
      'bsrc_billing_sequence',
      billingActor,
      verifiedBillingActor,
    );
    const second = await service.generateBillingStatement(
      'evt_billing_sequence',
      otherSourceId,
      billingActor,
      verifiedBillingActor,
    );

    expect(first.number).toBe('BS-2026-0002');
    expect(second.number).toBe('BS-2026-0003');
    const sequenceScans = prisma.$queryRaw.mock.calls.filter(([parts]: [TemplateStringsArray]) => parts.join(' ').includes('MAX(substring'));
    expect(sequenceScans).toHaveLength(1);
  });

  it('uses a sequence row initialized concurrently by an older server', async () => {
    const { service, prisma } = createBillingStatementService(['BS-2026-0001'], 3);

    const result = await service.generateBillingStatement(
      'evt_billing_sequence',
      'bsrc_billing_sequence',
      billingActor,
      verifiedBillingActor,
    );

    expect(result.number).toBe('BS-2026-0003');
  });

  it('records and audits a payment when the reference number is new', async () => {
    const { paymentService, prisma, audit, history } = createPaymentService();

    const result = await paymentService.recordPayment(
      'evt_sample',
      'pay_downpayment',
      {
        amountReceived: 25000,
        paymentDate: '2026-06-21',
        paymentMethod: 'Bank Transfer',
        referenceNumber: 'BNK-456',
      },
      billingActor,
    );

    expect(prisma.opsPaymentRecord.create).toHaveBeenCalledTimes(1);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_sample',
        actor: 'Finance Operator',
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
    const { paymentService, prisma } = createPaymentService();

    const result = await paymentService.getPaymentStatusForEvent('evt_sample');

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
