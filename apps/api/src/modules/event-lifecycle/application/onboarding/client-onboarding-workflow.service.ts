import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsBriefing, Prisma } from '@prisma/client';
import type { SubmitBriefingInput } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import { toPrismaJson } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import { AuditCategory, WorkflowCommandService } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';

export type { SubmitBriefingInput } from '@prism/types';

@Injectable()
export class ClientOnboardingWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    _workflowCommandService: WorkflowCommandService,
    private readonly eventAccessPolicyService?: EventAccessPolicyService,
  ) {}

  async submitBriefing(eventId: string, input: SubmitBriefingInput, actor?: ResolvedEventOpsActor): Promise<OpsBriefing> {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: true } });
      if (!event) throw new NotFoundException('Event not found');
      if (event.archived || event.clientPortalStatus === 'locked' || !['briefing', 'briefing_proposal', 'planning'].includes(event.status)) {
        throw new BadRequestException('Briefings can only be submitted to an unlocked event before event day');
      }
      await this.authorizeBriefing(event, actor);
      const saved = await tx.opsBriefing.create({ data: {
        id: `brief_${randomUUID()}`, eventId, venue: input.venue,
        guestCount: input.guestCount, budgetRange: input.budgetRange,
        serviceRequirements: toPrismaJson(input.serviceRequirements), notes: input.notes,
        confirmedDate: input.confirmedDate ? new Date(input.confirmedDate) : null,
        confirmedStartTime: input.confirmedStartTime ?? null,
        confirmedEndTime: input.confirmedEndTime ?? null,
        program: toPrismaJson(input.program), moodAndStyling: input.moodAndStyling ?? '', stylingBudget: input.stylingBudget ?? null,
      } });
      await tx.opsEvent.update({ where: { id: eventId }, data: { readiness: 'Supplier quotes pending', status: 'planning' } });
      const context = { prisma: tx, correlationId: saved.id };
      await writeAudit(this.auditWriter, eventId, actor?.name ?? 'System', 'Submitted client briefing', {
        actorRole: actor?.role ?? OpsUserRole.System, actorEmail: actor?.email,
        category: AuditCategory.Events, affectedType: 'briefing', affectedId: saved.id,
        metadata: { actorId: actor?.id ?? null, historyPreserved: true },
      }, context);
      await writeNotification(this.notificationOutboxWriter, eventId, 'PMCM Admin', 'Client briefing submitted', undefined, { idempotencyKey: `briefing:${saved.id}` }, context);
      return saved;
    }, { isolationLevel: 'Serializable' });
  }

  private async authorizeBriefing(event: Prisma.OpsEventGetPayload<{ include: { inquiry: true } }>, actor?: ResolvedEventOpsActor) {
    if (actor) {
      if (!this.eventAccessPolicyService) throw new ForbiddenException('Briefing actor context is unavailable');
      await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client, OpsUserRole.PmcmAdmin, OpsUserRole.System], 'client briefing', event.id);
      await this.eventAccessPolicyService.requireCanReadEvent(actor, event, 'client briefing');
      if (actor.role === OpsUserRole.Client && actor.email?.trim().toLowerCase() !== event.inquiry.email.trim().toLowerCase()) {
        throw new ForbiddenException('Only the primary client contact can submit the briefing');
      }
    }
  }
}
