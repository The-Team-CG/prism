import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import type { CommandReceiptRecord, CommandReceiptStore } from '@prism/kernel/event-core';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PostEventLifecycleState } from '@prism/contexts/event-lifecycle/post-event-reference';
import { createAdditionalBillingSchema, createBillingSourceSchema, createBillingDisputeSchema, requestBillingCorrectionSchema, waiveAdditionalBillingSchema } from '@prism/types';
import { BillingAdjustmentService } from './billing-adjustment.service';
import { nextPaymentMilestoneStatus, validatePaymentTerms } from '../../domain/payment-terms.policy';

const actor = { id: 'actor_francis', name: 'Francis', role: OpsUserRole.PmcmAdmin, email: 'francis@pmcm.test' };
const approver = { id: 'actor_mys', name: 'Ms. Mys', role: OpsUserRole.PmcmAdmin, email: 'mys@pmcm.test' };

function createW14Service(withReceipts = false, withPaidHistory = false) {
  const event = { id: 'evt_w14', inquiryId: 'inq_w14', eventName: 'W14 Event', clientName: 'Client', eventDate: new Date('2026-08-01T00:00:00.000Z'), actualEndedAt: new Date('2026-08-02T00:00:00.000Z') };
  const statement = { id: 'stmt_w14', eventId: event.id, sourceId: 'bsrc_w14', number: 'BS-2026-0001', totalAmount: 100000, status: 'issued', paymentSchedule: [{ label: 'Deposit', percentage: 50, amount: 50000, dueDate: '2026-07-01' }, { label: 'Balance', percentage: 50, amount: 50000, dueDate: '2026-07-15' }], paymentMethods: [], lineItems: [] };
  const correction = { id: 'corr_w14', eventId: event.id, statementId: statement.id, reason: 'Tax line is incorrect', correctedTotalAmount: 95000, status: 'pending', requestedBy: actor.name, resolvedBy: null, resolutionNotes: null, createdAt: new Date('2026-08-03T00:00:00.000Z'), resolvedAt: null };
  const oldMilestones = withPaidHistory ? [{ id: 'pay_original', eventId: event.id, statementId: statement.id, label: 'Deposit', amount: 50000, amountPaid: 20000, creditApplied: 0, remainingBalance: 30000, percentage: 50, dueDate: new Date('2026-07-01T00:00:00.000Z'), status: 'partially_paid', createdAt: new Date('2026-06-01T00:00:00.000Z'), supersededAt: null }] : [];
  const newMilestones = withPaidHistory ? [
    { id: 'pay_replacement_deposit', eventId: event.id, statementId: 'bill_replacement', label: 'Deposit', amount: 47500, amountPaid: 0, creditApplied: 0, remainingBalance: 47500, percentage: 50, dueDate: new Date('2026-07-01T00:00:00.000Z'), status: 'pending', createdAt: new Date('2026-08-04T00:00:00.000Z'), supersededAt: null },
    { id: 'pay_replacement_balance', eventId: event.id, statementId: 'bill_replacement', label: 'Balance', amount: 47500, amountPaid: 0, creditApplied: 0, remainingBalance: 47500, percentage: 50, dueDate: new Date('2026-07-15T00:00:00.000Z'), status: 'pending', createdAt: new Date('2026-08-04T00:00:00.000Z'), supersededAt: null },
  ] : [];
  const paymentRecords = withPaidHistory ? [{ id: 'payrec_original', eventId: event.id, milestoneId: 'pay_original', amountReceived: 20000, paymentDate: new Date('2026-06-20T00:00:00.000Z'), paymentMethod: 'Bank Transfer', referenceNumber: 'BNK-123', recordedAt: new Date('2026-06-20T01:00:00.000Z') }] : [];
  const dispute = { id: 'dispute_w14', eventId: event.id, statementId: statement.id, milestoneId: null, amount: 20000, reason: 'Unapproved charge', status: 'open', raisedBy: actor.name, resolvedBy: null, resolutionNotes: null, createdAt: new Date('2026-08-03T00:00:00.000Z'), resolvedAt: null };
  const billingSources = new Map([
    ['bsrc_w14', { id: 'bsrc_w14', eventId: event.id, status: 'approved', sourceDocumentId: null }],
    ['bsrc_pending_w14', { id: 'bsrc_pending_w14', eventId: event.id, status: 'pending' }],
    ['bsrc_foreign_w14', { id: 'bsrc_foreign_w14', eventId: 'evt_other', status: 'approved' }],
  ]);
  const additional = { id: 'addbill_w14', eventId: event.id, urgentIssueId: 'issue_w14', description: 'Overtime equipment', amount: 5000, status: 'issued', createdBy: actor.name, waiverReason: null, waivedBy: null, createdAt: new Date('2026-08-03T00:00:00.000Z'), waivedAt: null };
  let correctionCreated = false;
  let disputeCreated = false;
  let additionalCreated = false;
  const prisma: any = {
    opsEvent: { findUnique: vi.fn(async () => event) },
    opsInquiry: { findUnique: vi.fn(async () => ({ clientName: event.clientName, email: 'client@example.test' })) },
    opsBillingStatement: { findUnique: vi.fn(async () => statement), count: vi.fn(async () => 1), update: vi.fn(async ({ data }: any) => Object.assign(statement, data)) },
    opsBillingCorrection: {
      findUnique: vi.fn(async ({ where }: any) => where.idempotencyKey ? (correctionCreated ? correction : null) : correction),
      create: vi.fn(async ({ data }: any) => { correctionCreated = true; return Object.assign(correction, data); }),
      update: vi.fn(async ({ data }: any) => Object.assign(correction, data)),
    },
    opsBillingDispute: {
      findUnique: vi.fn(async ({ where }: any) => where.idempotencyKey ? (disputeCreated ? dispute : null) : dispute),
      create: vi.fn(async ({ data }: any) => { disputeCreated = true; return Object.assign(dispute, data); }),
      update: vi.fn(async ({ data }: any) => Object.assign(dispute, data)),
    },

    opsBillingSource: {
      findUnique: vi.fn(async ({ where }: any) => billingSources.get(where.id) ?? null),
    },
    opsPaymentMilestone: {
      findMany: vi.fn(async ({ where }: any = {}) => where?.statementId === 'bill_replacement' ? newMilestones : where?.statementId === statement.id ? oldMilestones : where?.statementId === null ? oldMilestones : []),
      updateMany: vi.fn(async ({ where, data }: any) => { const rows = oldMilestones.filter((row) => where.id.in.includes(row.id)); rows.forEach((row) => Object.assign(row, data)); return { count: rows.length }; }),
      update: vi.fn(async ({ where, data }: any) => { const row = newMilestones.find((item) => item.id === where.id); if (row) Object.assign(row, data); return row; }),
    },
    opsPaymentRecord: { findMany: vi.fn(async ({ where }: any) => paymentRecords.filter((record) => where.milestoneId.in.includes(record.milestoneId))) },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work(prisma)),
    opsAdditionalBilling: {
      findUnique: vi.fn(async ({ where }: any) => where.idempotencyKey ? (additionalCreated ? additional : null) : additional),
      create: vi.fn(async ({ data }: any) => { additionalCreated = true; return Object.assign(additional, data); }),
      update: vi.fn(async ({ data }: any) => Object.assign(additional, data)),
    },
  };
  const audit = { write: vi.fn() };
  const postEventStateReader = {
    findPostEventState: vi.fn(async (eventId: string): Promise<PostEventLifecycleState | null> => eventId === event.id
      ? { eventId: event.id, actualEndedAt: event.actualEndedAt }
      : null),
  };
  const urgentIssueReferenceReader = {
    findUrgentIssueForEvent: vi.fn(async (eventId: string, issueId: string) =>
      eventId === event.id && issueId === 'issue_w14' ? { id: issueId, eventId } : null),
  };
  const savedReceipts = new Map<string, CommandReceiptRecord>();
  const receiptStore: CommandReceiptStore = {
    find: vi.fn(async (key) => savedReceipts.get(`${key.commandName}:${key.idempotencyKey}:${key.actorId}:${key.eventScope}`) ?? null),
    create: vi.fn(async (input) => {
      const id = 'receipt_w14';
      savedReceipts.set(`${input.commandName}:${input.idempotencyKey}:${input.actorId}:${input.eventScope}`, {
        ...input,
        id,
        eventId: input.eventId ?? null,
        payloadHash: input.payloadHash ?? null,
        result: null,
        completedAt: new Date(),
      });
      return { id };
    }),
    complete: vi.fn(async (id, result) => {
      const receipt = [...savedReceipts.values()].find((value) => value.id === id);
      if (receipt) receipt.result = result;
    }),
  };
  const transactionContext: PrismTransactionContext = { prisma, correlationId: 'receipt_w14', actorId: actor.id };
  const transactionRunner = {
    run: vi.fn(async (work: (context: PrismTransactionContext) => Promise<unknown>) => work(transactionContext)),
  };
  const workflow = withReceipts
    ? new WorkflowCommandService(transactionRunner as never, receiptStore)
    : new WorkflowCommandService();
  const billingOperationsService = {
    createBillingSource: vi.fn(async () => ({ id: 'bsrc_replacement', eventId: event.id, status: 'approved' })),
    approveBillingSource: vi.fn(async () => ({ id: 'bsrc_replacement', eventId: event.id, status: 'approved' })),
    generateBillingStatement: vi.fn(async () => ({ id: 'bill_replacement', eventId: event.id })),
  };
  const service = new BillingAdjustmentService(prisma, audit as never, workflow, postEventStateReader as never, urgentIssueReferenceReader as never, billingOperationsService as never);
  return { service, prisma, audit, statement, correction, dispute, additional, receiptStore, transactionRunner, transactionContext, postEventStateReader, urgentIssueReferenceReader, billingOperationsService, oldMilestones, newMilestones, paymentRecords, billingSources };
}

