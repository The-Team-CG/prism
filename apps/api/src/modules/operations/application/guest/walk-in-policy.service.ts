import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsEvent } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, writeAudit, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { UpdateWalkInPolicyInput, WalkInPolicy } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type WalkInPolicyRead = {
  eventId: string;
  policy: WalkInPolicy;
  threshold: number;
};

@Injectable()
export class WalkInPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  async get(eventId: string): Promise<WalkInPolicyRead> {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return this.map(event);
  }

  async update(eventId: string, input: UpdateWalkInPolicyInput, actor: ResolvedEventOpsActor): Promise<WalkInPolicyRead> {
    let previous: WalkInPolicyRead | undefined;
    return this.workflowCommandService.execute<OpsEvent, WalkInPolicyRead>({
      name: 'walk_in_policy_update',
      eventId,
      sideEffectMode: 'same_tx',
      validateState: async () => {
        const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Event not found');
        previous = this.map(event);
        this.validateThreshold(input);
      },
      validateStateInTransaction: async (context) => {
        await this.lockEvent(context, eventId);
        const event = await context.prisma.opsEvent.findUnique({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Event not found');
        previous = this.map(event);
        this.validateThreshold(input);
      },
      write: (context) => {
        const db = context?.prisma ?? this.prisma;
        return db.opsEvent.update({
          where: { id: eventId },
          data: {
            walkInPolicy: input.policy,
            ...(input.threshold !== undefined ? { walkInThreshold: input.threshold } : {}),
          },
        });
      },
      sideEffects: async (event, context) => {
        const before = previous;
        await writeAudit(this.auditWriter, eventId, actor.name, 'Updated event walk-in policy', {
          actorRole: actor.role,
          category: AuditCategory.Events,
          actionType: AuditActionType.Update,
          affectedType: 'event_walk_in_policy',
          affectedId: eventId,
          affectedLabel: event.eventName,
          metadata: {
            previousPolicy: before?.policy,
            previousThreshold: before?.threshold,
            policy: event.walkInPolicy,
            threshold: event.walkInThreshold,
          },
        }, context ? { ...context, actorId: actor.id } : undefined);
      },
      project: (event) => this.map(event),
    });
  }

  private validateThreshold(input: UpdateWalkInPolicyInput) {
    if (input.policy === 'threshold' && input.threshold === undefined) {
      throw new BadRequestException('A threshold is required when walk-ins use threshold policy');
    }
  }

  private async lockEvent(context: PrismTransactionContext, eventId: string) {
    // QUERY_AUDIT_RAW_SQL: serialize policy changes with check-in commands.
    await context.prisma.$queryRaw`SELECT id FROM event_core.events WHERE id = ${eventId} FOR UPDATE`;
  }

  private map(event: Pick<OpsEvent, 'id' | 'walkInPolicy' | 'walkInThreshold'>): WalkInPolicyRead {
    const policy = event.walkInPolicy as WalkInPolicy;
    if (!['closed', 'open', 'threshold'].includes(policy)) {
      throw new BadRequestException('Event has an invalid walk-in policy');
    }
    return { eventId: event.id, policy, threshold: event.walkInThreshold };
  }
}
