import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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
import { asArray, defaultSeatCategories, type CanvasObject } from '@prism/kernel/shared';
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

  /**
   * Loads a PMCM venue-library preset inside the write transaction. The preset is authoritative:
   * layout geometry and objects come from the stored template, not from the request body.
   */
  private async loadVenuePreset(tx: Prisma.TransactionClient, venueTemplateId: string) {
    const template = await tx.venueTemplate.findUnique({
      where: { id: venueTemplateId },
      include: {
        floorPlan: {
          include: { objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] } },
        },
      },
    });
    if (!template?.floorPlan) throw new NotFoundException('Venue preset not found');
    const plan = template.floorPlan;
    return {
      objects: plan.objectRows.length
        ? plan.objectRows.map((row) => row.objectData as unknown as CanvasObject)
        : asArray<CanvasObject>(plan.objects),
      width: plan.width,
      height: plan.height,
      gridSize: plan.gridSize,
      pax: template.pax,
      guests: template.includeGuests ? asArray<unknown>(template.guests) : [],
      suppliers: template.includeSuppliers ? asArray<unknown>(template.suppliers) : [],
    };
  }

  async createFloorPlanDraft(eventId: string, input: CreateFloorPlanDraftInput, actor: FloorPlanCreator) {
    const now = new Date();
    const floorPlanId = `plan_${randomUUID()}`;

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
          const preset = input.venueTemplateId ? await this.loadVenuePreset(tx, input.venueTemplateId) : null;
          const objects = preset?.objects ?? input.objects ?? [];
          await tx.floorPlan.create({
            data: {
              id: floorPlanId,
              name: input.name,
              venue: input.venue ?? event.eventName,
              ownerId: actor.actorId,
              eventId,
              width: preset?.width ?? input.width ?? 1200,
              height: preset?.height ?? input.height ?? 800,
              gridSize: preset?.gridSize ?? input.gridSize ?? 20,
              pax: preset?.pax ?? input.pax ?? 0,
              objects: toPrismaJson(objects),
              guests: toPrismaJson(preset?.guests ?? input.guests ?? []),
              suppliers: toPrismaJson(preset?.suppliers ?? input.suppliers ?? []),
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
          const saved = await this.persistClientPreference({
            tx,
            eventId,
            eventName: event.eventName,
            lifecycleFloorPlanStatus: event.floorPlanStatus,
            input,
            actor,
            now,
            floorPlanId,
            objects,
            preference,
          });
          const inReviewOfficialDraft = await tx.opsFloorPlanDraft.findFirst({
            where: { eventId, status: 'in_review', sourceType: { not: 'client_preference' } },
            select: { floorPlanId: true, submittedAt: true },
          });

          // A client preference cannot hide an official plan already awaiting review or approved.
          await this.projectLifecycleState(tx, eventId, (lifecycleEvent) => {
            if (lifecycleEvent.floorPlanStatus === 'approved' || lifecycleEvent.floorPlanStatus === 'in_review') return null;
            if (inReviewOfficialDraft) {
              return {
                floorPlanStatus: 'in_review',
                floorPlanId: inReviewOfficialDraft.floorPlanId,
                floorPlanSubmittedAt: inReviewOfficialDraft.submittedAt ?? now,
                readiness: 'Floorplan awaiting review',
              };
            }
            return { floorPlanStatus: 'client_submitted', readiness: 'Client layout preference received' };
          });

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

  private async persistClientPreference({
    tx,
    eventId,
    eventName,
    lifecycleFloorPlanStatus,
    input,
    actor,
    now,
    floorPlanId,
    objects,
    preference,
  }: {
    tx: Prisma.TransactionClient;
    eventId: string;
    eventName: string;
    lifecycleFloorPlanStatus: string;
    input: CreateFloorPlanPreferenceInput;
    actor: FloorPlanCreator;
    now: Date;
    floorPlanId: string;
    objects: unknown[];
    preference: unknown;
  }) {
    const existing = await tx.opsFloorPlanDraft.findFirst({
      where: { eventId, sourceType: 'client_preference', createdByRole: 'client' },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
    if (existing) {
      return this.resubmitClientPreference({
        tx,
        eventId,
        existing,
        input,
        actor,
        now,
        objects,
        preference,
        lifecycleFloorPlanStatus,
      });
    }
    return this.createInitialClientPreference({ tx, eventId, eventName, floorPlanId, input, actor, now, objects, preference });
  }

  private async createInitialClientPreference({
    tx,
    eventId,
    eventName,
    floorPlanId,
    input,
    actor,
    now,
    objects,
    preference,
  }: {
    tx: Prisma.TransactionClient;
    eventId: string;
    eventName: string;
    floorPlanId: string;
    input: CreateFloorPlanPreferenceInput;
    actor: FloorPlanCreator;
    now: Date;
    objects: unknown[];
    preference: unknown;
  }) {
    await tx.floorPlan.create({
      data: {
        id: floorPlanId,
        name: input.name,
        venue: input.venue ?? eventName,
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
    return tx.opsFloorPlanDraft.create({
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
  }

  private async resubmitClientPreference({
    tx,
    eventId,
    existing,
    input,
    actor,
    now,
    objects,
    preference,
    lifecycleFloorPlanStatus,
  }: {
    tx: Prisma.TransactionClient;
    eventId: string;
    existing: OpsFloorPlanDraft;
    input: CreateFloorPlanPreferenceInput;
    actor: FloorPlanCreator;
    now: Date;
    objects: unknown[];
    preference: unknown;
    lifecycleFloorPlanStatus: string;
  }) {
    const { draft, plan } = await this.requireOwnedReopenablePreference(
      tx,
      eventId,
      existing,
      actor,
      lifecycleFloorPlanStatus,
    );
    await this.updateReopenedPreferencePlan(tx, plan, input, now, objects);
    return tx.opsFloorPlanDraft.update({
      where: { id: draft.id },
      data: {
        name: input.name,
        status: 'client_submitted',
        clientPreference: toPrismaJson(preference),
        submittedAt: now,
        reviewedAt: null,
        revisionComment: '',
        updatedAt: now,
      },
    });
  }

  private async requireOwnedReopenablePreference(
    tx: Prisma.TransactionClient,
    eventId: string,
    existing: OpsFloorPlanDraft,
    actor: FloorPlanCreator,
    lifecycleFloorPlanStatus: string,
  ) {
    // The Lifecycle event is already locked above; lock this Floorplan draft second.
    // QUERY_AUDIT_RAW_SQL: serialize preference resubmission with PMCM reopen and draft updates.
    await tx.$queryRawUnsafe(
      'SELECT "id" FROM "floorplan"."floor_plan_drafts" WHERE "id" = $1 AND "event_id" = $2 FOR UPDATE',
      existing.id,
      eventId,
    );
    const draft = await tx.opsFloorPlanDraft.findFirst({
      where: { id: existing.id, eventId, sourceType: 'client_preference' },
    });
    if (!draft) throw new NotFoundException('Client layout preference not found');
    if (actor.role !== 'client' || draft.createdByRole !== 'client') {
      throw new ForbiddenException('Only the submitting client can resubmit this preference');
    }
    if (draft.status !== 'revision_requested') {
      throw new ConflictException('Ask PMCM to reopen the existing layout preference before submitting it again');
    }
    const activeApprovedOfficialDraft = await tx.opsFloorPlanDraft.findFirst({
      where: { eventId, isActive: true, status: 'approved', sourceType: { not: 'client_preference' } },
      select: { id: true },
    });
    if (lifecycleFloorPlanStatus === 'approved' || activeApprovedOfficialDraft) {
      throw new ConflictException('A client preference cannot be resubmitted after official floorplan approval');
    }
    const plan = await tx.floorPlan.findUnique({ where: { id: draft.floorPlanId } });
    if (!plan || plan.eventId !== eventId) throw new NotFoundException('Client preference plan not found');
    if (plan.ownerId !== actor.actorId) {
      throw new ForbiddenException('Only the client who submitted this preference can revise it');
    }
    return { draft, plan };
  }

  private async updateReopenedPreferencePlan(
    tx: Prisma.TransactionClient,
    plan: NonNullable<Awaited<ReturnType<Prisma.TransactionClient['floorPlan']['findUnique']>>>,
    input: CreateFloorPlanPreferenceInput,
    now: Date,
    objects: unknown[],
  ) {
    const data: Prisma.FloorPlanUpdateInput = { name: input.name, pax: input.guestCount, updatedAt: now };
    if (input.venue !== undefined) data.venue = input.venue;
    if (input.width !== undefined) data.width = input.width;
    if (input.height !== undefined) data.height = input.height;
    if (input.gridSize !== undefined) data.gridSize = input.gridSize;
    if (input.objects !== undefined) data.objects = toPrismaJson(objects);
    await tx.floorPlan.update({ where: { id: plan.id }, data });
    if (input.objects === undefined) return;
    await tx.floorPlanObject.deleteMany({ where: { floorPlanId: plan.id } });
    await this.createFloorPlanObjects(tx, plan.id, objects);
  }

  async reopenClientPreference(eventId: string, draftId: string, actor: FloorPlanCreator) {
    const now = new Date();
    const correlationId = `floorplan-preference-reopen:${eventId}:${draftId}:${randomUUID()}`;
    const transactionContext = (prisma: Prisma.TransactionClient) => ({
      prisma,
      correlationId,
      actorId: actor.actorId,
    });

    return this.workflowCommandService.execute<OpsFloorPlanDraft, ReturnType<FloorPlanWorkflowService['mapFloorPlanDraft']>>({
      name: 'reopen_client_floorplan_preference',
      eventId,
      write: () =>
        this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const event = await this.requireWritableEvent(eventId, {
            prisma: tx,
            correlationId: `floorplan-preference-reopen:${eventId}:${draftId}`,
            actorId: actor.actorId,
          });
          if (event.floorPlanStatus === 'approved') {
            throw new ConflictException('A client preference cannot be reopened after official floorplan approval');
          }
          const activeApprovedOfficialDraft = await tx.opsFloorPlanDraft.findFirst({
            where: {
              eventId,
              isActive: true,
              status: 'approved',
              sourceType: { not: 'client_preference' },
            },
            select: { id: true },
          });
          if (activeApprovedOfficialDraft) {
            throw new ConflictException('A client preference cannot be reopened after official floorplan approval');
          }
          // Lifecycle event is locked by requireWritableEvent; lock the draft second so reopen
          // and client resubmission follow the same event-then-draft lock order.
          // QUERY_AUDIT_RAW_SQL: serialize the PMCM reopen transition with client resubmission.
          await tx.$queryRawUnsafe(
            'SELECT "id" FROM "floorplan"."floor_plan_drafts" WHERE "id" = $1 AND "event_id" = $2 FOR UPDATE',
            draftId,
            eventId,
          );
          const current = await tx.opsFloorPlanDraft.findFirst({
            where: { id: draftId, eventId },
          });
          if (!current) throw new NotFoundException('Floorplan draft not found');
          if (current.sourceType !== 'client_preference' || current.createdByRole !== 'client') {
            throw new BadRequestException('Only a client preference can be reopened through this command');
          }
          if (current.status !== 'client_submitted') {
            throw new ConflictException('Only a submitted client preference can be reopened');
          }

          const updated = await tx.opsFloorPlanDraft.updateMany({
            where: {
              id: draftId,
              eventId,
              sourceType: 'client_preference',
              createdByRole: 'client',
              status: 'client_submitted',
            },
            data: {
              status: 'revision_requested',
              reviewedAt: now,
              revisionComment: 'PMCM reopened this preference for revision.',
              updatedAt: now,
            },
          });
          if (updated.count !== 1) throw new ConflictException('Client preference changed before it could be reopened');

          const reopened = await tx.opsFloorPlanDraft.findUnique({ where: { id: draftId } });
          if (!reopened) throw new NotFoundException('Floorplan draft not found');

          await this.projectLifecycleState(tx, eventId, (event) =>
            event.floorPlanStatus === 'client_submitted'
              ? { floorPlanStatus: 'revision_requested', readiness: 'Client layout preference revision requested' }
              : null,
          );
          await writeAudit(
            this.auditWriter,
            eventId,
            actor.name,
            `Reopened client layout preference: ${reopened.name}`,
            {
              actorRole: actor.role,
              actionType: AuditActionType.Update,
              category: AuditCategory.Events,
              affectedType: 'floor_plan_draft',
              affectedId: reopened.id,
              affectedLabel: reopened.name,
              metadata: { action: 'reopen_client_preference', actorId: actor.actorId },
            },
            transactionContext(tx),
          );
          await writeNotification(
            this.notificationOutboxWriter,
            eventId,
            'Client',
            `PMCM reopened your layout preference for revision: ${reopened.name}`,
            undefined,
            { correlationId, idempotencyKey: correlationId },
            transactionContext(tx),
          );

          return reopened;
        }),
      project: (draft) => this.mapFloorPlanDraft(draft),
    });
  }

  async submitFloorPlanDraft(eventId: string, draftId: string, actor: FloorPlanActor) {
    const draft = await this.requireFloorPlanDraft(eventId, draftId);
    if (draft.sourceType === 'client_preference') {
      throw new BadRequestException('Client preferences cannot be submitted as official floorplans');
    }
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
          const currentDraft = await tx.opsFloorPlanDraft.findFirst({ where: { id: draftId, eventId } });
          if (!currentDraft) throw new NotFoundException('Floorplan draft not found');
          if (currentDraft.sourceType === 'client_preference') {
            throw new BadRequestException('Client preferences cannot be submitted as official floorplans');
          }
          if (!['pmcm_draft', 'revision_requested'].includes(currentDraft.status)) {
            throw new BadRequestException('Floorplan draft changed before submission');
          }
          submittedName = currentDraft.name;
          const snapshot = await this.floorPlanSnapshot(currentDraft.floorPlanId, tx);
          const round = (await tx.opsFloorPlanSnapshotVersion.count({ where: { draftId: currentDraft.id, snapshotType: 'submitted' } })) + 1;
          await tx.opsFloorPlanSnapshotVersion.create({ data: {
            id: `fpsv_${randomUUID()}`, eventId, draftId: currentDraft.id, round, snapshotType: 'submitted',
            snapshot: toPrismaJson(snapshot), createdByRole: actor.role, createdAt: now,
          } });
          const updated = await tx.opsFloorPlanDraft.updateMany({
            where: {
              id: currentDraft.id,
              eventId,
              status: currentDraft.status,
              sourceType: { not: 'client_preference' },
            },
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
    if (draft.sourceType === 'client_preference') {
      throw new BadRequestException('Client preferences cannot be approved as official floorplans');
    }
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
          const currentDraft = await tx.opsFloorPlanDraft.findFirst({ where: { id: draftId, eventId } });
          if (!currentDraft) throw new NotFoundException('Floorplan draft not found');
          if (currentDraft.sourceType === 'client_preference') {
            throw new BadRequestException('Client preferences cannot be approved as official floorplans');
          }
          if (currentDraft.status !== 'in_review') throw new BadRequestException('Floorplan draft changed before approval');
          approvedName = currentDraft.name;
          const snapshot = await this.floorPlanSnapshot(currentDraft.floorPlanId, tx);
          const latestSubmission = await tx.opsFloorPlanSnapshotVersion.findFirst({
            where: { eventId, draftId: currentDraft.id, snapshotType: 'submitted' }, orderBy: { round: 'desc' }, select: { round: true },
          });
          const round = latestSubmission?.round ?? 1;
          await tx.opsFloorPlanDraft.updateMany({
            where: { eventId, isActive: true },
            data: { isActive: false },
          });
          await tx.opsFloorPlanSnapshotVersion.create({ data: {
            id: `fpsv_${randomUUID()}`, eventId, draftId: currentDraft.id, round, snapshotType: 'approved',
            snapshot: toPrismaJson(snapshot), createdByRole: actor.role, createdAt: now,
          } });

          const updated = await tx.opsFloorPlanDraft.updateMany({
            where: {
              id: currentDraft.id,
              eventId,
              status: 'in_review',
              sourceType: { not: 'client_preference' },
            },
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
          await tx.opsFloorPlanDraft.updateMany({
            where: {
              eventId,
              sourceType: 'client_preference',
              createdByRole: 'client',
              status: 'revision_requested',
            },
            data: {
              status: 'client_submitted',
              reviewedAt: now,
              revisionComment: 'Superseded by the approved official floorplan.',
              updatedAt: now,
            },
          });
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
      where: {
        eventId: { in: eventIds },
        status: { in: ['in_review', 'revision_requested', 'approved'] },
        OR: [
          { sourceType: { not: 'client_preference' } },
          {
            sourceType: 'client_preference',
            status: 'approved',
            createdByRole: { in: ['pmcm-admin', 'coordinator'] },
          },
        ],
      },
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

  async listFloorPlanSnapshotHistory(eventId: string, draftId: string, visibleTypes?: Array<'submitted' | 'approved'>) {
    const draft = await this.prisma.opsFloorPlanDraft.findFirst({ where: { id: draftId, eventId, sourceType: { not: 'client_preference' } }, select: { id: true } });
    if (!draft) throw new NotFoundException('Official floorplan draft not found');
    const rows = await this.prisma.opsFloorPlanSnapshotVersion.findMany({
      where: { eventId, draftId, ...(visibleTypes ? { snapshotType: { in: visibleTypes } } : {}) },
      orderBy: [{ round: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }], take: 100,
    });
    return rows.flatMap((row) => {
      const snapshot = prismFloorPlanSnapshotSchema.safeParse(row.snapshot);
      return snapshot.success ? [{ ...row, snapshot: snapshot.data }] : [];
    });
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
