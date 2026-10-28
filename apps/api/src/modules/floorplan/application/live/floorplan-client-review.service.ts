import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { CreateClientFloorPlanAnnotationInput, DecideClientFloorPlanInput } from '@prism/types';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { isPrimaryClientContact } from '@prism/contexts/commercial';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { FLOORPLAN_EVENT_REFERENCE_READER, type FloorplanEventReferenceReader } from '@prism/contexts/event-lifecycle/floorplan-reference';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { FloorPlanWorkflowService } from './floor-plan-workflow.service';

const decisionEffects = {
  approve: { audit: 'Client approved submitted floorplan snapshot', action: AuditActionType.Approve, notification: 'Client approved floorplan' },
  request_revision: { audit: 'Client requested floorplan revision', action: AuditActionType.Update, notification: 'Client requested a floorplan revision' },
};

@Injectable()
export class FloorPlanClientReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    @Inject(FLOORPLAN_EVENT_REFERENCE_READER) private readonly lifecycleEventReferences: FloorplanEventReferenceReader,
    private readonly floorPlanWorkflowService: FloorPlanWorkflowService,
  ) {}

  private requireRevisionAllowed(input: DecideClientFloorPlanInput, freezeStatus: string, draftStatus: string) {
    if (input.action !== 'request_revision') return;
    if (freezeStatus === 'frozen') throw new BadRequestException('Frozen events cannot receive floorplan revision requests');
    if (draftStatus !== 'in_review') throw new BadRequestException('Only a floorplan in review can receive a revision request');
  }

  async getReview(eventId: string, draftId: string, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client, OpsUserRole.PmcmAdmin], 'client floorplan review', eventId);
    const { event, draft, snapshot, snapshotHash } = await this.loadSnapshot(this.prisma, eventId, draftId);
    await this.eventAccessPolicyService.requireCanReadEvent(actor, event, 'client floorplan review');
    if (actor.role === OpsUserRole.Client) this.requirePrimaryContact(actor, event.inquiry.email);
    const [decisions, annotations] = await Promise.all([
      this.prisma.opsFloorPlanClientDecision.findMany({
        where: { eventId, draftId, snapshotHash, ...(actor.role === OpsUserRole.Client ? { actorId: actor.id } : {}) },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 100,
      }),
      this.prisma.opsFloorPlanClientAnnotation.findMany({
        where: { eventId, draftId, snapshotHash },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 200,
      }),
    ]);
    return {
      draftId: draft.id,
      snapshotHash,
      snapshot,
      decisions: decisions.map((decision) => this.mapDecision(decision)),
      annotations: annotations.map((annotation) => this.mapAnnotation(annotation)),
    };
  }

  /**
   * One command per client decision. A revision request records the decision, returns the draft to PMCM
   * (`revision_requested`) and projects the event state in the same transaction. An approval is recorded
   * against the exact snapshot; the official approval stays with PMCM.
   */
  async decide(eventId: string, draftId: string, input: DecideClientFloorPlanInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'client floorplan decision', eventId);
    this.requireActorId(actor);
    const key = input.idempotencyKey?.trim() || `floorplan-client:${draftId}:${input.snapshotHash}:${actor.id}`;
    const payloadHash = this.hash({ eventId, draftId, snapshotHash: input.snapshotHash, action: input.action, comment: input.comment });
    try {
      return await this.prisma.$transaction(async (tx) => {
        // A retry of a revision request arrives after the draft left review, so the replay is answered before the snapshot is required.
        const recorded = await tx.opsFloorPlanClientDecision.findUnique({ where: { idempotencyKey: key } });
        if (recorded) {
          if (recorded.eventId !== eventId || recorded.actorId !== actor.id || recorded.payloadHash !== payloadHash) throw new BadRequestException('Idempotency key was reused for another floorplan decision');
          return this.mapDecision(recorded);
        }
        const { event, draft, snapshotHash } = await this.loadSnapshot(tx, eventId, draftId, { prisma: tx, correlationId: `floorplan-client-decision:${key}` });
        await this.eventAccessPolicyService.requireCanReadEvent(actor, event, 'client floorplan decision');
        this.requirePrimaryContact(actor, event.inquiry.email);
        this.requireMutableReview(event);
        if (input.snapshotHash !== snapshotHash) throw new BadRequestException('The floorplan changed after this review was opened; reload the latest snapshot');
        const prior = await tx.opsFloorPlanClientDecision.findFirst({ where: { draftId, snapshotHash, actorId: actor.id } });
        if (prior) throw new BadRequestException('This floorplan version already has your decision; PMCM must submit a new snapshot for another decision');
        this.requireRevisionAllowed(input, event.freezeStatus, draft.status);
        const decision = await tx.opsFloorPlanClientDecision.create({
          data: {
            id: `floorplan_client_decision_${randomUUID()}`,
            eventId,
            draftId,
            snapshotHash,
            action: input.action,
            comment: input.comment,
            actorId: actor.id!,
            actorEmail: actor.email ?? null,
            idempotencyKey: key,
            payloadHash,
          },
        });
        if (input.action === 'request_revision') {
          const moved = await tx.opsFloorPlanDraft.updateMany({
            where: { id: draftId, eventId, status: 'in_review' },
            data: { status: 'revision_requested', revisionComment: input.comment, reviewedAt: new Date() },
          });
          if (moved.count === 0) throw new BadRequestException('Floorplan draft is no longer in review');
          await this.floorPlanWorkflowService.projectLifecycleState(tx, eventId, {
            floorPlanStatus: 'revision_requested',
            readiness: 'Floorplan revision requested by client',
          });
        }
        await writeAudit(this.auditWriter, eventId, actor.name, decisionEffects[input.action].audit, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: decisionEffects[input.action].action,
          category: AuditCategory.Events,
          affectedType: 'floorplan_client_decision',
          affectedId: decision.id,
          affectedLabel: draft.name,
          metadata: { draftId, snapshotHash, action: input.action, comment: input.comment },
        }, { prisma: tx, correlationId: key, actorId: actor.id });
        await writeNotification(this.notificationOutboxWriter, eventId, 'PMCM Admin', `${decisionEffects[input.action].notification}: ${draft.name}`, undefined, { idempotencyKey: key }, { prisma: tx, correlationId: key, actorId: actor.id });
        return this.mapDecision(decision);
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const replay = await this.prisma.opsFloorPlanClientDecision.findUnique({ where: { idempotencyKey: key } });
        if (replay && replay.eventId === eventId && replay.actorId === actor.id && replay.payloadHash === payloadHash) return this.mapDecision(replay);
        throw new BadRequestException('A floorplan decision was recorded concurrently; reload the snapshot');
      }
      throw error;
    }
  }

  async annotate(eventId: string, draftId: string, input: CreateClientFloorPlanAnnotationInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'client floorplan annotation', eventId);
    this.requireActorId(actor);
    return this.prisma.$transaction(async (tx) => {
      const { event, draft, snapshot, snapshotHash } = await this.loadSnapshot(tx, eventId, draftId, { prisma: tx, correlationId: `floorplan-client-annotation:${draftId}` });
      await this.eventAccessPolicyService.requireCanReadEvent(actor, event, 'client floorplan annotation');
      this.requirePrimaryContact(actor, event.inquiry.email);
      this.requireMutableReview(event);
      if (input.snapshotHash !== snapshotHash) throw new BadRequestException('The floorplan changed after this review was opened; reload the latest snapshot');
      if (Boolean(input.anchorX !== undefined) !== Boolean(input.anchorY !== undefined)) throw new BadRequestException('Both annotation anchor coordinates are required together');
      if (input.objectId) {
        const objectIds = this.snapshotObjectIds(snapshot);
        if (!objectIds.has(input.objectId)) throw new BadRequestException('Annotation target is not present in this floorplan snapshot');
      }
      const existing = await tx.opsFloorPlanClientAnnotation.findFirst({
        where: { eventId, draftId, snapshotHash, actorId: actor.id, comment: input.comment, objectId: input.objectId ?? null, anchorX: input.anchorX ?? null, anchorY: input.anchorY ?? null },
      });
      if (existing) return this.mapAnnotation(existing);
      const annotation = await tx.opsFloorPlanClientAnnotation.create({
        data: {
          id: `floorplan_client_annotation_${randomUUID()}`,
          eventId,
          draftId,
          snapshotHash,
          objectId: input.objectId ?? null,
          anchorX: input.anchorX ?? null,
          anchorY: input.anchorY ?? null,
          comment: input.comment,
          actorId: actor.id!,
          actorEmail: actor.email ?? null,
        },
      });
      await writeAudit(this.auditWriter, eventId, actor.name, `Client annotated floorplan: ${draft.name}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Create,
        category: AuditCategory.Events,
        affectedType: 'floorplan_client_annotation',
        affectedId: annotation.id,
        affectedLabel: draft.name,
        metadata: { draftId, snapshotHash, objectId: input.objectId ?? null, anchorX: input.anchorX ?? null, anchorY: input.anchorY ?? null },
      }, { prisma: tx, correlationId: annotation.id, actorId: actor.id });
      await writeNotification(this.notificationOutboxWriter, eventId, 'PMCM Admin', `Client added a floorplan note: ${draft.name}`, undefined, { idempotencyKey: annotation.id }, { prisma: tx, correlationId: annotation.id, actorId: actor.id });
      return this.mapAnnotation(annotation);
    });
  }

  private async loadSnapshot(prisma: Prisma.TransactionClient | PrismaService, eventId: string, draftId: string, transaction?: PrismTransactionContext) {
    const reference = await this.lifecycleEventReferences.findFloorplanEvent(eventId, transaction);
    const event = reference ? {
      id: reference.eventId, archived: reference.archived, clientName: reference.clientName, freezeStatus: reference.freezeStatus,
      clientPortalStatus: reference.clientPortalStatus, inquiry: { email: reference.primaryClientEmail ?? '' },
    } : null;
    if (!event) throw new NotFoundException('Event not found');
    const draft = await prisma.opsFloorPlanDraft.findFirst({ where: { id: draftId, eventId } });
    if (!draft) throw new NotFoundException('Floorplan draft not found');
    const snapshot = draft.status === 'approved'
      ? draft.approvedSnapshot ?? draft.submittedSnapshot
      : draft.submittedSnapshot;
    if (!snapshot || !['in_review', 'approved'].includes(draft.status)) throw new NotFoundException('Submitted floorplan snapshot not found');
    return { event, draft, snapshot, snapshotHash: this.hash(snapshot) };
  }

  private requirePrimaryContact(actor: ResolvedEventOpsActor, inquiryEmail: string) {
    if (!isPrimaryClientContact(actor.email, inquiryEmail)) throw new ForbiddenException('Only the primary client contact can review the official floorplan');
  }

  private requireActorId(actor: ResolvedEventOpsActor) {
    if (!actor.id) throw new ForbiddenException('A verified client identity is required for this floorplan action');
  }

  private requireMutableReview(event: { archived: boolean; clientPortalStatus: string }) {
    if (event.archived || event.clientPortalStatus !== 'unlocked') throw new BadRequestException('Client floorplan review is locked for this event');
  }

  private snapshotObjectIds(snapshot: unknown) {
    if (!snapshot || typeof snapshot !== 'object' || !('objects' in snapshot) || !Array.isArray(snapshot.objects)) return new Set<string>();
    return new Set(snapshot.objects.flatMap((object) => object && typeof object === 'object' && 'id' in object && typeof object.id === 'string' ? [object.id] : []));
  }

  private mapDecision(decision: { id: string; eventId: string; draftId: string; snapshotHash: string; action: string; comment: string; createdAt: Date }) {
    return { id: decision.id, eventId: decision.eventId, draftId: decision.draftId, snapshotHash: decision.snapshotHash, action: decision.action, comment: decision.comment, decidedAt: decision.createdAt.toISOString() };
  }

  private mapAnnotation(annotation: { id: string; eventId: string; draftId: string; snapshotHash: string; objectId: string | null; anchorX: number | null; anchorY: number | null; comment: string; createdAt: Date }) {
    return { id: annotation.id, eventId: annotation.eventId, draftId: annotation.draftId, snapshotHash: annotation.snapshotHash, objectId: annotation.objectId ?? undefined, anchorX: annotation.anchorX ?? undefined, anchorY: annotation.anchorY ?? undefined, comment: annotation.comment, createdAt: annotation.createdAt.toISOString() };
  }

  private async lockEvent(tx: Prisma.TransactionClient, eventId: string) {
    const event = await this.lifecycleEventReferences.findFloorplanEvent(eventId, { prisma: tx, correlationId: `floorplan-review-event:${eventId}` });
    if (!event) throw new NotFoundException('Event not found');
  }

  private hash(value: unknown) {
    return createHash('sha256').update(this.canonicalJson(value)).digest('hex');
  }

  private canonicalJson(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value)) return `[${value.map((item) => this.canonicalJson(item)).join(',')}]`;
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${this.canonicalJson(item)}`).join(',')}}`;
  }

  private isUniqueConflict(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
  }
}
