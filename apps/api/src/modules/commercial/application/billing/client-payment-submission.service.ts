import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { AUDIT_WRITER, EventAccessPolicyService, scopeActorToEvent, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, STORED_RECEIPT_EVIDENCE_READER, writeNotification, type NotificationOutboxWriter, type StoredReceiptEvidenceReader } from '@prism/contexts/platform-ops';
import { readEventAccessScope } from '@prism/contexts/read-models/event-scope';
import type { AttachPaymentReceiptEvidenceInput, PrismPaymentSubmission, PrismVerifiedEventActor, SubmitClientPaymentInput } from '@prism/types';
import { normalizeReference } from '../../domain/payment-receipt.policy';
import { parseDate } from './billing-operations.utils';
import { findLiveReferenceReceipt } from './payment-ledger.store';
import { StatementOfAccountService } from './statement-of-account.service';

type ClientActor = { id: string; name: string; email?: string; role: string };

/**
 * A client telling PMCM they paid, with proof. The money is held to be checked and is never applied here: PMCM verifies
 * it against the bank or wallet statement and applies it. The client sees it on their statement as being checked.
 */
@Injectable()
export class ClientPaymentSubmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: EventAccessPolicyService,
    private readonly statements: StatementOfAccountService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Optional() @Inject(STORED_RECEIPT_EVIDENCE_READER) private readonly evidenceReader?: StoredReceiptEvidenceReader,
    @Optional() @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notifications?: NotificationOutboxWriter,
  ) {}

  async submit(eventId: string, input: SubmitClientPaymentInput, verifiedActor: PrismVerifiedEventActor): Promise<PrismPaymentSubmission> {
    const { actor, eventName } = await this.requireClient(eventId, verifiedActor);
    const payloadHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const referenceNumber = input.referenceNumber.trim();
    const referenceKey = normalizeReference(referenceNumber);
    const receiptId = await this.prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const keyed = await tx.opsPaymentReceipt.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, payloadHash: true } });
        if (keyed) {
          if (keyed.payloadHash && keyed.payloadHash !== payloadHash) throw new BadRequestException('This payment was already sent with different details');
          return keyed.id;
        }
      }
      const statement = await tx.opsBillingStatement.findFirst({ where: { eventId, sentAt: { not: null } }, select: { id: true } });
      if (!statement) throw new ConflictException('PMCM has not sent your billing statement yet');
      if (input.milestoneId) {
        const milestone = await tx.opsPaymentMilestone.findFirst({ where: { id: input.milestoneId, eventId, supersededAt: null, statement: { is: { sentAt: { not: null } } } }, select: { id: true } });
        if (!milestone) throw new NotFoundException('That payment is not on your statement');
      }
      if (referenceKey && (await findLiveReferenceReceipt(tx, input.method, referenceKey))) {
        throw new ConflictException('PMCM already has a payment with this reference. If it is not on your statement yet, message PMCM.');
      }
      const created = await tx.opsPaymentReceipt.create({
        data: {
          id: `prcp_${randomUUID()}`,
          amount: input.amount,
          receivedDate: parseDate(input.paidDate),
          method: input.method,
          referenceNumber,
          referenceKey,
          payerName: actor.name,
          eventId,
          notes: input.note?.trim() ?? '',
          source: 'client',
          intendedMilestoneId: input.milestoneId ?? null,
          recordedBy: actor.name,
          recordedById: actor.id,
          idempotencyKey: input.idempotencyKey ?? null,
          payloadHash,
        },
      });
      await writeAudit(this.auditWriter, eventId, actor.name, `Client reported a ${created.method} payment of PHP ${created.amount.toLocaleString('en-PH')}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        category: AuditCategory.Finance,
        actionType: AuditActionType.Create,
        affectedType: 'payment_receipt',
        affectedId: created.id,
        affectedLabel: referenceNumber,
        metadata: { actorId: actor.id, amount: created.amount, referenceNumber, intendedMilestoneId: created.intendedMilestoneId },
      }, { prisma: tx, actorId: actor.id, correlationId: `client-payment:${created.id}` });
      await this.tellPmcm(created, actor, eventName, { prisma: tx, actorId: actor.id, correlationId: `client-payment:${created.id}` });
      return created.id;
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('PMCM already has a payment with this reference. If it is not on your statement yet, message PMCM.');
      }
      throw error;
    });
    return this.submissionFor(eventId, eventName, receiptId);
  }

  /** Bind the proof the client uploaded for a payment they reported and PMCM has not checked yet. */
  async attachProof(eventId: string, receiptId: string, input: AttachPaymentReceiptEvidenceInput, verifiedActor: PrismVerifiedEventActor): Promise<PrismPaymentSubmission> {
    const { actor, eventName } = await this.requireClient(eventId, verifiedActor);
    const reader = this.evidenceReader;
    if (!reader) throw new ServiceUnavailableException('Evidence storage is unavailable');
    const receipt = await this.prisma.opsPaymentReceipt.findFirst({ where: { id: receiptId, eventId, source: 'client' }, select: { id: true, status: true, referenceNumber: true } });
    if (!receipt) throw new NotFoundException('Payment not found');
    if (receipt.status !== 'recorded') throw new ConflictException('PMCM has already checked this payment');
    const evidence = await reader.findConfirmedReceiptEvidence({ eventId, receiptId, objectId: input.objectId });
    if (!evidence) throw new BadRequestException('That file was not uploaded as proof for this payment, or it has not finished uploading');
    await this.prisma.$transaction(async (tx) => {
      await tx.opsPaymentReceipt.update({ where: { id: receiptId }, data: { evidenceObjectId: input.objectId } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Client attached proof to payment ${receipt.referenceNumber || receipt.id}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        category: AuditCategory.Finance,
        actionType: AuditActionType.Update,
        affectedType: 'payment_receipt',
        affectedId: receiptId,
        affectedLabel: receipt.referenceNumber,
        metadata: { actorId: actor.id, objectId: input.objectId, fileName: evidence.fileName },
      }, { prisma: tx, actorId: actor.id, correlationId: `client-payment-proof:${receiptId}` });
    });
    return this.submissionFor(eventId, eventName, receiptId);
  }

  /** PMCM hears about a reported payment, with a link straight to it on the receipts desk. */
  private async tellPmcm(receipt: { id: string; eventId: string | null; amount: number; method: string; referenceNumber: string }, actor: ClientActor, eventName: string, context: PrismTransactionContext) {
    if (!this.notifications || !receipt.eventId) return;
    await writeNotification(this.notifications, receipt.eventId, 'PMCM Admin', `${actor.name} reported a ₱${receipt.amount.toLocaleString('en-PH')} ${receipt.method} payment for ${eventName} (ref ${receipt.referenceNumber}). Check it against the bank or wallet statement.`, undefined, {
      idempotencyKey: `client-payment-reported:${receipt.id}`, action: { kind: 'payment_receipt', receiptId: receipt.id },
    }, context);
  }

  private async requireClient(eventId: string, verifiedActor: PrismVerifiedEventActor): Promise<{ actor: ClientActor; eventName: string }> {
    const resolved = this.policy.resolveEventScopedActor(verifiedActor);
    const scope = await readEventAccessScope(this.prisma, eventId);
    if (!scope) throw new NotFoundException('Event not found');
    const scoped = scopeActorToEvent(resolved, scope);
    if (scoped.actor.role !== OpsUserRole.Client) throw new ForbiddenException('Only the client reports their own payments');
    await this.policy.requireCanReadEvent(scoped.actor, scope, 'payment submission', scoped.scope);
    const actor = scoped.actor;
    if (!actor.id?.trim() || !actor.name?.trim()) throw new ForbiddenException('Verified client is required');
    return { actor: { id: actor.id, name: actor.name, email: actor.email, role: actor.role }, eventName: scope.eventName };
  }

  private async submissionFor(eventId: string, eventName: string, receiptId: string): Promise<PrismPaymentSubmission> {
    const statement = await this.statements.buildStatement(eventId, eventName, 'client');
    const submission = statement.submissions.find((item) => item.id === receiptId);
    if (!submission) throw new NotFoundException('Payment not found');
    return submission;
  }
}
