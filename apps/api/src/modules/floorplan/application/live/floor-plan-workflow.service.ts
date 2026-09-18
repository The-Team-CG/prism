import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsEvent, OpsFloorPlanDraft, Prisma } from '@prisma/client';
import type { CreateFloorPlanDraftInput, CreateFloorPlanPreferenceInput } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import { toPrismaJson } from '@prism/kernel/database';
import { DEFAULT_OWNER_ID, defaultSeatCategories } from '@prism/kernel/shared';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { readEventAccessScope, readEventConformeState } from '@prism/contexts/read-models/event-scope';

export type { CreateFloorPlanDraftInput, CreateFloorPlanPreferenceInput } from '@prism/types';

export type FloorPlanActor = {
  name: string;
  role: string;
};

function timestamp(value: Date) {
  return value.toISOString();
}

@Injectable()
export class FloorPlanWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    private readonly workflowCommandService: WorkflowCommandService,
  ) {}

  async createFloorPlanDraft(eventId: string, input: CreateFloorPlanDraftInput, actor: FloorPlanActor) {
    let event: OpsEvent | null = null;
    const now = new Date();
    const floorPlanId = `plan_${randomUUID()}`;
    const objects = input.objects ?? [];

    return this.workflowCommandService.execute<OpsFloorPlanDraft, ReturnType<FloorPlanWorkflowService['mapFloorPlanDraft']>>({
      name: 'create_floorplan_draft',
      eventId,
      validateState: async () => {
        event = await this.requireEvent(eventId);
        await this.requireSignedConforme(eventId);
      },
      write: async () => {
        if (!event) throw new NotFoundException('Event not found');
        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          await tx.floorPlan.create({
            data: {
              id: floorPlanId,
              name: input.name,
              venue: input.venue ?? event!.eventName,
              ownerId: DEFAULT_OWNER_ID,
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
              createdByRole: 'pmcm-admin',
              createdAt: now,
              updatedAt: now,
            },
          });

          await tx.opsEvent.update({
            where: { id: eventId },
            data: {
              floorPlanStatus: event!.floorPlanStatus === 'approved' ? 'approved' : 'pmcm_draft',
              readiness: event!.floorPlanStatus === 'approved' ? event!.readiness : 'Floorplan draft in progress',
            },
          });

          return saved;
        });
      },
      sideEffects: async (draft) => {
        await this.auditFloorPlan(eventId, actor, `Created floorplan draft: ${input.name}`, draft);
      },
      project: (draft) => this.mapFloorPlanDraft(draft),
    });
  }

  async createFloorPlanPreference(eventId: string, input: CreateFloorPlanPreferenceInput, actor: FloorPlanActor) {
    let event: OpsEvent | null = null;
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
      validateState: async () => {
        event = await this.requireEvent(eventId);
      },
      write: async () => {
        if (!event) throw new NotFoundException('Event not found');
        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          await tx.floorPlan.create({
            data: {
              id: floorPlanId,
              name: input.name,
              venue: input.venue ?? event!.eventName,
              ownerId: DEFAULT_OWNER_ID,
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
              createdByRole: actor.role === 'client' ? 'client' : 'pmcm-admin',
              clientPreference: toPrismaJson(preference),
              submittedAt: now,
              createdAt: now,
              updatedAt: now,
            },
          });

          await tx.opsEvent.update({
            where: { id: eventId },
            data: {
              // A client preference is a request for changes, not a demotion of the official plan.
              // The route admits OpsUserRole.Client, so without this guard a preference filed after
              // approval would knock an approved event out of approved state. PMCM still learns of
              // the request through the writeNotification below.
              floorPlanStatus: event!.floorPlanStatus === 'approved' ? 'approved' : 'client_submitted',
              readiness: event!.floorPlanStatus === 'approved' ? event!.readiness : 'Client layout preference received',
            },
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

  async submitFloorPlanDraft(eventId: string, draftId: string, actor: FloorPlanActor) {
    await this.requireEvent(eventId);
    const draft = await this.requireFloorPlanDraft(eventId, draftId);
    const now = new Date();
    const snapshot = await this.floorPlanSnapshot(draft.floorPlanId);

    return this.workflowCommandService.execute<OpsFloorPlanDraft, ReturnType<FloorPlanWorkflowService['mapFloorPlanDraft']>>({
      name: 'submit_floorplan_draft',
      eventId,
      write: () =>
        this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          const saved = await tx.opsFloorPlanDraft.update({
            where: { id: draft.id },
            data: {
              status: 'in_review',
              submittedSnapshot: toPrismaJson(snapshot),
              submittedSnapshotAt: now,
              submittedAt: draft.submittedAt ?? now,
            },
          });

          await tx.opsEvent.update({
            where: { id: eventId },
            data: {
              floorPlanStatus: 'in_review',
              floorPlanId: draft.floorPlanId,
              floorPlanSubmittedAt: now,
              readiness: 'Floorplan awaiting review',
            },
          });

          return saved;
        }),
      sideEffects: async (submitted) => {
        await Promise.all([
          this.auditFloorPlan(eventId, actor, `Submitted floorplan draft for review: ${draft.name}`, submitted),
          writeNotification(this.notificationOutboxWriter, eventId, 'Client', `Floorplan draft ready for review: ${draft.name}`),
        ]);
      },
      project: (submitted) => this.mapFloorPlanDraft(submitted),
    });
  }

  async approveFloorPlanDraft(eventId: string, draftId: string, actor: FloorPlanActor) {
    await this.requireEvent(eventId);
    const draft = await this.requireFloorPlanDraft(eventId, draftId);
    const now = new Date();
    const snapshot = await this.floorPlanSnapshot(draft.floorPlanId);

    return this.workflowCommandService.execute<OpsFloorPlanDraft, ReturnType<FloorPlanWorkflowService['mapFloorPlanDraft']>>({
      name: 'approve_floorplan_draft',
      eventId,
      write: () =>
        this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          await tx.opsFloorPlanDraft.updateMany({
            where: { eventId, isActive: true },
            data: { isActive: false },
          });

          const saved = await tx.opsFloorPlanDraft.update({
            where: { id: draft.id },
            data: {
              status: 'approved',
              isActive: true,
              approvedSnapshot: toPrismaJson(snapshot),
              approvedSnapshotAt: now,
              reviewedAt: now,
              approvedAt: now,
              submittedAt: draft.submittedAt ?? now,
            },
          });

          await tx.opsEvent.update({
            where: { id: eventId },
            data: {
              floorPlanStatus: 'approved',
              floorPlanId: draft.floorPlanId,
              floorPlanReviewedAt: now,
              readiness: 'Floorplan approved',
            },
          });

          return saved;
        }),
      sideEffects: async (approved) => {
        await this.auditFloorPlan(eventId, actor, `Approved floorplan draft: ${draft.name}`, approved);
      },
      project: (approved) => this.mapFloorPlanDraft(approved),
    });
  }

  async getFloorPlanSnapshot(eventId: string, draftId: string, type: 'submitted' | 'approved' = 'approved') {
    const draft = await this.requireFloorPlanDraft(eventId, draftId);
    const expanded = draft as OpsFloorPlanDraft & {
      submittedSnapshot?: unknown;
      approvedSnapshot?: unknown;
    };
    const snapshot = type === 'submitted' ? expanded.submittedSnapshot : expanded.approvedSnapshot;
    if (snapshot) return snapshot;

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

  mapFloorPlanDraft(draft: OpsFloorPlanDraft) {
    const expanded = draft as OpsFloorPlanDraft & {
      submittedSnapshot?: unknown;
      approvedSnapshot?: unknown;
      submittedSnapshotAt?: Date | null;
      approvedSnapshotAt?: Date | null;
      revisionComment?: string;
    };
    return {
      id: draft.id,
      eventId: draft.eventId,
      floorPlanId: draft.floorPlanId,
      name: draft.name,
      status: draft.status,
      isActive: draft.isActive,
      sourceType: draft.sourceType,
      createdByRole: draft.createdByRole,
      clientPreference: draft.clientPreference ?? undefined,
      submittedSnapshot: expanded.submittedSnapshot ?? undefined,
      approvedSnapshot: expanded.approvedSnapshot ?? undefined,
      submittedAt: draft.submittedAt ? timestamp(draft.submittedAt) : undefined,
      reviewedAt: draft.reviewedAt ? timestamp(draft.reviewedAt) : undefined,
      approvedAt: draft.approvedAt ? timestamp(draft.approvedAt) : undefined,
      submittedSnapshotAt: expanded.submittedSnapshotAt ? timestamp(expanded.submittedSnapshotAt) : undefined,
      approvedSnapshotAt: expanded.approvedSnapshotAt ? timestamp(expanded.approvedSnapshotAt) : undefined,
      revisionComment: expanded.revisionComment ?? '',
      createdAt: timestamp(draft.createdAt),
      updatedAt: timestamp(draft.updatedAt),
    };
  }

  async requireEvent(eventId: string) {
    const event = await readEventAccessScope(this.prisma, eventId);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  /**
   * EP-05-S01 AC1. An official floor plan is downstream of a signed conforme, so refuse to open a
   * draft until event-lifecycle records one. Fails closed: OpsEvent.inquiry is a required relation,
   * so a missing conforme fact means unsigned, never "assume signed".
   */
  private async requireSignedConforme(eventId: string) {
    const conforme = await readEventConformeState(this.prisma, eventId);
    if (!conforme?.conformeSignedAt) {
      throw new BadRequestException('Official floor plan requires a signed conforme');
    }
  }

  private async requireFloorPlanDraft(eventId: string, draftId: string) {
    const draft = await this.prisma.opsFloorPlanDraft.findFirst({
      where: { id: draftId, eventId },
    });
    if (!draft) throw new NotFoundException('Floorplan draft not found');
    return draft;
  }

  private async floorPlanSnapshot(planId: string) {
    const plan = await this.prisma.floorPlan.findUnique({ where: { id: planId } });
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
