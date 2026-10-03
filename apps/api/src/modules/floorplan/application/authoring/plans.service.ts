import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FloorPlan as PrismaFloorPlan, FloorPlanObject as PrismaFloorPlanObject } from '@prisma/client';
import {
  AUDIT_WRITER,
  EventAccessPolicyService,
  type AuditWriter,
  type ResolvedEventOpsActor,
  writeAudit,
} from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { asArray } from '@prism/kernel/shared';
import type { CanvasObject, FloorPlan, JsonValue, Seat, SeatCategory } from '@prism/kernel/shared';
import type { UpdatePlanInput } from '@prism/types';
import { floorPlanScalarPatch, replaceFloorPlanObjects } from './plan-patch';

type UpdatePlanChanges = Omit<UpdatePlanInput, 'expectedUpdatedAt'>;

type PlanWithObjects = Prisma.FloorPlanGetPayload<{
  include: {
    objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] };
    opsDraft: {
      include: {
        event: { include: { inquiry: { select: { email: true } } } };
      };
    };
  };
}>;

type PlanWriteState = {
  updatedAt: Date;
  opsDraft: {
    status: string;
    event: { archived: boolean; freezeStatus: string };
  } | null;
};

async function updatePlanWithObjects(
  tx: Prisma.TransactionClient,
  planId: string,
  scalarChanges: Omit<UpdatePlanChanges, 'objects'>,
  objects: CanvasObject[],
  expectedUpdatedAt: Date,
) {
  const updated = await tx.floorPlan
    .update({
      where: { id: planId, updatedAt: expectedUpdatedAt },
      data: floorPlanScalarPatch({ ...scalarChanges, objects }),
      include: {
        objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
        opsDraft: { include: { event: { include: { inquiry: { select: { email: true } } } } } },
      },
    })
    .catch((error: unknown) => {
      if (isPrismaRecordMissing(error)) {
        throw new ConflictException('Floorplan changed since it was loaded; reload before saving');
      }
      throw error;
    });
  await replaceFloorPlanObjects(tx, planId, objects);
  return updated;
}

function isPrismaRecordMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
}

function isPrismaSerializationFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
}

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  private mapPlan(row: PlanWithObjects, resolvedObjects?: CanvasObject[]): FloorPlan {
    const objects =
      resolvedObjects ??
      (row.objectRows.length
        ? row.objectRows.map((r) => r.objectData as unknown as CanvasObject)
        : asArray<CanvasObject>(row.objects));

    return {
      id: row.id,
      name: row.name,
      venue: row.venue,
      width: row.width,
      height: row.height,
      gridSize: row.gridSize,
      pax: row.pax,
      ownerId: row.ownerId,
      templateId: row.templateId,
      eventId: row.eventId,
      objects,
      guests: asArray<JsonValue>(row.guests),
      suppliers: asArray<JsonValue>(row.suppliers),
      seats: asArray<Seat>(row.seats),
      seatCategories: asArray<SeatCategory>(row.seatCategories),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getPlan(planId: string, actor: ResolvedEventOpsActor): Promise<FloorPlan> {
    const row = await this.findPlan(planId);

    if (!row) throw new NotFoundException('Plan not found');
    await this.assertCanReadPlan(row, actor);

    return this.mapPlan(row);
  }

  async updatePlan(
    planId: string,
    changes: UpdatePlanInput,
    actor: ResolvedEventOpsActor,
  ): Promise<FloorPlan> {
    const plan = await this.findPlan(planId);
    if (!plan) throw new NotFoundException('Plan not found');

    const { expectedUpdatedAt: expectedUpdatedAtInput, ...requestedChanges } = changes;
    await this.assertCanUpdatePlan(plan, actor, requestedChanges);

    const expectedUpdatedAt = new Date(expectedUpdatedAtInput);
    if (plan.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      throw new ConflictException('Floorplan changed since it was loaded; reload before saving');
    }

    if (Object.keys(requestedChanges).length === 0) return this.mapPlan(plan);

    const { objects, ...scalarChanges } = requestedChanges;
    const updated = await this.prisma.$transaction(async (tx) => {
      const latestState = await tx.floorPlan.findUnique({
        where: { id: planId },
        select: {
          updatedAt: true,
          opsDraft: {
            select: {
              status: true,
              event: { select: { archived: true, freezeStatus: true } },
            },
          },
        },
      });
      if (!latestState) throw new NotFoundException('Plan not found');
      if (latestState.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        throw new ConflictException('Floorplan changed since it was loaded; reload before saving');
      }
      this.assertPlanMutableState(latestState, actor);

      let saved: PlanWithObjects;
      if (objects !== undefined) {
        const typedObjects = objects ?? [];
        saved = await updatePlanWithObjects(tx, planId, scalarChanges, typedObjects, expectedUpdatedAt);
      } else {
        saved = await tx.floorPlan
          .update({
            where: { id: planId, updatedAt: expectedUpdatedAt },
            data: floorPlanScalarPatch(scalarChanges),
            include: {
              objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
              opsDraft: { include: { event: { include: { inquiry: { select: { email: true } } } } } },
            },
          })
          .catch((error: unknown) => {
            if (isPrismaRecordMissing(error)) {
              throw new ConflictException('Floorplan changed since it was loaded; reload before saving');
            }
            throw error;
          });
      }

      await writeAudit(
        this.auditWriter,
        plan.opsDraft?.eventId ?? plan.eventId ?? undefined,
        actor.name,
        `Updated floorplan: ${plan.name}`,
        {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Update,
          category: AuditCategory.Events,
          affectedType: 'floor_plan',
          affectedId: plan.id,
          affectedLabel: plan.name,
          metadata: { verified: actor.verified ?? false },
        },
        { prisma: tx, correlationId: plan.opsDraft?.eventId ?? plan.eventId ?? plan.id, actorId: actor.id },
      );
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: unknown) => {
      if (isPrismaSerializationFailure(error)) {
        throw new ConflictException('Event or floorplan changed while it was being saved; reload before saving');
      }
      throw error;
    });

    return this.mapPlan(updated, objects);
  }

  private async assertCanReadPlan(plan: PlanWithObjects, actor: ResolvedEventOpsActor) {
    const eventId = plan.opsDraft?.eventId ?? plan.eventId ?? undefined;
    if (actor.role === OpsUserRole.System) return;
    if (actor.role === OpsUserRole.PmcmAdmin) {
      if (actor.verified) return;
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'floorplan', eventId);
      throw new ForbiddenException('A verified PMCM identity is required to read this floorplan');
    }
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'floorplan', eventId);
    const draft = plan.opsDraft;
    if (!draft || draft.sourceType !== 'client_preference' || draft.status !== 'client_submitted') {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'official floorplan', eventId);
      throw new ForbiddenException('Official floorplans are available through the event-scoped snapshot');
    }
    if (!actor.verified || !actor.email?.trim()) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'client floorplan preference', draft.event.id);
      throw new ForbiddenException('A verified client identity is required to read this preference');
    }
    await this.eventAccessPolicyService.requireCanReadEvent(actor, draft.event, 'client floorplan preference');
  }

  private async assertCanUpdatePlan(
    plan: PlanWithObjects,
    actor: ResolvedEventOpsActor,
    changes: UpdatePlanChanges,
  ) {
    const eventId = plan.opsDraft?.eventId ?? plan.eventId ?? undefined;
    if (actor.role === OpsUserRole.Client) {
      await this.assertCanReadPlan(plan, actor);
      const forbiddenFields = Object.keys(changes).filter(
        (field) => !['venue', 'width', 'height', 'gridSize', 'pax', 'objects'].includes(field),
      );
      if (forbiddenFields.length > 0) {
        await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'client floorplan preference mutation', eventId);
        throw new ForbiddenException('Clients may only update layout preferences');
      }
    } else {
      await this.eventAccessPolicyService.requireActorRole(
        actor,
        [OpsUserRole.PmcmAdmin, OpsUserRole.System],
        'official floorplan mutation',
        eventId,
      );
      if (actor.role === OpsUserRole.PmcmAdmin && !actor.verified) {
        await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'official floorplan mutation', eventId);
        throw new ForbiddenException('A verified PMCM identity is required to update this floorplan');
      }
    }

    this.assertPlanMutableState(plan, actor);
  }

  private assertPlanMutableState(plan: PlanWriteState, actor: ResolvedEventOpsActor) {
    const event = plan.opsDraft?.event;
    if (event?.archived) throw new ConflictException('Archived events cannot be changed');
    if (event?.freezeStatus === 'frozen') throw new ConflictException('Frozen event scope cannot be changed');
    if (
      actor.role !== OpsUserRole.Client &&
      plan.opsDraft &&
      ['in_review', 'approved'].includes(plan.opsDraft.status)
    ) {
      throw new ConflictException('Submitted and approved floorplans are immutable; create or reopen a draft');
    }
  }

  private findPlan(planId: string) {
    return this.prisma.floorPlan.findUnique({
      where: { id: planId },
      include: {
        objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
        opsDraft: { include: { event: { include: { inquiry: { select: { email: true } } } } } },
      },
    });
  }
}