const verifiedApprover = { id: approver.id, actorId: approver.id, actorRole: OpsUserRole.PmcmAdmin, actorName: approver.name, actorEmail: approver.email, name: approver.name, email: approver.email, role: OpsUserRole.PmcmAdmin, eventId: 'evt_w14', expiresAt: '2026-10-04T12:00:00.000Z' } as never;

describe('W14 billing operations', () => {
  it('requires a reasoned policy override and preserves line item totals', async () => {
    expect(() => createBillingSourceSchema.parse({ sourceLabel: 'Proposal', lineItems: [{ label: 'Venue', amount: 100000 }], paymentTermsPolicy: 'repeat_client_override' })).toThrow();
    const terms = validatePaymentTerms({ schedule: [{ label: 'Downpayment', percentage: 40 }, { label: 'Balance', percentage: 60 }], policy: 'repeat_client_override', overrideReason: 'Repeat client with approved credit terms' });
    expect(terms).toEqual({ state: 'repeat_client_override', overrideReason: 'Repeat client with approved credit terms' });
  });

  it('persists a correction, replays duplicate command, and rejects a second resolution', async () => {
    const { service, prisma, correction } = createW14Service();
    const input = requestBillingCorrectionSchema.parse({ statementId: 'stmt_w14', reason: 'Tax line is incorrect', correctedTotalAmount: 95000, idempotencyKey: 'corr-key' });
    const first = await service.requestBillingCorrection('evt_w14', input, actor);
    const replay = await service.requestBillingCorrection('evt_w14', input, actor);
    expect(first.id).toBe(replay.id);
    expect(prisma.opsBillingCorrection.create).toHaveBeenCalledTimes(1);
    await service.resolveBillingCorrection('evt_w14', correction.id, { action: 'approve' }, approver, verifiedApprover);
    await expect(service.resolveBillingCorrection('evt_w14', correction.id, { action: 'reject', resolutionNotes: 'Already approved' }, approver)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('retains original payment records and carries paid credit into corrected active milestones', async () => {
    const { service, statement, correction, oldMilestones, newMilestones, paymentRecords } = createW14Service(false, true);
    await service.requestBillingCorrection('evt_w14', requestBillingCorrectionSchema.parse({ statementId: statement.id, reason: 'Corrected package total', correctedTotalAmount: 95000, idempotencyKey: 'corr-reconcile-key' }), actor);

    const resolved = await service.resolveBillingCorrection('evt_w14', correction.id, { action: 'approve' }, approver, verifiedApprover);

    expect(resolved.replacementStatementId).toBe('bill_replacement');
    expect(statement.status).toBe('superseded');
    expect(oldMilestones[0]).toMatchObject({ status: 'superseded', amountPaid: 20000, supersededAt: expect.any(Date) });
    expect(paymentRecords).toHaveLength(1);
    expect(newMilestones.map((milestone) => milestone.creditApplied)).toEqual([20000, 0]);
    expect(newMilestones.filter((milestone) => !milestone.supersededAt).reduce((sum, milestone) => sum + milestone.amount, 0)).toBe(95000);
    expect(newMilestones.reduce((sum, milestone) => sum + milestone.amountPaid, 0)).toBe(20000);
  });

  it('refuses an overpayment correction or missing actor before approving, and preserves approved repeat-client terms', async () => {
    const { service, correction, statement, billingSources, billingOperationsService } = createW14Service(false, true);
    correction.correctedTotalAmount = 10000;
    await expect(service.resolveBillingCorrection('evt_w14', correction.id, { action: 'approve' }, approver, verifiedApprover)).rejects.toThrow('below the amount already received');
    expect(correction.status).toBe('pending');
    expect(billingOperationsService.generateBillingStatement).not.toHaveBeenCalled();
    correction.correctedTotalAmount = 95000;
    await expect(service.resolveBillingCorrection('evt_w14', correction.id, { action: 'approve' }, approver)).rejects.toThrow('Verified actor context');
    expect(correction.status).toBe('pending');
    Object.assign(billingSources.get('bsrc_w14')!, { paymentTermsPolicyState: 'repeat_client_override', paymentTermsOverrideReason: 'Approved repeat client' });
    statement.paymentSchedule = [{ label: 'Deposit', percentage: 30, amount: 30000, dueDate: '2026-07-01' }, { label: 'Balance', percentage: 70, amount: 70000, dueDate: '2026-07-15' }];
    await service.resolveBillingCorrection('evt_w14', correction.id, { action: 'approve' }, approver, verifiedApprover);
    expect(billingOperationsService.createBillingSource).toHaveBeenCalledWith('evt_w14', expect.objectContaining({ paymentTermsPolicy: 'repeat_client_override', paymentTermsOverrideReason: 'Approved repeat client' }), approver, expect.anything());
    expect(correction.status).toBe('approved');
  });

  it('refuses self-approval with nothing written, then lets a different PMCM user approve', async () => {
    const { service, prisma, audit, correction } = createW14Service();
    const input = requestBillingCorrectionSchema.parse({ statementId: 'stmt_w14', reason: 'Tax line is incorrect', correctedTotalAmount: 95000, idempotencyKey: 'corr-self-approve-key' });
    const requested = await service.requestBillingCorrection('evt_w14', input, actor);
    expect(requested.requestedById).toBe(actor.id);
    const auditWritesBefore = audit.write.mock.calls.length;

    await expect(service.resolveBillingCorrection('evt_w14', correction.id, { action: 'approve' }, actor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.opsBillingCorrection.update).not.toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledTimes(auditWritesBefore);
    expect(correction.status).toBe('pending');

    await expect(service.resolveBillingCorrection('evt_w14', correction.id, { action: 'approve' }, approver, verifiedApprover))
      .resolves.toMatchObject({ status: 'approved', resolvedBy: approver.name, replacementStatementId: 'bill_replacement' });
  });

  it('lets the requester withdraw their own pending correction by rejecting it', async () => {
    const { service, correction } = createW14Service();
    const input = requestBillingCorrectionSchema.parse({ statementId: 'stmt_w14', reason: 'Tax line is incorrect', idempotencyKey: 'corr-withdraw-key' });
    await service.requestBillingCorrection('evt_w14', input, actor);

    await expect(service.resolveBillingCorrection('evt_w14', correction.id, { action: 'reject', resolutionNotes: 'Withdrawn by requester' }, actor))
      .resolves.toMatchObject({ status: 'rejected', resolvedBy: actor.name });
  });

  it('falls back to the requester name for legacy corrections without a requester id', async () => {
    const { service, correction } = createW14Service();
    Object.assign(correction, { requestedBy: actor.name, requestedById: null });

    await expect(service.resolveBillingCorrection('evt_w14', correction.id, { action: 'approve' }, actor)).rejects.toBeInstanceOf(ForbiddenException);
    correction.correctedTotalAmount = 95000;
    await expect(service.resolveBillingCorrection('evt_w14', correction.id, { action: 'approve' }, approver, verifiedApprover)).resolves.toMatchObject({ status: 'approved', replacementStatementId: 'bill_replacement' });
  });

  it('replays a billing command from the central receipt before its table lookup', async () => {
    const { service, prisma, receiptStore, transactionRunner } = createW14Service(true);
    const input = requestBillingCorrectionSchema.parse({ statementId: 'stmt_w14', reason: 'Tax line is incorrect', correctedTotalAmount: 95000, idempotencyKey: 'central-corr-key' });

    const first = await service.requestBillingCorrection('evt_w14', input, actor);
    const replay = await service.requestBillingCorrection('evt_w14', input, actor);

    expect(replay).toEqual(first);
    expect(receiptStore.create).toHaveBeenCalledTimes(1);
    expect(receiptStore.complete).toHaveBeenCalledTimes(1);
    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
    expect(prisma.opsBillingCorrection.create).toHaveBeenCalledTimes(1);
    expect(prisma.opsBillingCorrection.findUnique).toHaveBeenCalledTimes(1);
  });

  it('validates dispute amount, lifecycle, and idempotent replay', async () => {
    const { service, prisma, dispute } = createW14Service();
    const input = createBillingDisputeSchema.parse({ statementId: 'stmt_w14', amount: 20000, reason: 'Unapproved charge', idempotencyKey: 'dispute-key' });
    const first = await service.createBillingDispute('evt_w14', input, actor);
    const replay = await service.createBillingDispute('evt_w14', input, actor);
    expect(first.id).toBe(replay.id);
    expect(prisma.opsBillingDispute.create).toHaveBeenCalledTimes(1);
    await expect(service.createBillingDispute('evt_w14', { ...input, amount: 100001, idempotencyKey: 'other-dispute' }, actor)).rejects.toBeInstanceOf(BadRequestException);
    await service.resolveBillingDispute('evt_w14', dispute.id, { action: 'resolve', resolutionNotes: 'Reviewed source line' }, actor);
    await expect(service.resolveBillingDispute('evt_w14', dispute.id, { action: 'reject', resolutionNotes: 'Too late' }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('traces additional billing to an approved same-event source and refuses pending or foreign sources', async () => {
    const { service, prisma } = createW14Service();
    const base = { urgentIssueId: 'issue_w14', description: 'Approved overtime', amount: 5000 };
    expect(() => createAdditionalBillingSchema.parse({ ...base, idempotencyKey: 'no-source' })).toThrow();

    for (const billingSourceId of ['bsrc_pending_w14', 'bsrc_foreign_w14', 'bsrc_missing_w14']) {
      const input = createAdditionalBillingSchema.parse({ ...base, billingSourceId, idempotencyKey: `untraced-${billingSourceId}` });
      await expect(service.createAdditionalBilling('evt_w14', input, actor)).rejects.toThrow(/[Bb]illing source/);
    }
    expect(prisma.opsAdditionalBilling.create).not.toHaveBeenCalled();

    const approved = createAdditionalBillingSchema.parse({ ...base, billingSourceId: 'bsrc_w14', idempotencyKey: 'traced-approved' });
    const created = await service.createAdditionalBilling('evt_w14', approved, actor);
    expect(created).toMatchObject({ billingSourceId: 'bsrc_w14', amount: 5000 });
    expect(prisma.opsAdditionalBilling.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ billingSourceId: 'bsrc_w14' }) }));
  });

  it('rejects additional billing when Lifecycle has no recorded event end', async () => {
    const { service, prisma, postEventStateReader, urgentIssueReferenceReader } = createW14Service();
    postEventStateReader.findPostEventState.mockResolvedValue({ eventId: 'evt_w14', actualEndedAt: null });
    const input = createAdditionalBillingSchema.parse({
      billingSourceId: 'bsrc_w14',
      urgentIssueId: 'issue_w14',
      description: 'Approved overtime',
      amount: 5000,
      idempotencyKey: 'additional-billing-before-event-end',
    });

    await expect(service.createAdditionalBilling('evt_w14', input, actor))
      .rejects.toThrow('Post-event additional billing requires a recorded event end');

    expect(urgentIssueReferenceReader.findUrgentIssueForEvent).not.toHaveBeenCalled();
    expect(prisma.opsAdditionalBilling.create).not.toHaveBeenCalled();
  });

  it('rejects additional billing if event eligibility disappears before the transaction writes', async () => {
    const { service, prisma, transactionContext, postEventStateReader, urgentIssueReferenceReader } = createW14Service(true);
    postEventStateReader.findPostEventState
      .mockResolvedValueOnce({ eventId: 'evt_w14', actualEndedAt: new Date('2026-08-02T00:00:00.000Z') })
      .mockResolvedValueOnce(null);
    const input = createAdditionalBillingSchema.parse({
      billingSourceId: 'bsrc_w14',
      urgentIssueId: 'issue_w14',
      description: 'Approved overtime',
      amount: 5000,
      idempotencyKey: 'additional-billing-event-vanished',
    });

    await expect(service.createAdditionalBilling('evt_w14', input, actor)).rejects.toThrow('Event not found');

    expect(postEventStateReader.findPostEventState).toHaveBeenNthCalledWith(2, 'evt_w14', transactionContext);
    expect(urgentIssueReferenceReader.findUrgentIssueForEvent).toHaveBeenCalledTimes(1);
    expect(prisma.opsAdditionalBilling.create).not.toHaveBeenCalled();
  });
  it('validates post-event and issue ownership again inside the billing transaction', async () => {
    const { service, prisma, transactionContext, transactionRunner, postEventStateReader, urgentIssueReferenceReader } = createW14Service(true);
    const input = createAdditionalBillingSchema.parse({
      billingSourceId: 'bsrc_w14',
      urgentIssueId: 'issue_w14',
      description: 'Approved overtime',
      amount: 5000,
      idempotencyKey: 'additional-billing-owner-check',
    });

    const result = await service.createAdditionalBilling('evt_w14', input, actor);

    expect(result).toMatchObject({ eventId: 'evt_w14', urgentIssueId: 'issue_w14', amount: 5000 });
    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
    expect(postEventStateReader.findPostEventState).toHaveBeenNthCalledWith(2, 'evt_w14', transactionContext);
    expect(urgentIssueReferenceReader.findUrgentIssueForEvent).toHaveBeenNthCalledWith(2, 'evt_w14', 'issue_w14', transactionContext);
    expect(prisma.opsAdditionalBilling.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an issue that disappears before the owner-checked billing transaction writes', async () => {
    const { service, prisma, transactionContext, urgentIssueReferenceReader } = createW14Service(true);
    urgentIssueReferenceReader.findUrgentIssueForEvent
      .mockResolvedValueOnce({ id: 'issue_w14', eventId: 'evt_w14' })
      .mockResolvedValueOnce(null);
    const input = createAdditionalBillingSchema.parse({
      billingSourceId: 'bsrc_w14',
      urgentIssueId: 'issue_w14',
      description: 'Approved overtime',
      amount: 5000,
      idempotencyKey: 'additional-billing-stale-issue',
    });

    await expect(service.createAdditionalBilling('evt_w14', input, actor)).rejects.toThrow('Urgent issue not found');

    expect(urgentIssueReferenceReader.findUrgentIssueForEvent).toHaveBeenNthCalledWith(2, 'evt_w14', 'issue_w14', transactionContext);
    expect(prisma.opsAdditionalBilling.create).not.toHaveBeenCalled();
  });

  it('requires a reason for waiver and only waives issued additional billing', async () => {
    const { service, additional } = createW14Service();
    expect(() => waiveAdditionalBillingSchema.parse({ reason: '   ' })).toThrow();
    const input = waiveAdditionalBillingSchema.parse({ reason: 'PMCM goodwill approved by finance owner' });
    await service.waiveAdditionalBilling('evt_w14', additional.id, input, actor);
    expect(additional.status).toBe('waived');
    await expect(service.waiveAdditionalBilling('evt_w14', additional.id, input, actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces milestone transition invariants', () => {
    expect(nextPaymentMilestoneStatus({ current: 'partially_paid', amountPaid: 100, amount: 100, requested: 'paid' })).toBe('paid');
    expect(() => nextPaymentMilestoneStatus({ current: 'pending', amountPaid: 50, amount: 100, requested: 'pending' })).toThrow(BadRequestException);
    expect(() => nextPaymentMilestoneStatus({ current: 'paid', amountPaid: 100, amount: 100, requested: 'at_risk' })).toThrow(BadRequestException);
  });

});
