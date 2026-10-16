import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsFloorPlanDraft, Prisma } from '@prisma/client';
import {
  prismFloorPlanPreferenceSchema,
  prismFloorPlanSnapshotSchema,
  type CreateFloorPlanDraftInput,
  type CreateFloorPlanPreferenceInput,
  type PrismClientSharedFloorplanEntry,
  type PrismFloorPlanDraft,
  type PrismFloorPlanSnapshot,
} from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import { toPrismaJson } from '@prism/kernel/database';
import { defaultSeatCategories } from '@prism/kernel/shared';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, WorkflowCommandService } from '@prism/kernel/event-core';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { readEventAccessScope } from '@prism/contexts/read-models/event-scope';
import { FLOORPLAN_PROJECTION_WRITER, type FloorplanEventProjection, type FloorplanProjectionWriter } from '@prism/contexts/event-lifecycle';
import { FLOORPLAN_EVENT_REFERENCE_READER, type FloorplanEventReference, type FloorplanEventReferenceReader } from '@prism/contexts/event-lifecycle/floorplan-reference';
import type { FloorplanCommands, FloorPlanActor, FloorPlanCreator } from '../../contracts/floorplan-commands.port';
import type { FloorplanReader, FloorPlanDraftProjection } from '../../contracts/floorplan-reader.port';

export type { CreateFloorPlanDraftInput, CreateFloorPlanPreferenceInput } from '@prism/types';

function timestamp(value: Date) {
  return value.toISOString();
}

