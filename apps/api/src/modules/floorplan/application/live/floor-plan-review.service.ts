import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CreateFloorPlanRevisionCommentInput } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { isPrimaryClientContact } from '@prism/contexts/commercial';
import { FLOORPLAN_EVENT_REFERENCE_READER, type FloorplanEventReferenceReader } from '@prism/contexts/event-lifecycle/floorplan-reference';
import { FloorPlanWorkflowService } from './floor-plan-workflow.service';

const REVISION_COMMENT_ACTION = 'request_revision';

@Injectable()
export class FloorPlanReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly floorPlanWorkflowService: FloorPlanWorkflowService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    @Inject(FLOORPLAN_EVENT_REFERENCE_READER) private readonly lifecycleEventReferences: FloorplanEventReferenceReader,
  ) {}

  async submitRevisionComment(
    eventId: string,
    draftId: string,
    input: CreateFloorPlanRevisionCommentInput,
    actor: ResolvedEventOpsActor,
  ) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'floorplan revision comment', eventId);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { event, draft } = await this.loadReviewContext(tx, eventId, draftId, actor);
      const round = draft.submittedSnapshotAt ? draft.submittedSnapshotAt.getTime().toString() : 'first';
      const reviewKey = input.idempotencyKey?.trim() || `floorplan-review:${eventId}:${draftId}:${round}`;

      const replay = await this.replayIfPresent(tx, eventId, reviewKey, input, actor, draftId);
      if (replay) return replay;

      if (event.clientPortalStatus !== 'unlocked') throw new BadRequestException('Client floorplan review is locked');
      if (event.archived) throw new BadRequestException('Archived events cannot receive floorplan revision comments');
      if (event.freezeStatus === 'frozen') throw new BadRequestException('Frozen events cannot receive floorplan revision comments');

      if (draft.status !== 'in_review') {
        throw new BadRequestException('Only a floorplan in review can receive revision comments');
      }

      const now = new Date();
      const updated = await tx.opsFloorPlanDraft.updateMany({
        where: { id: draftId, eventId, status: 'in_review' },
        data: { status: 'revision_requested', revisionComment: input.revisionNote, reviewedAt: now },
      });
      if (updated.count === 0) throw new BadRequestException('Floorplan draft is no longer in review');

      await this.floorPlanWorkflowService.projectLifecycleState(tx, eventId, {
        floorPlanStatus: 'revision_requested',
        readiness: 'Floorplan revision requested by client',
      });

      const saved = await tx.opsFloorPlanDraft.findUnique({ where: { id: draftId } });
      if (!saved) throw new NotFoundException('Floorplan draft not found');

      await writeAudit(
        this.auditWriter,
        eventId,
        actor.name,
        `Requested floorplan revision: ${draft.name}`,
        {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Update,
          category: AuditCategory.Events,
          affectedType: 'floorplan_client_review',
          affectedId: reviewKey,
          affectedLabel: draft.name,
          metadata: {
            action: REVISION_COMMENT_ACTION,
            draftId,
            revisionNote: input.revisionNote,
            actorEmail: actor.email ?? null,
            actorId: actor.id ?? null,
          },
        },
        { prisma: tx, correlationId: reviewKey, actorId: actor.id },
      );
      await writeNotification(
        this.notificationOutboxWriter,
        eventId,
        'PMCM Admin',
        `Client requested a floorplan revision: ${draft.name}`,
        undefined,
        { correlationId: reviewKey, idempotencyKey: reviewKey },
        { prisma: tx, correlationId: reviewKey, actorId: actor.id },
      );

      return this.floorPlanWorkflowService.mapFloorPlanDraft(saved);
    });
  }

  private async loadReviewContext(
    tx: Prisma.TransactionClient,
    eventId: string,
    draftId: string,
    actor: ResolvedEventOpsActor,
  ) {
    const event = await this.lifecycleEventReferences.findFloorplanEvent(eventId, {
      prisma: tx,
      correlationId: `floorplan-review:${eventId}:${draftId}`,
      actorId: actor.id,
    });
    if (!event) throw new NotFoundException('Event not found');
    if (!isPrimaryClientContact(actor.email, event.primaryClientEmail ?? '')) {
      throw new ForbiddenException('Only the primary client contact can send floorplan revision comments');
    }

    const draft = await tx.opsFloorPlanDraft.findFirst({ where: { id: draftId, eventId } });
    if (!draft) throw new NotFoundException('Floorplan draft not found');
    return { event, draft };
  }

  private async replayIfPresent(
    tx: Prisma.TransactionClient,
    eventId: string,
    reviewKey: string,
    input: CreateFloorPlanRevisionCommentInput,
    actor: ResolvedEventOpsActor,
    draftId: string,
  ) {
    const prior = await tx.opsAuditLog.findFirst({
      where: { eventId, affectedType: 'floorplan_client_review', affectedId: reviewKey },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (!prior) return null;
    const metadata = prior.metadata as { action?: string; revisionNote?: string | null; actorEmail?: string | null; actorId?: string | null; draftId?: string };
    const samePayload =
      metadata.action === REVISION_COMMENT_ACTION &&
      (metadata.revisionNote ?? null) === (input.revisionNote ?? null) &&
      (metadata.actorEmail ?? null) === (actor.email ?? null) &&
      (metadata.actorId ?? null) === (actor.id ?? null) &&
      metadata.draftId === draftId;
    if (!samePayload) throw new BadRequestException('Idempotency key was reused for another floorplan review decision');
    const draft = await tx.opsFloorPlanDraft.findUnique({ where: { id: draftId } });
    if (!draft) throw new NotFoundException('Floorplan draft not found');
    return this.floorPlanWorkflowService.mapFloorPlanDraft(draft);
  }
}
