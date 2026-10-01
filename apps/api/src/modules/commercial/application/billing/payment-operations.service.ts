import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type OpsPaymentMilestone, type OpsPaymentRecord } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { AuditActionType, AuditCategory, WorkflowCommandService } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import type { RecordPaymentInput } from '@prism/types';
import { nextPaymentMilestoneStatus } from '../../domain/payment-terms.policy';
import type { BillingActor } from '../../contracts/billing-operations.types';
import type { PaymentStatusReader } from '../../contracts/payment-status-reader.port';
import { addDays, auditMetadata, isoDate, parseDate, requireBillingActor } from './billing-operations.utils';
import { mapPaymentMilestone, mapPaymentRecord } from './billing-operations.mappers';

function paymentReplay(milestone: OpsPaymentMilestone, history: OpsPaymentRecord[]) {
  const amountPaid = history.reduce((sum, record) => sum + record.amountReceived, 0);
  const remainingBalance = Math.max(0, milestone.amount - amountPaid);
  return {
    payment: {
      ...milestone,
      amountPaid,
      remainingBalance,
      status: remainingBalance === 0 ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'pending',
    },
    history,
  };
}

function isDuplicatePayment(record: OpsPaymentRecord, input: RecordPaymentInput, paymentDate: Date) {
  return record.referenceNumber === (input.referenceNumber?.trim() ?? '')
    && record.amountReceived === input.amountReceived
    && isoDate(record.paymentDate) === isoDate(paymentDate)
    && record.paymentMethod === input.paymentMethod;
}

function assertPaymentWithinBalance(milestone: OpsPaymentMilestone, history: OpsPaymentRecord[], input: RecordPaymentInput) {
  const currentPaid = history.reduce((sum, record) => sum + record.amountReceived, 0);
  if (currentPaid + input.amountReceived > milestone.amount) {
    throw new BadRequestException('Payment record exceeds remaining milestone balance');
  }
}

function assertPositivePayment(amount: number) {
  if (amount <= 0) throw new BadRequestException('Amount received must be greater than zero');
}

function paymentStatus(amountPaid: number, amount: number) {
  if (amountPaid === amount) return 'paid';
  if (amountPaid > 0) return 'partially_paid';
  return 'pending';
}

async function lockPaymentMilestone(tx: Prisma.TransactionClient, milestoneId: string) {
  if (tx.$queryRaw) {
    // QUERY_AUDIT_RAW_SQL: lock the milestone row before applying a payment mutation.
    const rows = await tx.$queryRaw<OpsPaymentMilestone[]>`SELECT * FROM "finance_ops"."payment_milestones" WHERE "id" = ${milestoneId} FOR UPDATE`;
    if (rows.length > 0) return rows[0];
  }
  return tx.opsPaymentMilestone.findUnique({ where: { id: milestoneId } });
}

