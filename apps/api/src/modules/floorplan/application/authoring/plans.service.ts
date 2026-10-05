import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { FloorPlan as PrismaFloorPlan, FloorPlanObject as PrismaFloorPlanObject, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { asArray } from '@prism/kernel/shared';
import type { CanvasObject, FloorPlan, JsonValue, Seat, SeatCategory } from '@prism/kernel/shared';
import { floorPlanScalarPatch, replaceFloorPlanObjects } from './plan-patch';

type UpdatePlanChanges = {
  venue?: string;
  width?: number;
  height?: number;
  gridSize?: number;
  pax?: number;
  objects?: CanvasObject[];
  guests?: unknown[];
  suppliers?: unknown[];
  seats?: Seat[];
  seatCategories?: SeatCategory[];
};

type PlanDraftWithEventContact = Prisma.OpsFloorPlanDraftGetPayload<{
  include: { event: { include: { inquiry: { select: { email: true } } } } };
}>;

type PlanWithObjects = PrismaFloorPlan & {
  objectRows?: PrismaFloorPlanObject[];
  opsDraft?: PlanDraftWithEventContact | null;
};

async function updatePlanWithObjects(
  tx: Prisma.TransactionClient,
  planId: string,
  scalarChanges: Omit<UpdatePlanChanges, 'objects'>,
  objects: CanvasObject[],
) {
  const updated = await tx.floorPlan
    .update({
      where: { id: planId },
      data: floorPlanScalarPatch({ ...scalarChanges, objects }),
    })
    .catch(() => {
      throw new NotFoundException('Plan not found');
    });
  await replaceFloorPlanObjects(tx, planId, objects);
  return updated;
}

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  private mapPlan(row: PlanWithObjects, resolvedObjects?: CanvasObject[]): FloorPlan {
    const objects =
      resolvedObjects ??
      (row.objectRows?.length
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
    const row = await this.prisma.floorPlan.findUnique({
      where: { id: planId },
      include: {
        objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
        opsDraft: { include: { event: { include: { inquiry: { select: { email: true } } } } } },
      },
    });

    if (!row) throw new NotFoundException('Plan not found');
    await this.assertCanReadPlan(row, actor);

    return this.mapPlan(row);
  }

  async updatePlan(planId: string, changes: UpdatePlanChanges, actor: ResolvedEventOpsActor): Promise<FloorPlan> {
    await this.assertCanUpdatePlan(planId, actor);

    if (Object.keys(changes).length === 0) {
      return this.getPlan(planId, actor);
    }

    const { objects, ...scalarChanges } = changes;

    if (objects === undefined) {
      const row = await this.prisma.floorPlan
        .update({
          where: { id: planId },
          data: floorPlanScalarPatch(scalarChanges),
          include: {
            objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
          },
        })
        .catch(() => {
          throw new NotFoundException('Plan not found');
        });

      return this.mapPlan(row);
    }

    const typedObjects = objects ?? [];
    const row = await this.prisma.$transaction((tx) =>
      updatePlanWithObjects(tx, planId, scalarChanges, typedObjects),
    );

    return this.mapPlan(row, typedObjects);
  }

  private async assertCanReadPlan(plan: PlanWithObjects, actor: ResolvedEventOpsActor) {
    if (actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System) return;
    if (!plan.opsDraft) {
      await this.eventAccessPolicyService.requireActorRole(
        actor,
        [OpsUserRole.PmcmAdmin, OpsUserRole.System],
        'raw floorplan read',
        plan.eventId ?? undefined,
      );
      return;
    }

    await this.assertPlanAccess(plan.opsDraft, actor, 'read');
  }

  private async assertCanUpdatePlan(planId: string, actor: ResolvedEventOpsActor) {
    if (actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System) return;
    const draft = await this.findPlanDraft(planId);
    if (!draft) {
      await this.eventAccessPolicyService.requireActorRole(
        actor,
        [OpsUserRole.PmcmAdmin, OpsUserRole.System],
        'raw floorplan write',
      );
      return;
    }

    await this.assertPlanAccess(draft, actor, 'edit');
  }

  private async assertPlanAccess(
    draft: PlanDraftWithEventContact,
    actor: ResolvedEventOpsActor,
    action: 'read' | 'edit',
  ) {
    if (draft.sourceType !== 'client_preference') {
      await this.eventAccessPolicyService.requireActorRole(
        actor,
        [OpsUserRole.PmcmAdmin, OpsUserRole.System],
        'official floorplan raw plan',
        draft.event.id,
      );
      return;
    }

    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Client],
      'client floorplan preference',
      draft.event.id,
    );
    if (actor.role !== OpsUserRole.Client) return;

    const resource = `client floorplan preference ${action}`;
    if (!actor.verified || !actor.email?.trim()) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, resource, draft.event.id);
      throw new ForbiddenException('Verified client identity is required for floorplan preferences');
    }

    await this.eventAccessPolicyService.requireCanReadEvent(actor, draft.event, resource);
    if (action === 'edit' && draft.status === 'approved') {
      await this.eventAccessPolicyService.recordForbiddenAccess(
        actor,
        'approved floorplan raw plan write',
        draft.event.id,
      );
      throw new ForbiddenException('Approved floorplans are read-only');
    }
  }

  private async findPlanDraft(planId: string): Promise<PlanDraftWithEventContact | null> {
    const plan = await this.prisma.floorPlan.findUnique({
      where: { id: planId },
      include: {
        opsDraft: {
          include: {
            event: { include: { inquiry: { select: { email: true } } } },
          },
        },
      },
    });
    return plan?.opsDraft ?? null;
  }
}
