import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActionType, AuditCategory, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, writeAudit, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import {
  guestPrivacyClassificationSchema,
  type GuestPrivacyClassification,
  type PrismGuestPrivacyClassification,
  type UpdateGuestPrivacyClassificationInput,
} from '@prism/types';
import {
  GUEST_PRIVACY_CLASSIFICATION_OWNER,
  OPERATIONS_EVENT_REFERENCE_READER,
  type GuestPrivacyClassificationChange,
  type GuestPrivacyClassificationOwner,
  type GuestPrivacyClassificationSnapshot,
  type OperationsEventReferenceReader,
} from '@prism/contexts/event-lifecycle/operations-reference';

@Injectable()
export class GuestPrivacyClassificationService {
  constructor(
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly eventReferences: OperationsEventReferenceReader,
    @Inject(GUEST_PRIVACY_CLASSIFICATION_OWNER) private readonly classificationOwner: GuestPrivacyClassificationOwner,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  async get(eventId: string): Promise<PrismGuestPrivacyClassification> {
    const event = await this.eventReferences.findGuestCheckInEventReference(eventId);
    if (!event) throw new NotFoundException('Event not found');
    return this.map(event.id, event.guestPrivacyClassification);
  }

  async update(
    eventId: string,
    input: UpdateGuestPrivacyClassificationInput,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismGuestPrivacyClassification> {
    this.parseClassification(input.classification);
    return this.workflowCommandService.execute<GuestPrivacyClassificationChange, PrismGuestPrivacyClassification>({
      name: 'guest_privacy_classification_update',
      eventId,
      sideEffectMode: 'same_tx',
      validateState: async () => {
        const event = await this.eventReferences.findGuestCheckInEventReference(eventId);
        if (!event) throw new NotFoundException('Event not found');
        this.parseClassification(event.guestPrivacyClassification);
      },
      validateStateInTransaction: async () => {
        this.parseClassification(input.classification);
      },
      write: async (context) => {
        if (!context) throw new ConflictException('Transactional guest privacy context is unavailable');
        const change = await this.classificationOwner.updateGuestPrivacyClassification(eventId, input, context);
        if (!change) throw new NotFoundException('Event not found');
        return change;
      },
      sideEffects: async (change, context) => {
        if (change.before.classification === change.after.classification) return;
        await writeAudit(this.auditWriter, eventId, actor.name, 'Updated event guest privacy classification', {
          actorRole: actor.role,
          category: AuditCategory.Events,
          actionType: AuditActionType.Update,
          affectedType: 'event_guest_privacy_classification',
          affectedId: eventId,
          affectedLabel: change.after.eventName,
          metadata: {
            previousClassification: change.before.classification,
            classification: change.after.classification,
          },
        }, context ? { ...context, actorId: actor.id } : undefined);
      },
      project: (change) => this.mapSnapshot(change.after),
    });
  }

  private mapSnapshot(snapshot: GuestPrivacyClassificationSnapshot): PrismGuestPrivacyClassification {
    return this.map(snapshot.eventId, snapshot.classification);
  }

  private map(eventId: string, value: string): PrismGuestPrivacyClassification {
    return { eventId, classification: this.parseClassification(value) };
  }

  private parseClassification(value: string): GuestPrivacyClassification {
    const parsed = guestPrivacyClassificationSchema.safeParse(value);
    if (!parsed.success) throw new BadRequestException('Event has an invalid guest privacy classification');
    return parsed.data;
  }
}
