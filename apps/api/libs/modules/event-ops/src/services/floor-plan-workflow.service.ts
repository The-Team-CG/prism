import { NotFoundException } from '@nestjs/common';
import type { OpsFloorPlanDraft, Prisma } from '@prisma/client';
import { toPrismaJson } from '@prism/database';
import { DEFAULT_OWNER_ID, defaultSeatCategories } from '@prism/shared';
import { randomUUID } from 'node:crypto';

export type CreateFloorPlanDraftInput = {
  name: string;
  sourceType: string;
  venue?: string;
  width?: number;
  height?: number;
  gridSize?: number;
  pax?: number;
  objects?: unknown[];
  guests?: unknown[];
  suppliers?: unknown[];
};

export type CreateFloorPlanPreferenceInput = {
  name: string;
  seatingStyle: string;
  stagePreference: string;
  flowNotes: string;
  guestCount: number;
  constraints: string[];
  notes?: string;
  venue?: string;
  width?: number;
  height?: number;
  gridSize?: number;
  objects?: unknown[];
};

export type FloorPlanActor = {
  name: string;
  role: string;
};

function timestamp(value: Date) {
  return value.toISOString();
}

export class FloorPlanWorkflowService {
  constructor(private readonly prisma: any) {}

  async createFloorPlanDraft(eventId: string, input: CreateFloorPlanDraftInput, actor: FloorPlanActor) {
    const event = await this.requireEvent(eventId);
    const now = new Date();
    const floorPlanId = `plan_${randomUUID()}`;
    const objects = input.objects ?? [];

    const draft = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.floorPlan.create({
        data: {
          id: floorPlanId,
          name: input.name,
          venue: input.venue ?? event.eventName,
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
          floorPlanStatus: event.floorPlanStatus === 'approved' ? 'approved' : 'pmcm_draft',
          readiness: event.floorPlanStatus === 'approved' ? event.readiness : 'Floorplan draft in progress',
        },
      });

      await tx.opsAuditLog.create({
        data: {
          id: `aud_${randomUUID()}`,
          eventId,
          actor: actor.name,
          action: `Created floorplan draft: ${input.name}`,
        },
      });

      return saved;
    });

    return this.mapFloorPlanDraft(draft);
  }

  async createFloorPlanPreference(eventId: string, input: CreateFloorPlanPreferenceInput, actor: FloorPlanActor) {
    const event = await this.requireEvent(eventId);
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

    const draft = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.floorPlan.create({
        data: {
          id: floorPlanId,
          name: input.name,
          venue: input.venue ?? event.eventName,
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
          floorPlanStatus: 'client_submitted',
          readiness: 'Client layout preference received',
        },
      });

      await tx.opsAuditLog.create({
        data: {
          id: `aud_${randomUUID()}`,
          eventId,
          actor: actor.name,
          action: `Submitted layout preference: ${input.name}`,
        },
      });

      await tx.opsNotificationLog.create({
        data: {
          id: `not_${randomUUID()}`,
          eventId,
          channel: 'email',
          recipient: 'PMCM Admin',
          message: `Client submitted a layout preference: ${input.name}`,
          status: 'queued',
        },
      });

      return saved;
    });

    return this.mapFloorPlanDraft(draft);
  }

  async submitFloorPlanDraft(eventId: string, draftId: string, actor: FloorPlanActor) {
    await this.requireEvent(eventId);
    const draft = await this.requireFloorPlanDraft(eventId, draftId);
    const now = new Date();
    const snapshot = await this.floorPlanSnapshot(draft.floorPlanId);

    const submitted = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

      await tx.opsAuditLog.create({
        data: {
          id: `aud_${randomUUID()}`,
          eventId,
          actor: actor.name,
          action: `Submitted floorplan draft for review: ${draft.name}`,
        },
      });

      await tx.opsNotificationLog.create({
        data: {
          id: `not_${randomUUID()}`,
          eventId,
          channel: 'email',
          recipient: 'Client',
          message: `Floorplan draft ready for review: ${draft.name}`,
          status: 'queued',
        },
      });

      return saved;
    });

    return this.mapFloorPlanDraft(submitted);
  }

  async approveFloorPlanDraft(eventId: string, draftId: string, actor: FloorPlanActor) {
    await this.requireEvent(eventId);
    const draft = await this.requireFloorPlanDraft(eventId, draftId);
    const now = new Date();
    const snapshot = await this.floorPlanSnapshot(draft.floorPlanId);

    const approved = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

      await tx.opsAuditLog.create({
        data: {
          id: `aud_${randomUUID()}`,
          eventId,
          actor: actor.name,
          action: `Approved floorplan draft: ${draft.name}`,
        },
      });

      return saved;
    });

    return this.mapFloorPlanDraft(approved);
  }

  async getFloorPlanSnapshot(eventId: string, draftId: string, type: 'submitted' | 'approved' = 'approved') {
    const draft = await this.requireFloorPlanDraft(eventId, draftId);
    const expanded = draft as OpsFloorPlanDraft & {
      submittedSnapshot?: unknown;
      approvedSnapshot?: unknown;
    };
    const snapshot = type === 'submitted' ? expanded.submittedSnapshot : expanded.approvedSnapshot;
    if (!snapshot) throw new NotFoundException('Floorplan snapshot not found');
    return snapshot;
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

  private async requireEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
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
