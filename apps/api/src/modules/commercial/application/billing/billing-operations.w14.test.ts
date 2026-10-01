import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import type { CommandReceiptRecord, CommandReceiptStore } from '@prism/kernel/event-core';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { createBillingSourceSchema, createBillingDisputeSchema, requestBillingCorrectionSchema, waiveAdditionalBillingSchema } from '@prism/types';
import { BillingAdjustmentService } from './billing-adjustment.service';
import { nextPaymentMilestoneStatus, validatePaymentTerms } from '../../domain/payment-terms.policy';

const actor = { id: 'actor_francis', name: 'Francis', role: OpsUserRole.PmcmAdmin, email: 'francis@pmcm.test' };

function createW14Service(withReceipts = false) {
  const event = { id: 'evt_w14', inquiryId: 'inq_w14', eventName: 'W14 Event', clientName: 'Client', eventDate: new Date('2026-08-01T00:00:00.000Z'), actualEndedAt: new Date('2026-08-02T00:00:00.000Z') };
  const statement = { id: 'stmt_w14', eventId: event.id, number: 'BS-2026-0001', totalAmount: 100000, status: 'issued' };
  const correction = { id: 'corr_w14', eventId: event.id, statementId: statement.id, reason: 'Tax line is incorrect', correctedTotalAmount: 95000, status: 'pending', requestedBy: actor.name, resolvedBy: null, resolutionNotes: null, createdAt: new Date('2026-08-03T00:00:00.000Z'), resolvedAt: null };
  const dispute = { id: 'dispute_w14', eventId: event.id, statementId: statement.id, milestoneId: null, amount: 20000, reason: 'Unapproved charge', status: 'open', raisedBy: actor.name, resolvedBy: null, resolutionNotes: null, createdAt: new Date('2026-08-03T00:00:00.000Z'), resolvedAt: null };
  const additional = { id: 'addbill_w14', eventId: event.id, urgentIssueId: 'issue_w14', description: 'Overtime equipment', amount: 5000, status: 'issued', createdBy: actor.name, waiverReason: null, waivedBy: null, createdAt: new Date('2026-08-03T00:00:00.000Z'), waivedAt: null };
  let correctionCreated = false;
  let disputeCreated = false;
  let additionalCreated = false;
  const prisma: any = {
    opsEvent: { findUnique: vi.fn(async () => event) },
    opsInquiry: { findUnique: vi.fn(async () => ({ clientName: event.clientName, email: 'client@example.test' })) },
    opsBillingStatement: { findUnique: vi.fn(async () => statement) },
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
    opsUrgentIssue: { findUnique: vi.fn(async () => ({ id: 'issue_w14', eventId: event.id })) },
    opsAdditionalBilling: {
      findUnique: vi.fn(async ({ where }: any) => where.idempotencyKey ? (additionalCreated ? additional : null) : additional),
      create: vi.fn(async ({ data }: any) => { additionalCreated = true; return Object.assign(additional, data); }),
      update: vi.fn(async ({ data }: any) => Object.assign(additional, data)),
    },
  };
  const audit = { write: vi.fn() };
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
  const transactionRunner = {
    run: vi.fn(async (work: (context: PrismTransactionContext) => Promise<unknown>) => work({ prisma, correlationId: 'receipt_w14', actorId: actor.id })),
  };
  const workflow = withReceipts
    ? new WorkflowCommandService(transactionRunner as never, receiptStore)
    : new WorkflowCommandService();
  const service = new BillingAdjustmentService(prisma, audit as any, workflow);
  return { service, prisma, audit, statement, correction, dispute, additional, receiptStore, transactionRunner };
}

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
    await service.resolveBillingCorrection('evt_w14', correction.id, { action: 'approve' }, actor);
    await expect(service.resolveBillingCorrection('evt_w14', correction.id, { action: 'reject', resolutionNotes: 'Already approved' }, actor)).rejects.toBeInstanceOf(BadRequestException);
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

  it('requires a reason for waiver and only waives issued additional billing', async () => {
    const { service, additional } = createW14Service();
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
