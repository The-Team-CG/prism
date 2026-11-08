import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import type { PrismAddendum, WithdrawAddendumInput } from '@prism/types';
import { mapAddendum } from './addendum.mappers';

/**
 * PMCM closes a pending addendum with a reason. A withdrawn addendum never applies its commercial effect, and no billing
 * or quote row is written here. Withdrawal is refused once the addendum is effective.
 */
@Injectable()
export class AddendumWithdrawalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notifications: NotificationOutboxWriter,
  ) {}

  async withdraw(eventId: string, addendumId: string, input: WithdrawAddendumInput, actor: ResolvedEventOpsActor): Promise<PrismAddendum> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'addendum withdrawal', eventId);
    return this.prisma.$transaction(async (tx) => {
      // QUERY_AUDIT_RAW_SQL: the addendum row lock serializes withdrawal with signing, countersignature, and conforme requests.
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.addenda WHERE id = ${addendumId} FOR UPDATE`;
      const addendum = await tx.opsAddendum.findFirst({
        where: { id: addendumId, eventId },
        include: { conformeExecution: true, event: { include: { inquiry: true } } },
      });
      if (!addendum) throw new NotFoundException('Addendum not found');
      if (addendum.status !== 'pending') {
        throw new ConflictException(addendum.status === 'effective'
          ? 'An effective addendum cannot be withdrawn; its commercial effect has been applied'
          : 'This addendum has already been withdrawn');
      }
      const execution = addendum.conformeExecution;
      if (execution?.status === 'completed') throw new ConflictException('An addendum with a completed conforme cannot be withdrawn');

      const reason = input.reason;
      const closed = await tx.opsAddendum.updateMany({
        where: { id: addendumId, eventId, status: 'pending' },
        data: { status: 'withdrawn', withdrawnAt: new Date(), withdrawnBy: actor.name, withdrawalReason: reason },
      });
      if (closed.count !== 1) throw new ConflictException('This addendum changed before the withdrawal was recorded; reload and try again');

      if (execution) {
        const voided = await tx.opsAddendumConformeExecution.updateMany({
          where: { id: execution.id, status: { in: ['awaiting_client', 'awaiting_pmcm'] } },
          data: { status: 'withdrawn' },
        });
        if (voided.count !== 1) throw new ConflictException('The addendum conforme changed before the withdrawal was recorded; reload and try again');
        await writeNotification(this.notifications, eventId, addendum.event.inquiry.email,
          `Addendum v${addendum.versionNumber} (${addendum.title}) was withdrawn by PMCM and will not take effect. Reason: ${reason}`,
          'email', {}, { prisma: tx, correlationId: `addendum-withdrawn:${addendum.id}` });
      }

      await writeAudit(this.audit, eventId, actor.name, 'Withdrew addendum', {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Documents,
        affectedType: 'addendum', affectedId: addendum.id,
        metadata: { versionNumber: addendum.versionNumber, reason, previousStatus: 'pending', conformeStatusBefore: execution?.status ?? null, commercialEffect: 'none' },
      }, { prisma: tx, correlationId: addendum.id, actorId: actor.id });

      const value = await tx.opsAddendum.findUniqueOrThrow({
        where: { id: addendum.id },
        include: { conformeExecution: { include: { signatures: true } } },
      });
      return mapAddendum(value);
    }, { isolationLevel: 'Serializable' });
  }
}
