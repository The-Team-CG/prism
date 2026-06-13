import { NotFoundException } from '@nestjs/common';
import type { OpsBriefing, Prisma } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { toPrismaJson } from '@prism/database';
import { randomUUID } from 'node:crypto';
import { AuditCategory } from '../ops.constants';
import { AuditService } from './audit.service';
import { NotificationOutboxService } from './notification-outbox.service';
import { WorkflowCommandService } from './workflow-command.service';

export type SubmitBriefingInput = {
  venue: string;
  guestCount: number;
  budgetRange: string;
  serviceRequirements: string[];
  notes: string;
};

export class ClientOnboardingWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationOutboxService: NotificationOutboxService,
    private readonly workflowCommandService: WorkflowCommandService,
  ) {}

  async submitBriefing(eventId: string, input: SubmitBriefingInput): Promise<OpsBriefing> {
    return this.workflowCommandService.execute<OpsBriefing>({
      name: 'submit_client_briefing',
      eventId,
      validateState: async () => {
        const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Event not found');
      },
      write: () =>
        this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
          this.auditService.audit(eventId, 'Client', 'Submitted client briefing', {
            category: AuditCategory.Events,
            affectedType: 'briefing',
          }),
          this.notificationOutboxService.queue(eventId, 'PMCM Admin', 'Client briefing submitted'),
        ]);
      },
    });
  }
}
