import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { FloorPlan as PrismaFloorPlan, FloorPlanObject as PrismaFloorPlanObject } from '@prisma/client';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { asArray } from '@prism/kernel/shared';
import type { CanvasObject, FloorPlan, JsonValue, Seat, SeatCategory } from '@prism/kernel/shared';

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

type PlanActor = {
  actorRole?: string;
  role?: string;
  actorName?: string;
  actorEmail?: string;
  clientName?: string;
};

type PlanWithObjects = PrismaFloorPlan & { objectRows?: PrismaFloorPlanObject[] };

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
          data: {
            ...(scalarChanges.width !== undefined && { width: scalarChanges.width }),
            ...(scalarChanges.height !== undefined && { height: scalarChanges.height }),
            ...(scalarChanges.gridSize !== undefined && { gridSize: scalarChanges.gridSize }),
            ...(scalarChanges.venue !== undefined && { venue: scalarChanges.venue }),
            ...(scalarChanges.pax !== undefined && { pax: scalarChanges.pax }),
            ...(scalarChanges.guests !== undefined && { guests: toPrismaJson(scalarChanges.guests) }),
            ...(scalarChanges.suppliers !== undefined && { suppliers: toPrismaJson(scalarChanges.suppliers) }),
            ...(scalarChanges.seats !== undefined && { seats: toPrismaJson(scalarChanges.seats) }),
            ...(scalarChanges.seatCategories !== undefined && {
              seatCategories: toPrismaJson(scalarChanges.seatCategories),
            }),
          },
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

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.floorPlan
        .update({
          where: { id: planId },
          data: {
            ...(scalarChanges.width !== undefined && { width: scalarChanges.width }),
            ...(scalarChanges.height !== undefined && { height: scalarChanges.height }),
            ...(scalarChanges.gridSize !== undefined && { gridSize: scalarChanges.gridSize }),
            ...(scalarChanges.venue !== undefined && { venue: scalarChanges.venue }),
            ...(scalarChanges.pax !== undefined && { pax: scalarChanges.pax }),
            ...(scalarChanges.guests !== undefined && { guests: toPrismaJson(scalarChanges.guests) }),
            ...(scalarChanges.suppliers !== undefined && { suppliers: toPrismaJson(scalarChanges.suppliers) }),
            ...(scalarChanges.seats !== undefined && { seats: toPrismaJson(scalarChanges.seats) }),
            ...(scalarChanges.seatCategories !== undefined && {
              seatCategories: toPrismaJson(scalarChanges.seatCategories),
            }),
            objects: toPrismaJson(typedObjects),
          },
        })
        .catch(() => {
          throw new NotFoundException('Plan not found');
        });

      await tx.floorPlanObject.deleteMany({ where: { floorPlanId: planId } });

      if (typedObjects.length > 0) {
        await tx.floorPlanObject.createMany({
          data: typedObjects.map((obj, index) => ({
            floorPlanId: planId,
            objectId: obj.id,
            kind: obj.kind,
            zIndex: obj.zIndex ?? index,
            objectData: toPrismaJson(obj),
            svgMarkup: obj.svgMarkup ?? null,
          })),
        });
      }

      return updated;
    });

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

  private async findPlanDraft(planId: string) {
    const plan = (await this.prisma.floorPlan.findUnique({
      where: { id: planId },
      include: { opsDraft: { include: { event: true } } },
    } as any)) as any;
    return plan?.opsDraft;
  }

  private assertClientOwnsDraft(draft: any, actor: PlanActor, action: 'read' | 'edit') {
    const actorClientName = (actor.clientName ?? actor.actorName ?? '').trim().toLowerCase();
    const eventClientName = (draft.event?.clientName ?? '').trim().toLowerCase();
    const portalUnlocked = draft.event?.clientPortalStatus === 'unlocked';

    if (!portalUnlocked || !actorClientName || actorClientName !== eventClientName) {
      throw new ForbiddenException(`Clients cannot ${action} this event floorplan`);
    }
  }
}
