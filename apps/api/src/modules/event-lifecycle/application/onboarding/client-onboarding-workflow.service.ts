import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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
    private readonly workflowCommandService: WorkflowCommandService,
    private readonly eventAccessPolicyService?: EventAccessPolicyService,
  ) {}

  async submitBriefing(eventId: string, input: SubmitBriefingInput, actor?: ResolvedEventOpsActor): Promise<OpsBriefing> {
    if (actor) {
      if (!this.eventAccessPolicyService) throw new ForbiddenException('Briefing actor context is unavailable');
      await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client, OpsUserRole.PmcmAdmin, OpsUserRole.System], 'client briefing', eventId);
      const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: true } });
      if (!event) throw new NotFoundException('Event not found');
      await this.eventAccessPolicyService.requireCanReadEvent(actor, event, 'client briefing');
      if (actor.role === OpsUserRole.Client && actor.email?.trim().toLowerCase() !== event.inquiry.email.trim().toLowerCase()) {
        throw new ForbiddenException('Only the primary client contact can submit the briefing');
      }
    }
    return this.workflowCommandService.execute<OpsBriefing>({
      name: 'submit_client_briefing',
      eventId,
      validateState: async () => {
        const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Event not found');
      },
      write: () =>
        this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          await tx.opsBriefing.deleteMany({ where: { eventId } });
          const saved = await tx.opsBriefing.create({
            data: {
              id: `brief_${randomUUID()}`,
              eventId,
              venue: input.venue,
              guestCount: input.guestCount,
              budgetRange: input.budgetRange,
              serviceRequirements: toPrismaJson(input.serviceRequirements),
              notes: input.notes,
            },
          });
          await tx.opsEvent.update({
            where: { id: eventId },
            data: { readiness: 'Supplier quotes pending', status: 'planning' },
          });
          return saved;
        }),
      sideEffects: async () => {
        await Promise.all([
          writeAudit(this.auditWriter, eventId, 'Client', 'Submitted client briefing', {
            category: AuditCategory.Events,
            affectedType: 'briefing',
          }),
          writeNotification(this.notificationOutboxWriter, eventId, 'PMCM Admin', 'Client briefing submitted'),
        ]);
      },
    });
  }
}
