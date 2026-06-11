import { NotFoundException } from '@nestjs/common';
import type { OpsEvent } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { toPrismaJson } from '@prism/database';
import { AuditActionType, AuditCategory } from '../ops.constants';
import { AuditService } from './audit.service';
import { EventLifecycleService } from './event-lifecycle.service';
import { FileRequirementsMatrixService } from './file-requirements-matrix.service';
import { NotificationOutboxService } from './notification-outbox.service';
import { WorkflowCommandService } from './workflow-command.service';

export type ArchiveEventInput = {
  overrideReason?: string;
  actorName?: string;
};

export class EventClosureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileRequirementsMatrixService: FileRequirementsMatrixService,
    private readonly eventLifecycleService: EventLifecycleService,
    private readonly auditService: AuditService,
    private readonly notificationOutboxService: NotificationOutboxService,
    private readonly workflowCommandService: WorkflowCommandService,
  ) {}

  async closeGates(eventId: string) {
    await this.requireEvent(eventId);
    return this.fileRequirementsMatrixService.closeGates(eventId);
  }

  async archiveEvent(eventId: string, input: ArchiveEventInput = {}) {
    const actorName = input.actorName?.trim() || 'PMCM Admin';
    let closeGates = await this.closeGates(eventId);
    const overrideReason = input.overrideReason?.trim();

    return this.workflowCommandService.execute<OpsEvent>({
      name: 'archive_event',
      eventId,
      validateState: async () => {
        const event = await this.requireEvent(eventId);
        this.eventLifecycleService.assertCanArchive(event, closeGates, overrideReason);
      },
      write: () =>
        this.prisma.opsEvent
          .update({
            where: { id: eventId },
            data: {
              archived: true,
              archivedAt: new Date(),
              archiveOverrideReason: overrideReason || null,
              archiveOverrideBy: overrideReason ? actorName : null,
              archiveChecklist: toPrismaJson(closeGates),
              status: 'archived',
              readiness: 'Closed',
            },
          })
          .catch(() => {
            throw new NotFoundException('Event not found');
          }),
      sideEffects: async (event) => {
        closeGates = await this.closeGates(eventId).catch(() => closeGates);
        await Promise.all([
          this.auditService.audit(eventId, actorName, overrideReason ? 'Archived event with override' : 'Archived event', {
            actionType: AuditActionType.Archive,
            category: AuditCategory.Events,
            severity: overrideReason ? 'warning' : 'info',
            metadata: { overrideReason, missingKeys: closeGates.missingKeys, gates: closeGates.gates },
          }),
          this.notificationOutboxService.queue(eventId, event.clientName, 'Event workspace archived'),
        ]);
      },
    });
  }

  private async requireEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }
}
