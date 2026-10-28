import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, EventLifecycleService, EventLifecycleStage, OpsUserRole } from '@prism/kernel/event-core';
import type { StartEventDayResult } from '@prism/types';

@Injectable()
export class EventDayStartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    private readonly lifecycle: EventLifecycleService,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
  ) {}

  async start(eventId: string, actor: ResolvedEventOpsActor): Promise<StartEventDayResult> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'start event day', eventId);
    return this.prisma.$transaction<StartEventDayResult>(async (tx) => {
      // QUERY_AUDIT_RAW_SQL: serialize the stage transition with other event lifecycle commands.
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.events WHERE id = ${eventId} FOR UPDATE`;
      const event = await tx.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: { select: { conformeSignedAt: true, email: true } } } });
      if (!event) throw new NotFoundException('Event not found');
      await this.access.requireCanReadEvent(actor, event, 'start event day');
      if (event.archived || event.actualEndedAt || ['cancelled', 'postponed', 'date_to_be_confirmed', 'archived'].includes(event.status)) {
        throw new BadRequestException('This event cannot start event day in its current state');
      }
      const result: StartEventDayResult = { eventId, status: 'event_day' };
      if (event.status === 'event_day') return result;
      if (event.clientPortalStatus !== 'unlocked' || !event.inquiry.conformeSignedAt) {
        throw new BadRequestException('Complete the signed conforme and unlock the event before starting event day');
      }
      if (event.floorPlanStatus !== 'approved') {
        throw new BadRequestException('Approve the official floorplan before starting event day');
      }
      this.lifecycle.assertCanTransition(this.lifecycle.stageForEvent(event), EventLifecycleStage.EventDay);
      await tx.opsEvent.update({ where: { id: eventId }, data: { status: 'event_day', readiness: 'Event day in progress' } });
      await writeAudit(this.audit, eventId, actor.name, 'Started event day', {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Events,
        affectedType: 'event', affectedId: eventId, metadata: { previousStatus: event.status, status: 'event_day', floorPlanStatus: event.floorPlanStatus },
      }, { prisma: tx, correlationId: `event-day-start:${eventId}`, actorId: actor.id });
      return result;
    }, { isolationLevel: 'Serializable' });
  }
}
