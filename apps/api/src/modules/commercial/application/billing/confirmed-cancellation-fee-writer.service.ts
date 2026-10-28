import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { toPrismaJson } from '@prism/kernel/database';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { createBillingSourceSchema } from '@prism/types';
import type { BillingActor } from '../../contracts/billing-operations.types';
import type { ConfirmedCancellationFeeWriter } from '../../contracts/confirmed-cancellation-fee-writer.port';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { mapBillingSource } from './billing-operations.mappers';

@Injectable()
export class ConfirmedCancellationFeeWriterService implements ConfirmedCancellationFeeWriter {
  constructor(
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  private requireFeeActor(actor: BillingActor) {
    if (!actor.id?.trim() || !actor.name?.trim() || (actor.role !== OpsUserRole.PmcmAdmin && actor.role !== OpsUserRole.System)) {
      throw new ForbiddenException('Only a verified PMCM actor can create a cancellation fee source');
    }
  }

  private validateFeeInput(input: Parameters<ConfirmedCancellationFeeWriter['createConfirmedCancellationFeeSource']>[1]) {
    if (!Number.isSafeInteger(input.amount) || input.amount < 0) throw new BadRequestException('Cancellation fee must be a non-negative whole amount');
    if (!input.reason.trim() || !input.idempotencyKey.trim()) throw new BadRequestException('A cancellation fee needs a reason and idempotency key');
    if (input.sourceDocumentId) throw new BadRequestException('Cancellation fee evidence must be linked through the confirmed decision record');
  }

  async createConfirmedCancellationFeeSource(
    eventId: string,
    input: { amount: number; reason: string; idempotencyKey: string; sourceDocumentId?: string },
    actor: BillingActor,
    transaction: PrismTransactionContext,
  ) {
    this.requireFeeActor(actor);
    this.validateFeeInput(input);

    const db = transaction.prisma;
    const event = await db.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, eventDate: true } });
    if (!event) throw new NotFoundException('Event not found');
    if (input.amount === 0) return null;

    const payload = createBillingSourceSchema.safeParse({
      sourceType: 'cancellation_fee',
      sourceLabel: `Confirmed cancellation fee: ${input.reason.trim()}`,
      lineItems: [{ label: input.reason.trim(), amount: input.amount }],
      paymentSchedule: [{ label: 'Cancellation fee', percentage: 100, dueDate: new Date().toISOString().slice(0, 10) }],
      idempotencyKey: input.idempotencyKey,
    });
    if (!payload.success) throw new BadRequestException('Cancellation fee source is invalid');
    const payloadHash = createHash('sha256').update(JSON.stringify({ eventId, amount: input.amount, reason: input.reason.trim() })).digest('hex');
    const existing = await db.opsBillingSource.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.eventId !== eventId || existing.payloadHash !== payloadHash) throw new BadRequestException('Cancellation fee idempotency key was reused with different content');
      return mapBillingSource(existing);
    }

    const now = new Date();
    const source = await db.opsBillingSource.create({
      data: {
        id: `bsrc_${randomUUID()}`,
        eventId,
        sourceType: 'cancellation_fee',
        sourceLabel: payload.data.sourceLabel,
        sourceDocumentId: null,
        lineItems: toPrismaJson(payload.data.lineItems),
        paymentSchedule: toPrismaJson(payload.data.paymentSchedule),
        paymentMethods: toPrismaJson(payload.data.paymentMethods ?? []),
        totalAmount: input.amount,
        status: 'approved',
        approvedAt: now,
        approvedBy: actor.name,
        approvalNotes: 'PMCM confirmed through the cancellation decision workflow',
        paymentTermsPolicyState: 'standard',
        paymentTermsOverrideReason: null,
        paymentTermsApprovedBy: null,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
      },
    });
    await writeAudit(this.auditWriter, eventId, actor.name, 'Created confirmed cancellation fee source', {
      actorRole: actor.role,
      actorEmail: actor.email,
      category: AuditCategory.Finance,
      actionType: AuditActionType.Create,
      affectedType: 'billing_source',
      affectedId: source.id,
      affectedLabel: source.sourceLabel,
      metadata: { amount: input.amount, idempotencyKey: input.idempotencyKey, confirmation: 'PMCM cancellation decision' },
    }, transaction);
    return mapBillingSource(source);
  }
}