@Injectable()
export class PaymentOperationsService implements PaymentStatusReader {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    private readonly workflowCommandService: WorkflowCommandService,
  ) {}

  async runPaymentRiskSweep() {
    const now = new Date();
    const threshold = addDays(now, 2);
    const events = await this.prisma.opsEvent.findMany({
      where: {
        archived: false,
        eventDate: {
          gte: now,
          lte: threshold,
        },
      },
      select: { id: true, eventName: true },
    });

    const eventIds = events.map((event) => event.id);
    const milestones = eventIds.length === 0
      ? []
      : await this.prisma.opsPaymentMilestone.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: [{ eventId: 'asc' }, { dueDate: 'asc' }, { id: 'asc' }],
        });
    const milestonesByEventId = new Map<string, OpsPaymentMilestone[]>();
    for (const milestone of milestones) {
      const eventMilestones = milestonesByEventId.get(milestone.eventId) ?? [];
      eventMilestones.push(milestone);
      milestonesByEventId.set(milestone.eventId, eventMilestones);
    }

    for (const event of events) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: two-day payment risk window.
      const balance = (milestonesByEventId.get(event.id) ?? []).find((milestone) =>
        milestone.label.toLowerCase().includes('balance'),
      );
      if (!balance || balance.status === 'paid' || balance.remainingBalance <= 0 || balance.status === 'at_risk') {
        continue;
      }

      await this.workflowCommandService.execute<{ count: number }>({
        name: 'mark_payment_at_risk',
        eventId: event.id,
        sideEffectMode: 'same_tx',
        write: (transactionContext) =>
          (transactionContext?.prisma ?? this.prisma).opsPaymentMilestone.updateMany({
            where: {
              id: balance.id,
              eventId: event.id,
              status: { notIn: ['paid', 'at_risk'] },
              remainingBalance: { gt: 0 },
            },
            data: { status: 'at_risk' },
          }),
        sideEffects: async ({ count }, transactionContext?: PrismTransactionContext) => {
          if (count === 0) return;
          await writeAudit(this.auditWriter, event.id, 'System', `Payment at risk for ${event.eventName}`, {
            category: AuditCategory.Finance,
            actionType: AuditActionType.Update,
            affectedType: 'payment_milestone',
            affectedId: balance.id,
            affectedLabel: balance.label,
            severity: 'warning',
          }, transactionContext);
        },
      });
    }
  }

  async markPayment(eventId: string, milestoneId: string, status: string, actor: BillingActor) {
    actor = requireBillingActor(actor);
    let milestone: OpsPaymentMilestone | null = null;
    return this.workflowCommandService.execute<OpsPaymentMilestone, ReturnType<typeof mapPaymentMilestone>>({
      name: 'mark_payment',
      eventId,
      validateState: async () => {
        await this.requireEvent(eventId);
        milestone = await this.prisma.opsPaymentMilestone.findUnique({ where: { id: milestoneId } });
        if (!milestone || milestone.eventId !== eventId) throw new NotFoundException('Payment milestone not found');
        status = nextPaymentMilestoneStatus({ current: milestone.status, amountPaid: milestone.amountPaid, amount: milestone.amount, requested: status });
      },
      write: () =>
        this.prisma.opsPaymentMilestone
          .update({
            where: { id: milestoneId },
            data: { status },
          })
          .catch(() => {
            throw new NotFoundException('Payment milestone not found');
          }),
      sideEffects: async (payment) => {
        await Promise.all([
          writeAudit(this.auditWriter, eventId, actor.name, `Marked ${payment.label} as ${status}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            category: AuditCategory.Finance,
            actionType: AuditActionType.Update,
            affectedType: 'payment_milestone',
            affectedId: payment.id,
            affectedLabel: payment.label,
            metadata: auditMetadata(actor),
          }),
          writeNotification(this.notificationOutboxWriter, eventId, 'Finance', `${payment.label} ${status}`),
        ]);
      },
      project: (payment) => mapPaymentMilestone(payment),
    });
  }

  async recordPayment(
    eventId: string,
    milestoneId: string,
    input: RecordPaymentInput,
    actor: BillingActor,
  ) {
    actor = requireBillingActor(actor);
    let milestone: OpsPaymentMilestone | null = null;
    let paymentDate: Date | null = null;
    let paymentPayloadHash = '';
    let duplicateReplay: { payment: OpsPaymentMilestone; history: OpsPaymentRecord[] } | null = null;

    return this.workflowCommandService.execute<
      { payment: OpsPaymentMilestone; history: OpsPaymentRecord[] },
      ReturnType<typeof mapPaymentMilestone>
    >({
      name: 'record_payment',
      eventId,
      validateState: async () => {
        await this.requireEvent(eventId);

        milestone = await this.prisma.opsPaymentMilestone.findUnique({ where: { id: milestoneId } });
        if (!milestone || milestone.eventId !== eventId) {
          throw new NotFoundException('Payment milestone not found');
        }

        assertPositivePayment(input.amountReceived);

        paymentDate = parseDate(input.paymentDate);
        paymentPayloadHash = createHash('sha256').update(JSON.stringify({ eventId, milestoneId, ...input })).digest('hex');
      },
      write: async () => {
        const recordedPaymentDate = paymentDate ?? parseDate(input.paymentDate);
        paymentDate = recordedPaymentDate;

        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const lockedMilestone = await lockPaymentMilestone(tx, milestoneId);
          if (!lockedMilestone || lockedMilestone.eventId !== eventId) throw new NotFoundException('Payment milestone not found');
          milestone = lockedMilestone;
          const history = await tx.opsPaymentRecord.findMany({ where: { milestoneId }, orderBy: { paymentDate: 'asc' } });
          const keyedRecord = input.idempotencyKey ? await tx.opsPaymentRecord.findUnique({ where: { idempotencyKey: input.idempotencyKey } }) : null;
          if (keyedRecord) {
            if (keyedRecord.payloadHash && keyedRecord.payloadHash !== paymentPayloadHash) throw new BadRequestException('Payment idempotency key was reused for different content');
            duplicateReplay = paymentReplay(lockedMilestone, history);
            return duplicateReplay;
          }
          const duplicateRecord = input.referenceNumber?.trim() ? history.find((record) => isDuplicatePayment(record, input, recordedPaymentDate)) : undefined;
          if (duplicateRecord) {
            duplicateReplay = paymentReplay(lockedMilestone, history);
            return duplicateReplay;
          }
          assertPaymentWithinBalance(lockedMilestone, history, input);
          await tx.opsPaymentRecord.create({
            data: {
              id: `payrec_${randomUUID()}`,
              eventId,
              milestoneId,
              amountReceived: input.amountReceived,
              paymentDate: recordedPaymentDate,
              paymentMethod: input.paymentMethod,
              referenceNumber: input.referenceNumber ?? '',
              idempotencyKey: input.idempotencyKey ?? null,
              payloadHash: paymentPayloadHash,
            },
          });

          const updatedHistory = await tx.opsPaymentRecord.findMany({
            where: { milestoneId },
            orderBy: { paymentDate: 'asc' },
          });
          const amountPaid = updatedHistory.reduce((sum, record) => sum + record.amountReceived, 0);
          const remainingBalance = Math.max(0, lockedMilestone.amount - amountPaid);
          const nextStatus = paymentStatus(amountPaid, lockedMilestone.amount);
          const payment = await tx.opsPaymentMilestone.update({
            where: { id: milestoneId },
            data: { amountPaid, remainingBalance, status: nextStatus },
          });

          return { payment, history: updatedHistory };
        });
      },
      sideEffects: async ({ payment }) => {
        if (duplicateReplay) return;
        await writeAudit(this.auditWriter, eventId, actor.name, `Recorded ${input.paymentMethod} payment for ${payment.label}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Finance,
          actionType: AuditActionType.Create,
          affectedType: 'payment_milestone',
          affectedId: milestoneId,
          affectedLabel: payment.label,
          metadata: auditMetadata(actor, {
            amountReceived: input.amountReceived,
            referenceNumber: input.referenceNumber ?? '',
          }),
        });
      },
      project: ({ payment, history }) => mapPaymentMilestone(payment, history),
    });
  }

  async getPaymentStatusForEvent(eventId: string) {
    await this.requireEvent(eventId);
    const [milestones, records] = await Promise.all([
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.opsPaymentRecord.findMany({ where: { eventId }, orderBy: { recordedAt: 'desc' } }),
    ]);

    const mappedMilestones = milestones.map((payment) =>
      mapPaymentMilestone(
        payment,
        records.filter((record) => record.milestoneId === payment.id),
      ),
    );

    return {
      eventId,
      milestones: mappedMilestones,
      paymentRecords: records.map((record) => mapPaymentRecord(record)),
      counts: {
        paid: mappedMilestones.filter((payment) => payment.status === 'paid').length,
        pending: mappedMilestones.filter((payment) => payment.status !== 'paid').length,
        atRisk: mappedMilestones.filter((payment) => payment.status === 'at_risk').length,
      },
    };
  }

  private async requireEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }
}
