import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActionType, AuditCategory, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, writeAudit, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { WalkInPolicy, UpdateWalkInPolicyInput } from '@prism/types';
import {
  OPERATIONS_EVENT_REFERENCE_READER,
  WALK_IN_POLICY_OWNER,
  type OperationsEventReferenceReader,
  type WalkInPolicyChange,
  type OperationsEventReference,
  type WalkInPolicyOwner,
  type WalkInPolicySnapshot,
} from '@prism/contexts/event-lifecycle/operations-reference';

export type WalkInPolicyRead = {
  eventId: string;
  policy: WalkInPolicy;
  threshold: number;
};

@Injectable()
export class WalkInPolicyService {
  constructor(
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly eventReferences: OperationsEventReferenceReader,
    @Inject(WALK_IN_POLICY_OWNER) private readonly policyOwner: WalkInPolicyOwner,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  async get(eventId: string): Promise<WalkInPolicyRead> {
    const event = await this.eventReferences.findOperationsEvent(eventId);
    if (!event) throw new NotFoundException('Event not found');
    return this.map(event);
  }

  async update(eventId: string, input: UpdateWalkInPolicyInput, actor: ResolvedEventOpsActor): Promise<WalkInPolicyRead> {
    return this.workflowCommandService.execute<WalkInPolicyChange, WalkInPolicyRead>({
      name: 'walk_in_policy_update',
      eventId,
      sideEffectMode: 'same_tx',
      validateState: async () => {
        const event = await this.eventReferences.findOperationsEvent(eventId);
        if (!event) throw new NotFoundException('Event not found');
        this.validateThreshold(input);
      },
      validateStateInTransaction: async () => {
        this.validateThreshold(input);
      },
      write: async (context) => {
        if (!context) throw new ConflictException('Transactional walk-in policy context is unavailable');
        const change = await this.policyOwner.updateWalkInPolicy(eventId, input, context);
        if (!change) throw new NotFoundException('Event not found');
        return change;
      },
      sideEffects: async (change, context) => {
        await writeAudit(this.auditWriter, eventId, actor.name, 'Updated event walk-in policy', {
          actorRole: actor.role,
          category: AuditCategory.Events,
          actionType: AuditActionType.Update,
          affectedType: 'event_walk_in_policy',
          affectedId: eventId,
          affectedLabel: change.after.eventName,
          metadata: {
            previousPolicy: change.before.policy,
            previousThreshold: change.before.threshold,
            policy: change.after.policy,
            threshold: change.after.threshold,
          },
        }, context ? { ...context, actorId: actor.id } : undefined);
      },
      project: (change) => this.mapSnapshot(change.after),
    });
  }

  private validateThreshold(input: UpdateWalkInPolicyInput) {
    if (input.policy === 'threshold' && input.threshold === undefined) {
      throw new BadRequestException('A threshold is required when walk-ins use threshold policy');
    }
  }

  private map(event: Pick<OperationsEventReference, 'id' | 'walkInPolicy' | 'walkInThreshold'>): WalkInPolicyRead {
    const policy = event.walkInPolicy as WalkInPolicy;
    if (!['closed', 'open', 'threshold'].includes(policy)) {
      throw new BadRequestException('Event has an invalid walk-in policy');
    }
    return { eventId: event.id, policy, threshold: event.walkInThreshold };
  }

  private mapSnapshot(snapshot: WalkInPolicySnapshot): WalkInPolicyRead {
    const policy = snapshot.policy as WalkInPolicy;
    if (!['closed', 'open', 'threshold'].includes(policy)) {
      throw new BadRequestException('Event has an invalid walk-in policy');
    }
    return { eventId: snapshot.eventId, policy, threshold: snapshot.threshold };
  }
}