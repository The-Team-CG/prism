import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsEvent } from '@prisma/client';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { PrismaService } from '@prism/kernel/database';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { SetClientEventDayViewInput } from '@prism/types';

type ClientEventDayViewRecord = Pick<OpsEvent, 'id' | 'clientEventDayViewEnabled'>;

@Injectable()
export class ClientEventDayViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    private readonly workflowCommandService: WorkflowCommandService,
  ) {}

  async setClientEventDayView(
    eventId: string,
    input: SetClientEventDayViewInput,
    actor: ResolvedEventOpsActor,
  ) {
    let previousEnabled = false;

    return this.workflowCommandService.execute<
      ClientEventDayViewRecord,
      { eventId: string; enabled: boolean }
    >({
      name: 'set_client_event_day_view',
      eventId,
      sideEffectMode: 'same_tx',
      validatePermission: () =>
        this.eventAccessPolicyService.requireActorRole(
          actor,
          [OpsUserRole.PmcmAdmin],
          'client event-day visibility',
          eventId,
        ),
      validateState: async () => {
        const event = await this.prisma.opsEvent.findUnique({
          where: { id: eventId },
          select: { id: true, clientEventDayViewEnabled: true },
        });
        if (!event) throw new NotFoundException('Event not found');
        previousEnabled = event.clientEventDayViewEnabled;
      },
      validateStateInTransaction: async ({ prisma }) => {
        const event = await prisma.opsEvent.findUnique({
          where: { id: eventId },
          select: { id: true, clientEventDayViewEnabled: true },
        });
        if (!event) throw new NotFoundException('Event not found');
        previousEnabled = event.clientEventDayViewEnabled;
      },
      write: (context) =>
        (context?.prisma ?? this.prisma).opsEvent.update({
          where: { id: eventId },
          data: { clientEventDayViewEnabled: input.enabled },
          select: { id: true, clientEventDayViewEnabled: true },
        }),
      sideEffects: async (event, context) => {
        await writeAudit(
          this.auditWriter,
          eventId,
          actor.name,
          'Updated client event-day visibility',
          {
            actorRole: actor.role,
            actorEmail: actor.email,
            category: AuditCategory.Events,
            actionType: AuditActionType.Update,
            affectedType: 'event',
            affectedId: eventId,
            affectedLabel: 'Client event-day view',
            metadata: {
              previousEnabled,
              enabled: event.clientEventDayViewEnabled,
            },
          },
          context,
        );
      },
      project: (event) => ({
        eventId: event.id,
        enabled: event.clientEventDayViewEnabled,
      }),
    });
  }
}