@Injectable()
export class FloorPlanWorkflowService implements FloorplanCommands, FloorplanReader {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(FLOORPLAN_PROJECTION_WRITER) private readonly lifecycleProjectionWriter: FloorplanProjectionWriter,
    @Inject(FLOORPLAN_EVENT_REFERENCE_READER) private readonly lifecycleEventReferences: FloorplanEventReferenceReader,
  ) {}

  async createFloorPlanDraft(eventId: string, input: CreateFloorPlanDraftInput, actor: FloorPlanCreator) {
    const now = new Date();
    const floorPlanId = `plan_${randomUUID()}`;
    const objects = input.objects ?? [];

    return this.workflowCommandService.execute<OpsFloorPlanDraft, ReturnType<FloorPlanWorkflowService['mapFloorPlanDraft']>>({
      name: 'create_floorplan_draft',
      eventId,
      write: async () => {
        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          const event = await this.requireWritableEvent(eventId, { prisma: tx, correlationId: `floorplan-create:${eventId}` });
          if (!event.conformeSigned) throw new BadRequestException('Official floor plan requires a signed conforme');
          if (event.ocularVisitStatus !== 'completed' && event.ocularVisitStatus !== 'waived') {
            throw new BadRequestException('Official floor plan requires a completed or waived ocular visit');
          }
          await tx.floorPlan.create({
            data: {
              id: floorPlanId,
              name: input.name,
              venue: input.venue ?? event.eventName,
              ownerId: actor.actorId,
              eventId,
              width: input.width ?? 1200,
              height: input.height ?? 800,
              gridSize: input.gridSize ?? 20,
              pax: input.pax ?? 0,
              objects: toPrismaJson(objects),
              guests: toPrismaJson(input.guests ?? []),
              suppliers: toPrismaJson(input.suppliers ?? []),
              seats: toPrismaJson([]),
              seatCategories: toPrismaJson(defaultSeatCategories()),
              updatedAt: now,
            },
          });

          await this.createFloorPlanObjects(tx, floorPlanId, objects);

          const saved = await tx.opsFloorPlanDraft.create({
            data: {
              id: `fpd_${randomUUID()}`,
              eventId,
              floorPlanId,
              name: input.name,
              status: 'pmcm_draft',
              isActive: false,
              sourceType: input.sourceType,
              createdByRole: actor.role,
              createdAt: now,
              updatedAt: now,
            },
          });

          await this.projectLifecycleState(tx, eventId, (lifecycleEvent) => lifecycleEvent.floorPlanStatus === 'approved'
            ? null
            : { floorPlanStatus: 'pmcm_draft', readiness: 'Floorplan draft in progress' });

          return saved;
        });
      },
      sideEffects: async (draft) => {
        await this.auditFloorPlan(eventId, actor, `Created floorplan draft: ${input.name}`, draft);
      },
      project: (draft) => this.mapFloorPlanDraft(draft),
    });
  }

  async createFloorPlanPreference(eventId: string, input: CreateFloorPlanPreferenceInput, actor: FloorPlanCreator) {
    const now = new Date();
    const floorPlanId = `plan_${randomUUID()}`;
    const objects = input.objects ?? [];
    const preference = {
      seatingStyle: input.seatingStyle,
      stagePreference: input.stagePreference,
      flowNotes: input.flowNotes,
      guestCount: input.guestCount,
      constraints: input.constraints,
      notes: input.notes ?? '',
    };

    return this.workflowCommandService.execute<OpsFloorPlanDraft, ReturnType<FloorPlanWorkflowService['mapFloorPlanDraft']>>({
      name: 'create_floorplan_preference',
      eventId,
      write: async () => {
        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          const event = await this.requireWritableEvent(eventId, { prisma: tx, correlationId: `floorplan-preference:${eventId}` });
          await tx.floorPlan.create({
            data: {
              id: floorPlanId,
              name: input.name,
              venue: input.venue ?? event.eventName,
              ownerId: actor.actorId,
              eventId,
              width: input.width ?? 30,
              height: input.height ?? 20,
              gridSize: input.gridSize ?? 1,
              pax: input.guestCount,
              objects: toPrismaJson(objects),
              guests: toPrismaJson([]),
              suppliers: toPrismaJson([]),
              seats: toPrismaJson([]),
              seatCategories: toPrismaJson(defaultSeatCategories()),
              updatedAt: now,
            },
          });

          await this.createFloorPlanObjects(tx, floorPlanId, objects);

          const saved = await tx.opsFloorPlanDraft.create({
            data: {
              id: `fpd_${randomUUID()}`,
              eventId,
              floorPlanId,
              name: input.name,
              status: 'client_submitted',
              isActive: false,
              sourceType: 'client_preference',
              createdByRole: actor.role,
              clientPreference: toPrismaJson(preference),
              submittedAt: now,
              createdAt: now,
              updatedAt: now,
            },
          });

          // A client preference is a request for changes, not a demotion of an approved plan.
          await this.projectLifecycleState(tx, eventId, (lifecycleEvent) => lifecycleEvent.floorPlanStatus === 'approved'
            ? null
            : { floorPlanStatus: 'client_submitted', readiness: 'Client layout preference received' });

          return saved;
        });
      },
      sideEffects: async (draft) => {
        await Promise.all([
          this.auditFloorPlan(eventId, actor, `Submitted layout preference: ${input.name}`, draft),
          writeNotification(this.notificationOutboxWriter, eventId, 'PMCM Admin', `Client submitted a layout preference: ${input.name}`),
        ]);
      },
      project: (draft) => this.mapFloorPlanDraft(draft),
    });
  }

  async submitFloorPlanDraft(eventId: string, draftId: string, actor: FloorPlanActor) {
    const draft = await this.requireFloorPlanDraft(eventId, draftId);
    if (!['pmcm_draft', 'revision_requested'].includes(draft.status)) {
      throw new BadRequestException('Only a draft or revision-requested floorplan can be submitted');
    }
    const now = new Date();
    let submittedName = draft.name;

    return this.workflowCommandService.execute<OpsFloorPlanDraft, ReturnType<FloorPlanWorkflowService['mapFloorPlanDraft']>>({
      name: 'submit_floorplan_draft',
      eventId,
      write: () =>
        this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          await this.requireWritableEvent(eventId, { prisma: tx, correlationId: `floorplan-submit:${draftId}` });
          await this.lockActiveEventForFloorplan(tx, eventId);
          const currentDraft = await tx.opsFloorPlanDraft.findFirst({ where: { id: draftId, eventId } });
          if (!currentDraft) throw new NotFoundException('Floorplan draft not found');
          if (!['pmcm_draft', 'revision_requested'].includes(currentDraft.status)) {
            throw new BadRequestException('Only a draft or revision-requested floorplan can be submitted');
          }
          submittedName = currentDraft.name;
          const snapshot = await this.floorPlanSnapshot(currentDraft.floorPlanId, tx);
          const updated = await tx.opsFloorPlanDraft.updateMany({
            where: { id: currentDraft.id, eventId, status: currentDraft.status },
            data: {
              status: 'in_review',
              submittedSnapshot: toPrismaJson(snapshot),
              submittedSnapshotAt: now,
              submittedAt: currentDraft.submittedAt ?? now,
            },
          });
          if (updated.count !== 1) throw new BadRequestException('Floorplan draft changed before submission');
          const saved = await tx.opsFloorPlanDraft.findUnique({ where: { id: currentDraft.id } });
          if (!saved) throw new NotFoundException('Floorplan draft not found');

          await this.projectLifecycleState(tx, eventId, {
            floorPlanStatus: 'in_review',
            floorPlanId: currentDraft.floorPlanId,
            floorPlanSubmittedAt: now,
            readiness: 'Floorplan awaiting review',
          });

          return saved;
        }),
      sideEffects: async (submitted) => {
        await Promise.all([
          this.auditFloorPlan(eventId, actor, `Submitted floorplan draft for review: ${submittedName}`, submitted),
          writeNotification(this.notificationOutboxWriter, eventId, 'Client', `Floorplan draft ready for review: ${submittedName}`),
        ]);
      },
      project: (submitted) => this.mapFloorPlanDraft(submitted),
    });
  }

  async approveFloorPlanDraft(eventId: string, draftId: string, actor: FloorPlanActor) {
    const draft = await this.requireFloorPlanDraft(eventId, draftId);
    if (draft.status !== 'in_review') throw new BadRequestException('Only a floorplan in review can be approved');
    const now = new Date();
    let approvedName = draft.name;

    return this.workflowCommandService.execute<OpsFloorPlanDraft, ReturnType<FloorPlanWorkflowService['mapFloorPlanDraft']>>({
      name: 'approve_floorplan_draft',
      eventId,
      write: () =>
        this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          await this.requireWritableEvent(eventId, { prisma: tx, correlationId: `floorplan-approve:${draftId}` });
          await this.lockActiveEventForFloorplan(tx, eventId);
          const currentDraft = await tx.opsFloorPlanDraft.findFirst({ where: { id: draftId, eventId } });
          if (!currentDraft) throw new NotFoundException('Floorplan draft not found');
          if (currentDraft.status !== 'in_review') throw new BadRequestException('Only a floorplan in review can be approved');
          approvedName = currentDraft.name;
          const snapshot = await this.floorPlanSnapshot(currentDraft.floorPlanId, tx);
          await tx.opsFloorPlanDraft.updateMany({
            where: { eventId, isActive: true },
            data: { isActive: false },
          });

          const updated = await tx.opsFloorPlanDraft.updateMany({
            where: { id: currentDraft.id, eventId, status: 'in_review' },
            data: {
              status: 'approved',
              isActive: true,
              approvedSnapshot: toPrismaJson(snapshot),
              approvedSnapshotAt: now,
              reviewedAt: now,
              approvedAt: now,
              submittedAt: currentDraft.submittedAt ?? now,
            },
          });
          if (updated.count !== 1) throw new BadRequestException('Floorplan draft changed before approval');
          const saved = await tx.opsFloorPlanDraft.findUnique({ where: { id: currentDraft.id } });
          if (!saved) throw new NotFoundException('Floorplan draft not found');

          await this.projectLifecycleState(tx, eventId, {
            floorPlanStatus: 'approved',
            floorPlanId: currentDraft.floorPlanId,
            floorPlanReviewedAt: now,
            readiness: 'Floorplan approved',
          });

          return saved;
        }),
      sideEffects: async (approved) => {
        await this.auditFloorPlan(eventId, actor, `Approved floorplan draft: ${approvedName}`, approved);
      },
      project: (approved) => this.mapFloorPlanDraft(approved),
    });
  }

  async listClientSnapshotEntries(
    eventIds: string[],
  ): Promise<Array<Omit<PrismClientSharedFloorplanEntry, 'eventName' | 'eventDate'>>> {
    if (eventIds.length === 0) return [];
    const drafts = await this.prisma.opsFloorPlanDraft.findMany({
      where: { eventId: { in: eventIds }, status: { in: ['in_review', 'revision_requested', 'approved'] } },
      select: { eventId: true, id: true, name: true, status: true, updatedAt: true },
      orderBy: [{ eventId: 'asc' }, { updatedAt: 'desc' }, { id: 'asc' }],
    });
    return drafts.map((draft) => ({
      eventId: draft.eventId,
      draftId: draft.id,
      draftName: draft.name,
      draftStatus: draft.status,
      availableSnapshots: draft.status === 'approved' ? ['submitted', 'approved'] : ['submitted'],
    }));
  }

  async getFloorPlanSnapshot(eventId: string, draftId: string, type: 'submitted' | 'approved' = 'approved'): Promise<PrismFloorPlanSnapshot> {
    const draft = await this.requireFloorPlanDraft(eventId, draftId);
    const snapshot = type === 'submitted' ? draft.submittedSnapshot : draft.approvedSnapshot;
    const validatedSnapshot = prismFloorPlanSnapshotSchema.safeParse(snapshot);
    if (validatedSnapshot.success) return validatedSnapshot.data;

    // Compatibility recovery for drafts created before persisted snapshots were added. Only
    // official lifecycle states may use the current plan as a legacy snapshot; preference and
    // work-in-progress drafts must continue to return not found rather than exposing their plan
    // through this official-snapshot endpoint. New submissions/approvals always persist a
    // snapshot, so this branch disappears as legacy rows are rewritten by normal workflow moves.
    const canRecoverSubmitted = type === 'submitted' && (draft.status === 'in_review' || draft.status === 'approved');
    const canRecoverApproved = type === 'approved' && draft.status === 'approved';
    if (canRecoverSubmitted || canRecoverApproved) {
      return this.floorPlanSnapshot(draft.floorPlanId);
    }

    throw new NotFoundException('Floorplan snapshot not found');
  }

  mapFloorPlanDraft(draft: FloorPlanDraftProjection): PrismFloorPlanDraft {
    const clientPreference = prismFloorPlanPreferenceSchema.safeParse(draft.clientPreference);
    const submittedSnapshot = prismFloorPlanSnapshotSchema.safeParse(draft.submittedSnapshot);
    const approvedSnapshot = prismFloorPlanSnapshotSchema.safeParse(draft.approvedSnapshot);

    return {
      id: draft.id,
      eventId: draft.eventId,
      floorPlanId: draft.floorPlanId,
      name: draft.name,
      status: draft.status,
      isActive: draft.isActive,
      sourceType: draft.sourceType,
      createdByRole: draft.createdByRole,
      ...(clientPreference.success ? { clientPreference: clientPreference.data } : {}),
      ...(submittedSnapshot.success ? { submittedSnapshot: submittedSnapshot.data } : {}),
      ...(approvedSnapshot.success ? { approvedSnapshot: approvedSnapshot.data } : {}),
      submittedAt: draft.submittedAt ? timestamp(draft.submittedAt) : undefined,
      reviewedAt: draft.reviewedAt ? timestamp(draft.reviewedAt) : undefined,
      approvedAt: draft.approvedAt ? timestamp(draft.approvedAt) : undefined,
      submittedSnapshotAt: draft.submittedSnapshotAt ? timestamp(draft.submittedSnapshotAt) : undefined,
      approvedSnapshotAt: draft.approvedSnapshotAt ? timestamp(draft.approvedSnapshotAt) : undefined,
      revisionComment: draft.revisionComment,
      createdAt: timestamp(draft.createdAt),
      updatedAt: timestamp(draft.updatedAt),
    };
  }

  async projectLifecycleState(
    tx: Prisma.TransactionClient,
    eventId: string,
    projection: FloorplanEventProjection | ((event: Pick<FloorplanEventReference, 'floorPlanStatus' | 'readiness'>) => FloorplanEventProjection | null),
  ) {
    const reference = await this.requireFloorplanEvent(eventId, { prisma: tx, correlationId: `floorplan-projection:${eventId}` });
    const state = typeof projection === 'function'
      ? projection({ floorPlanStatus: reference.floorPlanStatus, readiness: reference.readiness })
      : projection;
    if (!state) return;

    // The row lock serializes all version reservations for this event; gaps are harmless when
    // an earlier transaction rolled back after reserving a version.
    const clock = await tx.opsFloorPlanProjectionClock.upsert({
      where: { eventId },
      create: { eventId, version: 1 },
      update: { version: { increment: 1 } },
    });
    await this.lifecycleProjectionWriter.project(
      { eventId, version: clock.version, state },
      { prisma: tx, correlationId: `floorplan-projection:${eventId}:${clock.version}` },
    );
  }

  private async requireFloorplanEvent(eventId: string, transaction?: PrismTransactionContext) {
    const event = await this.lifecycleEventReferences.findFloorplanEvent(eventId, transaction);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  /** Read-model composition used by access-control for read-only route scoping. */
  async requireEvent(eventId: string) {
    const event = await readEventAccessScope(this.prisma, eventId);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async requireWritableEvent(eventId: string, transaction: PrismTransactionContext) {
    const event = await this.requireFloorplanEvent(eventId, transaction);
    if (event.archived) throw new BadRequestException('Archived events cannot be changed');
    if (event.freezeStatus === 'frozen') throw new BadRequestException('Frozen events cannot be changed');
    return event;
  }

  private async requireFloorPlanDraft(eventId: string, draftId: string) {
    const draft = await this.prisma.opsFloorPlanDraft.findFirst({
      where: { id: draftId, eventId },
    });
    if (!draft) throw new NotFoundException('Floorplan draft not found');
    return draft;
  }

  private async lockActiveEventForFloorplan(tx: Prisma.TransactionClient, eventId: string) {
    const event = await this.lifecycleEventReferences.findFloorplanEvent(eventId, { prisma: tx, correlationId: `floorplan-event:${eventId}` });
    if (!event) throw new NotFoundException('Event not found');
    if (event.archived) throw new BadRequestException('Archived events cannot change the official floorplan');
  }

  private async floorPlanSnapshot(planId: string, client: Prisma.TransactionClient | PrismaService = this.prisma) {
    const plan = await client.floorPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Floorplan not found');
    return {
      id: plan.id,
      name: plan.name,
      venue: plan.venue,
      width: plan.width,
      height: plan.height,
      gridSize: plan.gridSize,
      pax: plan.pax,
      objects: Array.isArray(plan.objects) ? plan.objects : [],
      guests: Array.isArray(plan.guests) ? plan.guests : [],
      suppliers: Array.isArray(plan.suppliers) ? plan.suppliers : [],
      seats: Array.isArray(plan.seats) ? plan.seats : [],
      seatCategories: Array.isArray(plan.seatCategories) ? plan.seatCategories : [],
      updatedAt: plan.updatedAt ? timestamp(plan.updatedAt) : timestamp(new Date()),
    };
  }

  private auditFloorPlan(eventId: string, actor: FloorPlanActor, action: string, draft: OpsFloorPlanDraft) {
    return writeAudit(this.auditWriter, eventId, actor.name, action, {
      actorRole: actor.role,
      category: AuditCategory.Events,
      actionType: this.floorPlanAuditAction(action),
      affectedType: 'floor_plan_draft',
      affectedId: draft.id,
      affectedLabel: draft.name,
    });
  }

  private floorPlanAuditAction(action: string) {
    const normalized = action.toLowerCase();
    if (normalized.includes('approved')) return AuditActionType.Approve;
    if (normalized.includes('submitted')) return AuditActionType.Update;
    if (normalized.includes('created')) return AuditActionType.Create;
    return AuditActionType.General;
  }

  private async createFloorPlanObjects(tx: Prisma.TransactionClient, floorPlanId: string, objects: unknown[]) {
    if (objects.length === 0) return;

    await tx.floorPlanObject.createMany({
      data: objects.map((object, index) => {
        const row = object as { id?: string; kind?: string; zIndex?: number; svgMarkup?: string };
        return {
          floorPlanId,
          objectId: row.id ?? `obj_${randomUUID()}`,
          kind: row.kind ?? 'custom-image',
          zIndex: row.zIndex ?? index,
          objectData: toPrismaJson(object),
          svgMarkup: row.svgMarkup ?? null,
        };
      }),
    });
  }
}
