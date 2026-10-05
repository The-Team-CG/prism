import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { FloorPlan as PrismaFloorPlan, FloorPlanObject as PrismaFloorPlanObject, Prisma } from '@prisma/client';
import type { UpdatePlanInput } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import { asArray } from '@prism/kernel/shared';
import type { CanvasObject, FloorPlan, JsonValue, Seat, SeatCategory } from '@prism/kernel/shared';
import { floorPlanScalarPatch, replaceFloorPlanObjects } from './plan-patch';

type UpdatePlanChanges = UpdatePlanInput;

type PlanActor = {
  actorRole?: string;
  role?: string;
  actorName?: string;
  actorEmail?: string;
  clientName?: string;
};

type PlanWithObjects = PrismaFloorPlan & { objectRows?: PrismaFloorPlanObject[] };
type PlanDraftWithEvent = Prisma.OpsFloorPlanDraftGetPayload<{ include: { event: true } }>;

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
  constructor(private readonly prisma: PrismaService) {}

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

  async getPlan(planId: string, actor: PlanActor = {}): Promise<FloorPlan> {
    const row = await this.prisma.floorPlan.findUnique({
      where: { id: planId },
      include: {
        objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
      },
    });

    if (!row) throw new NotFoundException('Plan not found');
    await this.assertCanReadPlan(row, actor);

    return this.mapPlan(row);
  }

  async updatePlan(planId: string, changes: UpdatePlanChanges, actor: PlanActor = {}): Promise<FloorPlan> {
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

  private async assertCanReadPlan(plan: PlanWithObjects, actor: PlanActor) {
    const role = (actor.actorRole ?? actor.role ?? '').trim().toLowerCase();
    if (role === 'pmcm-admin' || role === 'system') return;
    if (role !== 'client') {
      throw new ForbiddenException('Only PMCM or the owning client can read this floorplan');
    }

    const draft = await this.findPlanDraft(plan.id);
    if (!draft) {
      throw new ForbiddenException('Clients cannot read this floorplan');
    }

    this.assertClientOwnsDraft(draft, actor, 'read');
  }

  private async assertCanUpdatePlan(planId: string, actor: PlanActor) {
    const role = (actor.actorRole ?? actor.role ?? '').trim().toLowerCase();
    if (role === 'pmcm-admin' || role === 'system') return;
    if (role !== 'client') {
      throw new ForbiddenException('Only PMCM or the owning client can edit this floorplan');
    }

    const draft = await this.findPlanDraft(planId);
    if (!draft) {
      throw new ForbiddenException('Clients cannot edit this floorplan');
    }
    if (draft.status === 'approved') {
      throw new ForbiddenException('Approved floorplans are read-only');
    }

    this.assertClientOwnsDraft(draft, actor, 'edit');
  }

  private async findPlanDraft(planId: string): Promise<PlanDraftWithEvent | null> {
    const plan = await this.prisma.floorPlan.findUnique({
      where: { id: planId },
      include: { opsDraft: { include: { event: true } } },
    });
    return plan?.opsDraft ?? null;
  }

  private assertClientOwnsDraft(draft: PlanDraftWithEvent, actor: PlanActor, action: 'read' | 'edit') {
    const actorClientName = (actor.clientName ?? actor.actorName ?? '').trim().toLowerCase();
    const eventClientName = (draft.event?.clientName ?? '').trim().toLowerCase();
    const portalUnlocked = draft.event?.clientPortalStatus === 'unlocked';

    if (!portalUnlocked || !actorClientName || actorClientName !== eventClientName) {
      throw new ForbiddenException(`Clients cannot ${action} this event floorplan`);
    }
  }
}
